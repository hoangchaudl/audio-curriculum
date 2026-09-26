import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { clipFields } from './videoClip';
import { Invite, Enrollment } from './types';

// The enrollment an invited trainee creates for themselves - exactly the
// invite's settings (firestore.rules enrollmentMatchesInvite).
const enrollmentFromInvite = (invite: Invite, uid: string): Enrollment => ({
  id: uid, traineeId: uid, startDate: invite.startDate!, podEpisodesRequired: invite.podEpisodesRequired ?? 1,
  reviewers: invite.reviewers ?? {}, reviewerUids: invite.reviewerUids ?? [], createdAt: new Date().toISOString(),
});
import { AppState, User, Category, Module, ModuleVideo, VideoProgress } from './types';
import { canSeeModule, isRestrictedCategory, seesAllCategories } from './access';
import { initialData } from './data';
import { notifySave, notifySyncError } from './components/assessment/ui';

// A live listener was refused or lost: log it and show the "couldn't load"
// banner (<SyncErrorBanner />) instead of quietly showing stale/empty data.
const syncFailed = (label: string) => (error: unknown) => {
  console.error(`Error syncing ${label} from Firestore:`, error);
  notifySyncError();
};
import { AssessmentApi, useAssessment } from './assessment/useAssessment';
import { db, auth } from './firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, query, where, Query } from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';

// Pod typed at sign-up, kept until the profile can be created (after the
// email is verified). Best effort: verifying on another device loses it,
// and the pod can be set from the profile later.
const pendingPodKey = (uid: string) => `pendingPod:${uid}`;

export type AccountSetupResult = 'done' | 'unverified' | 'no-invite';

