import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { AppState, User, Category, Module, ModuleVideo, Submission, Grade, VideoTask, VideoProgress } from './types';
import { canSeeModule, isRestrictedCategory, seesAllCategories } from './access';
import { initialData } from './data';
import { AssessmentApi, useAssessment } from './assessment/useAssessment';
import { db, auth } from './firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, query, where, Query } from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';

interface AppContextType extends AppState, AssessmentApi {
  // True whenever Firebase Auth reports a real signed-in session - even if
  // that user's /users/{uid} profile document hasn't loaded (or doesn't
  // exist) yet. Used to tell "not signed in" apart from "signed in, but
  // still waiting on / missing profile data" so the UI doesn't just dump
  // someone back on the login form with no explanation.
  hasSession: boolean;
  authLoading: boolean;
  authError: string | null;
  // True once the submissions listener has delivered its first snapshot
  // (even an empty one) for the current session - lets callers that pick a
  // default based on submissions (see App.tsx) wait for real data instead
  // of racing an empty initial array and locking in the wrong default.
  submissionsLoaded: boolean;
  clearAuthError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, role: User['role'], pod?: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  logout: () => void;
  submitHomework: (moduleId: string, driveLink: string) => void;
  deleteSubmission: (moduleId: string) => void;
  markVideoWatched: (moduleId: string) => void;
  unmarkVideoWatched: (moduleId: string) => void;
  gradeHomework: (submissionId: string, score: 1 | 2 | 3 | 4, feedback: string, criterionScores?: Grade['criterionScores']) => void;
  createVideoTask: (engineerId: string, moduleId: string, title: string) => void;
  updateVideoTask: (taskId: string, status: VideoTask['status'], url?: string) => void;
  updateUserAvatar: (userId: string, avatarBase64: string) => void;
  updateUserName: (userId: string, name: string) => void;
  updateUserRole: (userId: string, role: User['role']) => void;
  updateModule: (moduleId: string, updates: Partial<Module>) => void;
  createModule: () => Promise<Module>;
  deleteModule: (moduleId: string) => void;
  upsertModuleVideo: (moduleId: string, updates: Pick<ModuleVideo, 'type' | 'url' | 'title'>) => void;
  deleteModuleVideo: (moduleId: string) => void;
  updateUserTheme: (theme: 'light' | 'dark') => void;
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
    submissions: [],
    grades: [],
    videoTasks: [],
    videoProgress: [],
  }));
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false);
  // True once modules/categories actually came from Firestore (not the local
  // seed fallback) - the admin reconcile below must never write seed data
  // back over real documents.
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
          ...s, users: [], submissions: [], grades: [], videoTasks: [], videoProgress: [],
          categories: initialData.categories, modules: initialData.modules, moduleVideos: initialData.moduleVideos,
        }));
        setCurriculumFromFirestore({ modules: false, videos: false, categories: false });
        setAuthLoading(false);
        setSubmissionsLoaded(false);
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

      unsubscribers.push(onSnapshot(collection(db, 'users'), (snapshot) => {
        const users: User[] = [];
        snapshot.forEach(d => users.push(d.data() as User));
        setState(s => ({ ...s, users }));
        setAuthLoading(false);
      }, onError('users')));

      // Categories: same "empty means not seeded yet, keep the local
      // fallback" behavior as the curriculum listeners below.
      unsubscribers.push(onSnapshot(collection(db, 'categories'), (snapshot) => {
        if (snapshot.empty) return;
        const categories: Category[] = [];
        snapshot.forEach(d => categories.push(d.data() as Category));
        setState(s => ({ ...s, categories }));
        setCurriculumFromFirestore(f => ({ ...f, categories: true }));
      }, onError('categories')));

      unsubscribers.push(onSnapshot(collection(db, 'submissions'), (snapshot) => {
        const submissions: Submission[] = [];
        snapshot.forEach(d => submissions.push(d.data() as Submission));
        setState(s => ({ ...s, submissions }));
        setSubmissionsLoaded(true);
      }, onError('submissions')));

      unsubscribers.push(onSnapshot(collection(db, 'grades'), (snapshot) => {
        const grades: Grade[] = [];
        snapshot.forEach(d => grades.push(d.data() as Grade));
        setState(s => ({ ...s, grades }));
      }, onError('grades')));

      unsubscribers.push(onSnapshot(collection(db, 'videoTasks'), (snapshot) => {
        const videoTasks: VideoTask[] = [];
        snapshot.forEach(d => videoTasks.push(d.data() as VideoTask));
        setState(s => ({ ...s, videoTasks }));
      }, onError('videoTasks')));

      unsubscribers.push(onSnapshot(collection(db, 'videoProgress'), (snapshot) => {
        const videoProgress: VideoProgress[] = [];
        snapshot.forEach(d => videoProgress.push(d.data() as VideoProgress));
        setState(s => ({ ...s, videoProgress }));
      }, onError('videoProgress')));
    });

    return () => {
      unsubscribeAuth();
      unsubscribers.forEach(u => u());
    };
  }, []);

  const currentUser = useMemo<User | null>(() => {
    if (!authUid) return null;
    return state.users.find(u => u.id === authUid) ?? null;
  }, [authUid, state.users]);

  // Modules and their videos are read per role, because firestore.rules
  // won't let a sound designer read a restricted category's documents
  // (rules aren't filters - an unrestricted collection listener would be
  // rejected outright). Designers therefore listen to "unrestricted" plus
  // one query per category an admin unlocked for them; engineers/admins
  // listen to everything. Re-subscribes whenever the role or unlock list
  // changes, so an admin's unlock/lock takes effect live.
  const role = currentUser?.role;
  const unlockedKey = (currentUser?.unlockedCategories ?? []).join('|');
  useEffect(() => {
    if (!authUid || !role) return;
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
      }, (error) => console.error(`Error syncing ${name} from Firestore:`, error)));
    };

    const unsubs = [
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
  }, [authUid, role, unlockedKey]);

  // Defense in depth on top of firestore.rules: also hides locked content
  // that only exists locally (the seed fallback shown before Firestore
  // responds), so a designer never sees it even for a moment.
  const visibleModules = useMemo(
    () => state.modules.filter(m => canSeeModule(m, state.categories, currentUser)),
    [state.modules, state.categories, currentUser],
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
    if (writes) batch.commit().catch(err => console.error('Error syncing category locks', err));
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
      .catch(err => console.error('Error recording admin bootstrap', err));

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

  const signup = async (
    name: string,
    email: string,
    password: string,
    role: User['role'],
    pod?: string
  ): Promise<boolean> => {
    setAuthError(null);
    try {
      // Create the Firebase Auth account first. The bootstrap check below
      // reads the `users` collection, and firestore.rules requires being
      // signed in to read it - so this has to happen only *after*
      // createUserWithEmailAndPassword has signed the new user in, not before.
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      // Bootstrap rule: the very first signup becomes admin, so the team
      // always has someone who can administer the platform. firestore.rules
      // only allows a self-created admin profile when it's written together
      // with the one-time /config/bootstrap claim (which can never be
      // created again) - everyone else can only sign up as a sound
      // designer, and further role changes must go through an admin.
      const makeUser = (userRole: User['role']): User => ({
        id: credential.user.uid,
        name,
        email,
        role: userRole,
        ...(pod ? { pod } : {}),
        createdAt: new Date().toISOString(),
      });
      const bootstrapRef = doc(db, 'config', 'bootstrap');
      if (!(await getDoc(bootstrapRef)).exists()) {
        const admin = makeUser('admin');
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', admin.id), admin);
        batch.set(bootstrapRef, { adminUid: admin.id, claimedAt: admin.createdAt });
        try {
          await batch.commit();
          return true;
        } catch {
          // Someone else claimed bootstrap at the same moment - fall
          // through and sign up as a regular designer instead.
        }
      }
      const newUser = makeUser(role === 'admin' ? 'sound_designer' : role);
      await setDoc(doc(db, 'users', newUser.id), newUser);
      return true;
    } catch (err) {
      setAuthError(friendlyAuthError(err));
      return false;
    }
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

  const updateUserAvatar = async (userId: string, avatarBase64: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { avatarBase64 }, { merge: true });
    } catch (error) {
      console.error('Error updating avatar in Firestore', error);
    }
  };

  const updateUserName = async (userId: string, name: string) => {
    try {
      await setDoc(doc(db, 'users', userId), { name }, { merge: true });
    } catch (error) {
      console.error('Error updating name in Firestore', error);
    }
  };

  // Admin-only: promote/demote a user between Sound Designer and Audio
  // Engineer (see AdminDashboard). Self-service signup no longer offers a
  // role picker - see AuthView/signup below - so this is the only way an
  // account becomes an engineer after the very first (admin) signup.
  const updateUserRole = async (userId: string, role: User['role']) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      await setDoc(doc(db, 'users', userId), { role }, { merge: true });
    } catch (error) {
      console.error('Error updating user role', error);
    }
  };

  // Deterministic id (one submission per designer per module) so a resubmit
  // is just an overwrite of the same document instead of orphaning the old
  // one - matches firestore.rules, which lets the owner update/delete their
  // own submission only while it isn't graded yet.
  const submitHomework = async (moduleId: string, driveLink: string) => {
    if (!currentUser) return;
    const submissionId = `${moduleId}_${currentUser.id}`;
    const newSubmission: Submission = {
      id: submissionId,
      moduleId,
      userId: currentUser.id,
      driveLink,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'submissions', submissionId), newSubmission);
    } catch (error) {
      console.error('Error submitting homework', error);
    }
  };

  // Lets a designer pull back a wrong submission before it's graded. Once
  // graded, a Grade record points at the submission id, so firestore.rules
  // blocks deleting it here - only an admin can remove a graded submission.
  const deleteSubmission = async (moduleId: string) => {
    if (!currentUser) return;
    const submissionId = `${moduleId}_${currentUser.id}`;
    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
    } catch (error) {
      console.error('Error deleting submission', error);
    }
  };

  // Anchors a module's homework deadline to when its video was actually
  // finished, not just opened - see ModuleView's embedded player, which
  // calls this on the video's `ended` event. Re-watching just moves the
  // deadline to the latest completion (same deterministic-id overwrite
  // pattern as submitHomework).
  const markVideoWatched = async (moduleId: string) => {
    if (!currentUser) return;
    const progressId = `${moduleId}_${currentUser.id}`;
    const record: VideoProgress = {
      id: progressId,
      moduleId,
      userId: currentUser.id,
      watchedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'videoProgress', progressId), record);
    } catch (error) {
      console.error('Error marking video watched', error);
    }
  };

  // Trainee's "Mark as done" toggle on program content pages (the same
  // record a finished video writes) - un-marking deletes it.
  const unmarkVideoWatched = async (moduleId: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'videoProgress', `${moduleId}_${currentUser.id}`));
    } catch (error) {
      console.error('Error un-marking video watched', error);
    }
  };

  // Fixed: admins should also be able to grade homework, not only
  // audio_engineers. Previously this silently no-op'd for admins, which made
  // it look like grading was broken when a director tried it. Deterministic
  // grade id keeps this idempotent if it's ever called twice for the same
  // submission.
  const gradeHomework = async (submissionId: string, score: 1 | 2 | 3 | 4, feedback: string, criterionScores?: Grade['criterionScores']) => {
    if (!currentUser || (currentUser.role !== 'audio_engineer' && currentUser.role !== 'admin')) return;
    const gradeId = `g_${submissionId}`;
    const newGrade: Grade = {
      id: gradeId,
      submissionId,
      engineerId: currentUser.id,
      score,
      feedback,
      gradedAt: new Date().toISOString(),
      // Firestore rejects explicit `undefined` values, so only include the
      // field when the module was graded against structured criteria.
      ...(criterionScores && criterionScores.length > 0 ? { criterionScores } : {}),
    };
    try {
      await setDoc(doc(db, 'grades', gradeId), newGrade);
      await updateDoc(doc(db, 'submissions', submissionId), { status: 'graded' });
    } catch (error) {
      console.error('Error grading homework', error);
    }
  };

  // The admin side of the video task workflow - firestore.rules reserves
  // *creating* a videoTasks doc for admins, matching the engineer-side
  // updateVideoTask below which can only ever update one already assigned.
  const createVideoTask = async (engineerId: string, moduleId: string, title: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const id = `vt_${Date.now()}`;
    const newTask: VideoTask = {
      id,
      moduleId,
      engineerId,
      title: title.trim(),
      status: 'pending',
      assignedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'videoTasks', id), newTask);
    } catch (error) {
      console.error('Error creating video task', error);
    }
  };

  // Only ever updates a task an admin has already assigned - firestore.rules
  // reserves *creating* a videoTasks doc for admins, and an engineer typing a
  // link for a module with no assigned task has nothing to update (see the
  // "no task assigned yet" state in EngineerDashboard).
  const updateVideoTask = async (taskId: string, status: VideoTask['status'], url?: string) => {
    const existing = state.videoTasks.find(t => t.id === taskId);
    if (!existing) {
      console.warn('No admin-assigned video task exists for this module yet.');
      return;
    }
    const nextUrl = url ?? existing.videoUrl;
    const payload: Partial<VideoTask> = { status };
    if (nextUrl !== undefined) payload.videoUrl = nextUrl;
    try {
      await updateDoc(doc(db, 'videoTasks', taskId), payload);
    } catch (error) {
      console.error('Error updating video task', error);
    }
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

  // Removes the module and, if the admin had set one, its video - orphaned
  // submissions/grades for a deleted module are left alone (same as
  // deleting a submission doesn't touch its grade) rather than cascading.
  const deleteModule = async (moduleId: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'modules', moduleId));
      const video = state.moduleVideos.find(v => v.moduleId === moduleId);
      if (video) await deleteDoc(doc(db, 'moduleVideos', video.id));
    } catch (error) {
      console.error('Error deleting module', error);
    }
  };

  // One video per module - reuses the existing video's doc id if the admin
  // is editing one already set, otherwise creates a new deterministic id.
  const upsertModuleVideo = async (moduleId: string, updates: Pick<ModuleVideo, 'type' | 'url' | 'title'>) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const existing = state.moduleVideos.find(v => v.moduleId === moduleId);
    const videoId = existing?.id || `mv_${moduleId}`;
    const category = state.modules.find(m => m.id === moduleId)?.category ?? '';
    const video: ModuleVideo = { id: videoId, moduleId, ...updates, category, restricted: isRestrictedCategory(state.categories, category) };
    try {
      await setDoc(doc(db, 'moduleVideos', videoId), video);
    } catch (error) {
      console.error('Error saving module video', error);
    }
  };

  const deleteModuleVideo = async (moduleId: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const existing = state.moduleVideos.find(v => v.moduleId === moduleId);
    if (!existing) return;
    try {
      await deleteDoc(doc(db, 'moduleVideos', existing.id));
    } catch (error) {
      console.error('Error deleting module video', error);
    }
  };

  const updateUserTheme = async (theme: 'light' | 'dark') => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'users', currentUser.id), { theme }, { merge: true });
    } catch (error) {
      console.error('Error saving theme', error);
    }
  };

  // Admin-only (also enforced in firestore.rules): which restricted
  // categories a given user may see.
  const setUserUnlockedCategories = async (userId: string, categoryIds: string[]) => {
    if (currentUser?.role !== 'admin') return;
    try {
      await setDoc(doc(db, 'users', userId), { unlockedCategories: categoryIds }, { merge: true });
    } catch (error) {
      console.error('Error updating unlocked categories', error);
    }
  };

  const createCategory = async (name: string) => {
    if (currentUser?.role !== 'admin' || !name.trim()) return;
    const id = `cat_${Date.now()}`;
    const order = state.categories.length ? Math.max(...state.categories.map(c => c.order)) + 1 : 1;
    try {
      await setDoc(doc(db, 'categories', id), { id, name: name.trim(), order, restricted: false } satisfies Category);
    } catch (error) {
      console.error('Error creating category', error);
    }
  };

  // Locking/unlocking only flips the category here; the admin reconcile
  // effect above then updates every module/video in it.
  const updateCategory = async (categoryId: string, updates: Partial<Pick<Category, 'name' | 'restricted'>>) => {
    if (currentUser?.role !== 'admin') return;
    try {
      await updateDoc(doc(db, 'categories', categoryId), updates);
    } catch (error) {
      console.error('Error updating category', error);
    }
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
    try {
      await batch.commit();
    } catch (error) {
      console.error('Error reordering categories', error);
    }
  };

  // Refuses to delete a category that still has modules, so nothing ends
  // up orphaned (the UI disables the button in that case too).
  const deleteCategory = async (categoryId: string) => {
    if (currentUser?.role !== 'admin') return;
    if (state.modules.some(m => m.category === categoryId)) return;
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (error) {
      console.error('Error deleting category', error);
    }
  };

  // New 1-5 assessment program (separate collections; legacy
  // submissions/grades above are untouched).
  const assessment = useAssessment(authUid, currentUser);

  return (
    <AppContext.Provider
      value={{
        ...state,
        ...assessment,
        modules: visibleModules,
        moduleVideos: visibleModuleVideos,
        currentUser,
        hasSession: authUid !== null,
        authLoading,
        authError,
        submissionsLoaded,
        clearAuthError,
        login,
        signup,
        resetPassword,
        logout,
        submitHomework,
        deleteSubmission,
        markVideoWatched,
        unmarkVideoWatched,
        gradeHomework,
        createVideoTask,
        updateVideoTask,
        updateUserAvatar,
        updateUserName,
        updateUserRole,
        updateModule,
        createModule,
        deleteModule,
        upsertModuleVideo,
        deleteModuleVideo,
        updateUserTheme,
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
