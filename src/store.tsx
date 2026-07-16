import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { AppState, User, Module, Submission, Grade, VideoTask } from './types';
import { initialData } from './data';
import { db, auth } from './firebase';
import { collection, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';

interface AppContextType extends AppState {
  // True whenever Firebase Auth reports a real signed-in session - even if
  // that user's /users/{uid} profile document hasn't loaded (or doesn't
  // exist) yet. Used to tell "not signed in" apart from "signed in, but
  // still waiting on / missing profile data" so the UI doesn't just dump
  // someone back on the login form with no explanation.
  hasSession: boolean;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, role: User['role'], pod?: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  logout: () => void;
  submitHomework: (moduleId: string, driveLink: string) => void;
  gradeHomework: (submissionId: string, score: 1 | 2 | 3 | 4, feedback: string) => void;
  updateVideoTask: (taskId: string, status: VideoTask['status'], url?: string) => void;
  updateUserAvatar: (userId: string, avatarBase64: string) => void;
  updateModule: (moduleId: string, updates: Partial<Module>) => void;
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
  const [state, setState] = useState<Omit<AppState, 'currentUser'>>(() => {
    const { currentUser, ...rest } = initialData;
    return rest;
  });
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  // Track the real Firebase Auth session AND sync the `users` collection
  // together, because firestore.rules now requires being signed in to read
  // /users. The two used to be separate effects, with the users listener
  // subscribing once at page load (before anyone was signed in) - that first
  // subscription attempt was silently denied (no error handler was attached)
  // and never retried, so after a real sign-in the local `users` list stayed
  // empty forever and `currentUser` could never resolve. Now we tear down and
  // re-create the users listener every time the auth state actually changes.
  useEffect(() => {
    let unsubscribeUsers: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setAuthUid(fbUser ? fbUser.uid : null);

      if (unsubscribeUsers) {
        unsubscribeUsers();
        unsubscribeUsers = null;
      }

      if (!fbUser) {
        // Signed out: nothing to read, and no session to read it with.
        setState(s => ({ ...s, users: [] }));
        setAuthLoading(false);
        return;
      }

      const usersCol = collection(db, 'users');
      unsubscribeUsers = onSnapshot(
        usersCol,
        (snapshot) => {
          const users: User[] = [];
          snapshot.forEach(d => users.push(d.data() as User));
          setState(s => ({ ...s, users }));
          setAuthLoading(false);
        },
        (error) => {
          // Surface Firestore permission/rules errors instead of failing
          // silently - this is exactly the kind of bug that caused the
          // "stuck on loading, never reaches dashboard" symptom above.
          console.error('Error syncing users from Firestore:', error);
          setAuthError('Signed in, but could not load your profile. Please refresh or contact an admin.');
          setAuthLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, []);

  const currentUser = useMemo<User | null>(() => {
    if (!authUid) return null;
    return state.users.find(u => u.id === authUid) ?? null;
  }, [authUid, state.users]);

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

      // Bootstrap rule: if there were no users in the system yet, the very
      // first signup becomes admin regardless of what they picked, so the
      // team always has someone who can administer the platform. After that,
      // role changes must go through an admin (enforced in firestore.rules).
      const existing = await getDocs(collection(db, 'users'));
      const effectiveRole: User['role'] = existing.empty ? 'admin' : role;

      const newUser: User = {
        id: credential.user.uid,
        name,
        email,
        role: effectiveRole,
        pod,
        createdAt: new Date().toISOString(),
      };
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

  const submitHomework = (moduleId: string, driveLink: string) => {
    if (!currentUser) return;
    const newSubmission: Submission = {
      id: `s_${Date.now()}`,
      moduleId,
      userId: currentUser.id,
      driveLink,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      submissions: [...s.submissions.filter(sub => !(sub.moduleId === moduleId && sub.userId === currentUser.id)), newSubmission],
    }));
  };

  // Fixed: admins should also be able to grade homework, not only
  // audio_engineers. Previously this silently no-op'd for admins, which made
  // it look like grading was broken when a director tried it.
  const gradeHomework = (submissionId: string, score: 1 | 2 | 3 | 4, feedback: string) => {
    if (!currentUser || (currentUser.role !== 'audio_engineer' && currentUser.role !== 'admin')) return;
    const newGrade: Grade = {
      id: `g_${Date.now()}`,
      submissionId,
      engineerId: currentUser.id,
      score,
      feedback,
      gradedAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      grades: [...s.grades, newGrade],
      submissions: s.submissions.map((sub) => (sub.id === submissionId ? { ...sub, status: 'graded' } : sub)),
    }));
  };

  const updateVideoTask = (taskId: string, status: VideoTask['status'], url?: string) => {
    setState((s) => ({
      ...s,
      videoTasks: s.videoTasks.map((t) => (t.id === taskId ? { ...t, status, videoUrl: url || t.videoUrl } : t)),
    }));
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setState((s) => ({
      ...s,
      modules: s.modules.map((m) => (m.id === moduleId ? { ...m, ...updates } : m)),
    }));
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        currentUser,
        hasSession: authUid !== null,
        authLoading,
        authError,
        clearAuthError,
        login,
        signup,
        resetPassword,
        logout,
        submitHomework,
        gradeHomework,
        updateVideoTask,
        updateUserAvatar,
        updateModule,
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