interface AppContextType extends AppState, AssessmentApi {
  // True whenever Firebase Auth reports a real signed-in session - even if
  // that user's /users/{uid} profile document hasn't loaded (or doesn't
  // exist) yet. Used to tell "not signed in" apart from "signed in, but
  // still waiting on / missing profile data" so the UI doesn't just dump
  // someone back on the login form with no explanation.
  hasSession: boolean;
  // Signed in, but no /users/{uid} profile exists: a new sign-up that still
  // has to verify its email / be matched to an invite (see AccountSetupView).
  profileMissing: boolean;
  authLoading: boolean;
  authError: string | null;
  // True once the submissions listener has delivered its first snapshot
  // (even an empty one) for the current session - lets callers that pick a
  // default based on submissions (see App.tsx) wait for real data instead
  // of racing an empty initial array and locking in the wrong default.
  clearAuthError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, pod?: string) => Promise<boolean>;
  completeAccountSetup: () => Promise<AccountSetupResult>;
  claimInvite: () => Promise<AccountSetupResult>;
  resendVerification: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  logout: () => void;
  markVideoWatched: (moduleId: string) => void;
  unmarkVideoWatched: (moduleId: string) => void;
  updateUserAvatar: (userId: string, avatarBase64: string) => void;
  updateUserName: (userId: string, name: string) => void;
  updateUserRole: (userId: string, role: User['role']) => void;
  updateModule: (moduleId: string, updates: Partial<Module>) => Promise<void>;
  createModule: () => Promise<Module>;
  deleteModule: (moduleId: string) => Promise<void>;
  upsertModuleVideo: (moduleId: string, updates: Pick<ModuleVideo, 'type' | 'url' | 'title' | 'start' | 'end'>) => void;
  deleteModuleVideo: (moduleId: string) => void;
  updateUserTheme: (theme: 'light' | 'dark') => void;
  markNotificationsRead: (ids: string[]) => void;
  setUserUnlockedCategories: (userId: string, categoryIds: string[]) => void;
  createCategory: (name: string) => void;
  updateCategory: (categoryId: string, updates: Partial<Pick<Category, 'name' | 'restricted'>>) => void;
  moveCategory: (categoryId: string, direction: -1 | 1) => void;
  deleteCategory: (categoryId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Maps Firebase Auth error codes to messages people can actually act on.
const friendlyAuthError = (err: any): string => {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return err?.message || 'Something went wrong. Please try again.';
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // `state` no longer holds currentUser - the signed-in user is derived from
  // Firebase Auth (authUid) joined against the live `users` list below. This
  // avoids ever trusting a client-set "currentUser" that isn't backed by a
  // real authenticated session.
  //
  // Only `modules`/`moduleVideos` start from the local seed data (so the
  // curriculum isn't blank before Firestore has anything in it - see
  // seedCurriculumIfEmpty below). Everything else - submissions, grades,
  // video tasks, video-watch progress - is real usage data with nothing to
  // seed, so it starts empty and is filled in entirely by Firestore listeners.
  const [state, setState] = useState<Omit<AppState, 'currentUser'>>(() => ({
    users: [],
    categories: initialData.categories,
    modules: initialData.modules,
    moduleVideos: initialData.moduleVideos,
    videoProgress: [],
  }));
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // True once modules/categories actually came from Firestore (not the local
  // seed fallback) - the admin reconcile below must never write seed data
  // back over real documents.
  const [ownProfile, setOwnProfile] = useState<User | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [roster, setRoster] = useState<User[]>([]);
  const [curriculumFromFirestore, setCurriculumFromFirestore] = useState({ modules: false, videos: false, categories: false });

  const clearAuthError = () => setAuthError(null);

  // Track the real Firebase Auth session AND sync every collection the app
  // reads together, because firestore.rules requires being signed in to read
  // any of them. The two used to be separate effects, with the users listener
  // subscribing once at page load (before anyone was signed in) - that first
  // subscription attempt was silently denied (no error handler was attached)
  // and never retried, so after a real sign-in the local `users` list stayed
  // empty forever and `currentUser` could never resolve. Now we tear down and
  // re-create every listener each time the auth state actually changes.
  useEffect(() => {
    let unsubscribers: Array<() => void> = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setAuthUid(fbUser ? fbUser.uid : null);

      unsubscribers.forEach(u => u());
      unsubscribers = [];

      if (!fbUser) {
        // Signed out: nothing to read, and no session to read it with. Keep
        // showing the local curriculum fallback rather than blanking it.
        setState(s => ({
          ...s, videoProgress: [],
          categories: initialData.categories, modules: initialData.modules, moduleVideos: initialData.moduleVideos,
        }));
        setCurriculumFromFirestore({ modules: false, videos: false, categories: false });
        setOwnProfile(null);
        setProfileMissing(false);
        setAuthLoading(false);
        return;
      }

      // Surfaces Firestore permission/rules errors instead of failing
      // silently - this is exactly the kind of bug that caused the "stuck on
      // loading, never reaches dashboard" symptom the comment above refers to.
      const onError = (label: string) => (error: unknown) => {
        console.error(`Error syncing ${label} from Firestore:`, error);
        setAuthError('Signed in, but could not load your profile. Please refresh or contact an admin.');
        setAuthLoading(false);
      };

      // Your own profile. Other people's are private (see firestore.rules);
      // the roster listener below loads only the ones your role may read.
      // A profile this client just created (account setup) shows up locally
      // before the server has it; the listeners it unlocks would then be
      // denied by firestore.rules (isMember) and die. So a new profile only
      // counts once committed - later edits (theme, avatar) apply at once.
      let onServer = false;
      unsubscribers.push(onSnapshot(doc(db, 'users', fbUser.uid), { includeMetadataChanges: true }, (snapshot) => {
        if (!snapshot.metadata.hasPendingWrites) onServer = snapshot.exists();
        else if (!onServer) return;
        setOwnProfile(snapshot.exists() ? (snapshot.data() as User) : null);
        setProfileMissing(!snapshot.exists());
        setAuthLoading(false);
      }, onError('users')));
    });

    return () => {
      unsubscribeAuth();
      unsubscribers.forEach(u => u());
    };
  }, []);

  const currentUser = authUid && ownProfile?.id === authUid ? ownProfile : null;

  // Modules and their videos are read per role, because firestore.rules
  // won't let a sound designer read a restricted category's documents
  // (rules aren't filters - an unrestricted collection listener would be
  // rejected outright). Designers therefore listen to "unrestricted" plus
  // one query per category an admin unlocked for them; engineers/admins
  // listen to everything. Re-subscribes whenever the role or unlock list
  // changes, so an admin's unlock/lock takes effect live.
  const role = currentUser?.role;
  // Released at a checkpoint: lessons are closed (firestore.rules), so
  // don't ask for them; grades and feedback still load (useAssessment).
  const released = role === 'sound_designer' && currentUser?.status === 'released';
  const unlockedKey = (currentUser?.unlockedCategories ?? []).join('|');
  useEffect(() => {
    if (!authUid || !role || released) return;
    const unlocked = unlockedKey ? unlockedKey.split('|') : [];

    const listen = <T extends { id: string }>(
      name: 'modules' | 'moduleVideos',
      apply: (rows: T[] | null) => void,
    ) => {
      const base = collection(db, name);
      const sources: Query[] = seesAllCategories(role)
        ? [base]
        : [query(base, where('restricted', '==', false)), ...unlocked.map(id => query(base, where('category', '==', id)))];
      const results = sources.map(() => new Map<string, T>());
      return sources.map((q, i) => onSnapshot(q, (snapshot) => {
        results[i] = new Map(snapshot.docs.map(d => [d.id, d.data() as T]));
        const merged = new Map<string, T>();
        results.forEach(m => m.forEach((v, k) => merged.set(k, v)));
        // Nothing in Firestore yet (not seeded, or not yet backfilled with
        // `restricted` - see the admin reconcile below): keep the local
        // fallback rather than blanking the curriculum.
        apply(merged.size ? [...merged.values()] : null);
      }, syncFailed(name)));
    };

    const unsubs = [
      // Categories: same "empty means not seeded yet, keep the local
      // fallback" behavior as the curriculum listeners. Needs a profile
      // (firestore.rules isMember), hence here and not at sign-in.
      onSnapshot(collection(db, 'categories'), (snapshot) => {
        if (snapshot.empty) return;
        const categories: Category[] = [];
        snapshot.forEach(d => categories.push(d.data() as Category));
        setState(s => ({ ...s, categories }));
        setCurriculumFromFirestore(f => ({ ...f, categories: true }));
      }, syncFailed('categories')),
      ...listen<Module>('modules', rows => {
        setState(s => ({ ...s, modules: rows ?? initialData.modules }));
        setCurriculumFromFirestore(f => ({ ...f, modules: !!rows }));
      }),
      ...listen<ModuleVideo>('moduleVideos', rows => {
        setState(s => ({ ...s, moduleVideos: rows ?? initialData.moduleVideos }));
        setCurriculumFromFirestore(f => ({ ...f, videos: !!rows }));
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [authUid, role, unlockedKey, released]);

  // Defense in depth on top of firestore.rules: also hides locked content
  // that only exists locally (the seed fallback shown before Firestore
  // responds), so a designer never sees it even for a moment.
  const visibleModules = useMemo(
    () => (released ? [] : state.modules.filter(m => canSeeModule(m, state.categories, currentUser))),
    [state.modules, state.categories, currentUser, released],
  );
  const visibleModuleVideos = useMemo(
    () => state.moduleVideos.filter(v => visibleModules.some(m => m.id === v.moduleId)),
    [state.moduleVideos, visibleModules],
  );

  // Admin-only: keeps each module's (and its video's) denormalized
  // `category`/`restricted` fields in step with its category, which is what
  // firestore.rules actually checks. Covers the one-time backfill of
  // documents created before categories existed, locking/unlocking a
  // category, and moving a module to another category. Idempotent - only
  // writes documents that are actually out of date.
  useEffect(() => {
    if (role !== 'admin') return;
    if (!curriculumFromFirestore.modules || !curriculumFromFirestore.categories) return;
    const batch = writeBatch(db);
    let writes = 0;
    state.modules.forEach(m => {
      const restricted = isRestrictedCategory(state.categories, m.category);
      if (m.restricted !== restricted) {
        batch.update(doc(db, 'modules', m.id), { restricted });
        writes++;
      }
    });
    if (curriculumFromFirestore.videos) {
      state.moduleVideos.forEach(v => {
        const mod = state.modules.find(m => m.id === v.moduleId);
        const category = mod?.category ?? '';
        const restricted = isRestrictedCategory(state.categories, mod?.category);
        if (v.restricted !== restricted || (v.category ?? '') !== category) {
          batch.update(doc(db, 'moduleVideos', v.id), { restricted, category });
          writes++;
        }
      });
    }
    if (writes) batch.commit().catch(err => { console.error('Error syncing category locks', err); notifySave(false); });
  }, [role, curriculumFromFirestore, state.modules, state.moduleVideos, state.categories]);

  // One-time curriculum bootstrap: the very first admin to sign in after
  // this collection is empty writes the local module/moduleVideo seed data
  // into Firestore (mirrors the "first signup becomes admin" bootstrap in
  // signup() below). Only admins can write /modules per firestore.rules, so
  // this can't run as a plain signed-in user - it just quietly does nothing
  // until an admin opens the app once.
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    let cancelled = false;

    const seedIfEmpty = async (collectionName: string, rows: Array<{ id: string }>) => {
      const existing = await getDocs(collection(db, collectionName));
      if (cancelled || !existing.empty) return;
      const batch = writeBatch(db);
      rows.forEach(row => batch.set(doc(db, collectionName, row.id), row));
      await batch.commit();
    };

    seedIfEmpty('modules', initialData.modules).catch(err => console.error('Error seeding modules', err));
    seedIfEmpty('moduleVideos', initialData.moduleVideos).catch(err => console.error('Error seeding moduleVideos', err));
    seedIfEmpty('categories', initialData.categories).catch(err => console.error('Error seeding categories', err));

    // Projects that already had an admin before the /config/bootstrap
    // claim existed: record it now, which closes the "first signup becomes
    // admin" path for everyone else (see signup() and firestore.rules).
    const bootstrapRef = doc(db, 'config', 'bootstrap');
    getDoc(bootstrapRef)
      .then(snap => {
        if (cancelled || snap.exists() || !currentUser) return;
        return setDoc(bootstrapRef, { adminUid: currentUser.id, claimedAt: new Date().toISOString() });
      })
      .catch(err => { console.error('Error recording admin bootstrap', err); notifySave(false); });

    return () => { cancelled = true; };
  }, [currentUser?.role]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (err) {
      setAuthError(friendlyAuthError(err));
      return false;
    }
  };

  // Invite-only sign-up. Creates the Auth account and sends a verification
  // email; the profile (with the invited role) is created only once the
  // email is verified - see completeAccountSetup, and firestore.rules,
  // which match invites to verified emails only. The single exception is
  // the very first account on a fresh project, which becomes admin.
  const signup = async (name: string, email: string, password: string, pod?: string): Promise<boolean> => {
    setAuthError(null);
    try {
      // Create the Firebase Auth account first: reading config/bootstrap
      // requires being signed in.
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = credential.user;

      // Bootstrap rule: the very first signup becomes admin. firestore.rules
      // only allows a self-created admin profile when it's written together
      // with the one-time /config/bootstrap claim (which can never be
      // created again).
      const bootstrapRef = doc(db, 'config', 'bootstrap');
      if (!(await getDoc(bootstrapRef)).exists()) {
        const admin: User = { id: fbUser.uid, name, email, role: 'admin', ...(pod ? { pod } : {}), createdAt: new Date().toISOString() };
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', admin.id), admin);
        batch.set(bootstrapRef, { adminUid: admin.id, claimedAt: admin.createdAt });
        try {
          await batch.commit();
          return true;
        } catch {
          // Someone else claimed bootstrap at the same moment - continue as
          // a regular (invited) sign-up.
        }
      }

      await updateProfile(fbUser, { displayName: name.trim() });
      if (pod?.trim()) {
        try { localStorage.setItem(pendingPodKey(fbUser.uid), pod.trim()); } catch { /* storage blocked */ }
      }
      await sendEmailVerification(fbUser);
      return true;
    } catch (err) {
      setAuthError(friendlyAuthError(err));
      return false;
    }
  };

  // The invite for the signed-in account's email - but only once that email
  // is verified. Refreshes the ID token so firestore.rules see the new
  // email_verified claim right after the person clicks the link.
  const verifiedInvite = async () => {
    const fbUser = auth.currentUser;
    if (!fbUser?.email) return { status: 'no-invite' as const };
    await fbUser.reload();
    if (!fbUser.emailVerified) return { status: 'unverified' as const };
    await fbUser.getIdToken(true);
    const ref = doc(db, 'invites', fbUser.email.toLowerCase());
    const snap = await getDoc(ref);
    return snap.exists() ? { status: 'ok' as const, fbUser, ref, invite: snap.data() as Invite } : { status: 'no-invite' as const };
  };

  // A new account (no profile yet): create the profile with the invited
  // role, the trainee's enrollment, and use up the invite - one batch.
  const completeAccountSetup = async (): Promise<AccountSetupResult> => {
    const found = await verifiedInvite();
    if (found.status !== 'ok') return found.status;
    const { fbUser, ref, invite } = found;
    const email = fbUser.email!.toLowerCase();
    let pod: string | null = null;
    try { pod = localStorage.getItem(pendingPodKey(fbUser.uid)); } catch { /* storage blocked */ }
    const user: User = {
      id: fbUser.uid, name: fbUser.displayName || email.split('@')[0], email, role: invite.role,
      ...(pod ? { pod } : {}), createdAt: new Date().toISOString(),
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', user.id), user);
    if (invite.role === 'sound_designer' && invite.startDate) batch.set(doc(db, 'enrollments', user.id), enrollmentFromInvite(invite, user.id));
    batch.delete(ref);
    await batch.commit();
    try { localStorage.removeItem(pendingPodKey(fbUser.uid)); } catch { /* storage blocked */ }
    return 'done';
  };

  // An existing trainee account invited later: enroll it with the invite's
  // settings (see WaitingView and the effect further down).
  const claimInvite = async (): Promise<AccountSetupResult> => {
    const found = await verifiedInvite();
    if (found.status !== 'ok') return found.status;
    const { fbUser, ref, invite } = found;
    if (invite.role !== 'sound_designer' || !invite.startDate) return 'no-invite';
    const batch = writeBatch(db);
    batch.set(doc(db, 'enrollments', fbUser.uid), enrollmentFromInvite(invite, fbUser.uid));
    batch.delete(ref);
    await batch.commit();
    return 'done';
  };

  const resendVerification = async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err: any) {
      // Don't reveal whether an account exists for this email - treat
      // "not found" the same as success so the form can't be used to probe
      // who has signed up.
      if (err?.code === 'auth/user-not-found') return true;
      setAuthError(friendlyAuthError(err));
      return false;
    }
  };

  const logout = () => {
    signOut(auth).catch(console.error);
  };

  // Every write says how it went (<SavedToast />): things a person just
  // did confirm "Saved" or "Couldn't save"; background writes (theme, read
  // notifications, lesson progress) speak up only when they fail.
  const report = async (label: string, work: () => Promise<unknown>, { quiet = false } = {}) => {
    try {
      await work();
      if (!quiet) notifySave(true);
    } catch (error) {
      console.error(label, error);
      notifySave(false);
    }
  };

  const updateUserAvatar = async (userId: string, avatarBase64: string) => {
    await report('Error updating avatar in Firestore', () => setDoc(doc(db, 'users', userId), { avatarBase64 }, { merge: true }));
  };

  const updateUserName = async (userId: string, name: string) => {
    await report('Error updating name in Firestore', () => setDoc(doc(db, 'users', userId), { name }, { merge: true }));
  };

  // Admin-only: promote/demote a user between Sound Designer and Audio
  // Engineer (see AdminDashboard). Self-service signup no longer offers a
  // role picker - see AuthView/signup below - so this is the only way an
  // account becomes an engineer after the very first (admin) signup.
  const updateUserRole = async (userId: string, role: User['role']) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    await report('Error updating user role', () => setDoc(doc(db, 'users', userId), { role }, { merge: true }));
  };

  // A lesson finished: its video(s) played to the end (see ContentPageView)
  // or the trainee marked it done. One record per trainee per lesson.
  const markVideoWatched = async (moduleId: string) => {
    if (!currentUser) return;
    const progressId = `${moduleId}_${currentUser.id}`;
    const record: VideoProgress = {
      id: progressId,
      moduleId,
      userId: currentUser.id,
      watchedAt: new Date().toISOString(),
    };
    await report('Error marking video watched', () => setDoc(doc(db, 'videoProgress', progressId), record), { quiet: true });
  };

  // Trainee's "Mark as done" toggle on program content pages (the same
  // record a finished video writes) - un-marking deletes it.
  const unmarkVideoWatched = async (moduleId: string) => {
    if (!currentUser) return;
    await report('Error un-marking video watched', () => deleteDoc(doc(db, 'videoProgress', `${moduleId}_${currentUser.id}`)), { quiet: true });
  };

  const updateModule = async (moduleId: string, updates: Partial<Module>) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const clean: Record<string, unknown> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) clean[key] = value;
    });
    try {
      await updateDoc(doc(db, 'modules', moduleId), clean);
    } catch (error) {
      console.error('Error updating module', error);
      throw error; // lets saveWith() show the failure instead of "Saved"
    }
  };

  // Returns the created module (not just its id) so the caller can open it
  // straight into the edit form without waiting on the modules listener to
  // round-trip the write back down.
  const createModule = async (): Promise<Module> => {
    if (!currentUser || currentUser.role !== 'admin') throw new Error('Only admins can create modules.');
    const id = `m_${Date.now()}`;
    const nextOrder = state.modules.length > 0 ? Math.max(...state.modules.map(m => m.order)) + 1 : 1;
    const newModule: Module = {
      id,
      order: nextOrder,
      category: [...state.categories].sort((a, b) => a.order - b.order)[0]?.id ?? 'Onboarding',
      title: 'New Module',
      description: '',
    };
    await setDoc(doc(db, 'modules', id), newModule);
    return newModule;
  };

  // Removes the lesson and, if the admin had set one, its video.
  const deleteModule = async (moduleId: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'modules', moduleId));
      const video = state.moduleVideos.find(v => v.moduleId === moduleId);
      if (video) await deleteDoc(doc(db, 'moduleVideos', video.id));
    } catch (error) {
      console.error('Error deleting module', error);
      throw error;
    }
  };

  // One video per module - reuses the existing video's doc id if the admin
  // is editing one already set, otherwise creates a new deterministic id.
  const upsertModuleVideo = async (moduleId: string, { start, end, ...updates }: Pick<ModuleVideo, 'type' | 'url' | 'title' | 'start' | 'end'>) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const existing = state.moduleVideos.find(v => v.moduleId === moduleId);
    const videoId = existing?.id || `mv_${moduleId}`;
    const category = state.modules.find(m => m.id === moduleId)?.category ?? '';
    const video: ModuleVideo = { id: videoId, moduleId, ...updates, ...clipFields(start, end), category, restricted: isRestrictedCategory(state.categories, category) };
    await report('Error saving module video', () => setDoc(doc(db, 'moduleVideos', videoId), video));
  };

  const deleteModuleVideo = async (moduleId: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const existing = state.moduleVideos.find(v => v.moduleId === moduleId);
    if (!existing) return;
    await report('Error deleting module video', () => deleteDoc(doc(db, 'moduleVideos', existing.id)));
  };

  const updateUserTheme = async (theme: 'light' | 'dark') => {
    if (!currentUser) return;
    await report('Error saving theme', () => setDoc(doc(db, 'users', currentUser.id), { theme }, { merge: true }), { quiet: true });
  };

  // Which notifications you've read (ids from assessment/notifications.ts).
  const markNotificationsRead = async (ids: string[]) => {
    if (!currentUser) return;
    await report('Error saving read notifications', () => setDoc(doc(db, 'users', currentUser.id), { readNotifications: ids }, { merge: true }), { quiet: true });
  };

  // Admin-only (also enforced in firestore.rules): which restricted
  // categories a given user may see.
  const setUserUnlockedCategories = async (userId: string, categoryIds: string[]) => {
    if (currentUser?.role !== 'admin') return;
    await report('Error updating unlocked categories', () => setDoc(doc(db, 'users', userId), { unlockedCategories: categoryIds }, { merge: true }));
  };

  const createCategory = async (name: string) => {
    if (currentUser?.role !== 'admin' || !name.trim()) return;
    const id = `cat_${Date.now()}`;
    const order = state.categories.length ? Math.max(...state.categories.map(c => c.order)) + 1 : 1;
    await report('Error creating category', () => setDoc(doc(db, 'categories', id), { id, name: name.trim(), order, restricted: false } satisfies Category));
  };

  // Locking/unlocking only flips the category here; the admin reconcile
  // effect above then updates every module/video in it.
  const updateCategory = async (categoryId: string, updates: Partial<Pick<Category, 'name' | 'restricted'>>) => {
    if (currentUser?.role !== 'admin') return;
    await report('Error updating category', () => updateDoc(doc(db, 'categories', categoryId), updates));
  };

  // Swaps order with the neighbouring category in the given direction.
  const moveCategory = async (categoryId: string, direction: -1 | 1) => {
    if (currentUser?.role !== 'admin') return;
    const sorted = [...state.categories].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex(c => c.id === categoryId);
    const other = sorted[i + direction];
    if (i < 0 || !other) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'categories', categoryId), { order: other.order });
    batch.update(doc(db, 'categories', other.id), { order: sorted[i].order });
    await report('Error reordering categories', () => batch.commit());
  };

  // Refuses to delete a category that still has modules, so nothing ends
  // up orphaned (the UI disables the button in that case too).
  const deleteCategory = async (categoryId: string) => {
    if (currentUser?.role !== 'admin') return;
    if (state.modules.some(m => m.category === categoryId)) return;
    await report('Error deleting category', () => deleteDoc(doc(db, 'categories', categoryId)));
  };

  // The 1-5 assessment program (see src/assessment/).
  const assessment = useAssessment(authUid, currentUser);

  // An existing trainee account invited later is enrolled at their next
  // sign-in (once per session; nothing happens without a matching invite).
  const inviteChecked = React.useRef<string | null>(null);
  const ownEnrolled = assessment.enrollments.some(e => e.id === authUid);
  useEffect(() => {
    if (!authUid || currentUser?.role !== 'sound_designer' || !assessment.ownEnrollmentLoaded || ownEnrolled) return;
    if (inviteChecked.current === authUid) return;
    inviteChecked.current = authUid;
    // Unverified emails can't claim (firestore.rules) - WaitingView asks
    // them to verify and retries from there.
    if (!auth.currentUser?.emailVerified) return;
    claimInvite().catch(error => console.error('Error claiming invite', error));
  }, [authUid, currentUser?.role, assessment.ownEnrollmentLoaded, ownEnrolled]);

  // Other people's profiles and lesson progress, by role (firestore.rules
  // reject any query that could return something you may not read):
  // admins/engineers load everyone; reviewers load the trainees assigned to
  // them; everyone else only themselves.
  const staff = role === 'admin' || role === 'audio_engineer';
  const reviewedKey = staff ? '' : assessment.enrollments.filter(e => e.id !== authUid).map(e => e.traineeId).sort().join('|');
  useEffect(() => {
    if (!authUid || !role) return;
    const logError = syncFailed;
    const setProgress = (rows: VideoProgress[]) => setState(s => ({ ...s, videoProgress: rows }));
    const unsubs: Array<() => void> = [];
    if (staff) {
      unsubs.push(onSnapshot(collection(db, 'users'), snap => setRoster(snap.docs.map(d => d.data() as User)), logError('users')));
      unsubs.push(onSnapshot(collection(db, 'videoProgress'), snap => setProgress(snap.docs.map(d => d.data() as VideoProgress)), logError('videoProgress')));
    } else {
      const found = new Map<string, User>();
      for (const id of reviewedKey ? reviewedKey.split('|') : []) {
        unsubs.push(onSnapshot(doc(db, 'users', id), snap => {
          if (snap.exists()) found.set(id, snap.data() as User); else found.delete(id);
          setRoster([...found.values()]);
        }, logError('users')));
      }
      unsubs.push(onSnapshot(query(collection(db, 'videoProgress'), where('userId', '==', authUid)),
        snap => setProgress(snap.docs.map(d => d.data() as VideoProgress)), logError('videoProgress')));
    }
    return () => { unsubs.forEach(u => u()); setRoster([]); };
  }, [authUid, role, staff, reviewedKey]);
  const users = useMemo(
    () => [...(currentUser ? [currentUser] : []), ...roster.filter(u => u.id !== currentUser?.id)],
    [currentUser, roster],
  );

  return (
    <AppContext.Provider
      value={{
        ...state,
        users,
        ...assessment,
        modules: visibleModules,
        moduleVideos: visibleModuleVideos,
        currentUser,
        hasSession: authUid !== null,
        profileMissing,
        authLoading,
        authError,
        clearAuthError,
        login,
        signup,
        completeAccountSetup,
        claimInvite,
        resendVerification,
        resetPassword,
        logout,
        markVideoWatched,
        unmarkVideoWatched,
        updateUserAvatar,
        updateUserName,
        updateUserRole,
        updateModule,
        createModule,
        deleteModule,
        upsertModuleVideo,
        deleteModuleVideo,
        updateUserTheme,
        markNotificationsRead,
        setUserUnlockedCategories,
        createCategory,
        updateCategory,
        moveCategory,
        deleteCategory,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
