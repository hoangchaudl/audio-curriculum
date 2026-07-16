import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, User, Module, Submission, Grade, VideoTask } from './types';
import { initialData } from './data';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, writeBatch, getDocs } from 'firebase/firestore';

interface AppContextType extends AppState {
  login: (email: string) => void;
  logout: () => void;
  submitHomework: (moduleId: string, driveLink: string) => void;
  gradeHomework: (submissionId: string, score: 1 | 2 | 3 | 4, feedback: string) => void;
  updateVideoTask: (taskId: string, status: VideoTask['status'], url?: string) => void;
  updateUserAvatar: (userId: string, avatarBase64: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialData);

  // Sync users with Firestore
  useEffect(() => {
    const usersCol = collection(db, 'users');
    
    // Seed data if empty
    getDocs(usersCol).then(snapshot => {
      if (snapshot.empty) {
        const batch = writeBatch(db);
        initialData.users.forEach(user => {
          const userRef = doc(db, 'users', user.id);
          batch.set(userRef, user);
        });
        batch.commit().catch(console.error);
      }
    });

    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      const users: User[] = [];
      snapshot.forEach(doc => {
        users.push(doc.data() as User);
      });
      if (users.length > 0) {
        setState(s => ({
          ...s,
          users,
          // Update currentUser if it matches an updated user
          currentUser: s.currentUser ? users.find(u => u.id === s.currentUser!.id) || s.currentUser : s.currentUser
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-login as Julian for dev purposes based on theme HTML
  useEffect(() => {
    login('julian@storyco.example');

    const handleSwitchUser = (e: any) => {
      login(e.detail);
    };
    window.addEventListener('switch-user', handleSwitchUser);
    return () => window.removeEventListener('switch-user', handleSwitchUser);
  }, []);

  const login = (email: string) => {
    // Look up from local state first
    setState((s) => {
       const user = s.users.find((u) => u.email === email);
       if (user) {
         return { ...s, currentUser: user };
       }
       return s;
    });
  };

  const logout = () => {
    setState((s) => ({ ...s, currentUser: null }));
  };

  const updateUserAvatar = async (userId: string, avatarBase64: string) => {
    // We update Firestore, onSnapshot will reflect the change in local state
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { avatarBase64 }, { merge: true });
    } catch (error) {
      console.error("Error updating avatar in Firestore", error);
    }
  };

  const submitHomework = (moduleId: string, driveLink: string) => {
    if (!state.currentUser) return;
    const newSubmission: Submission = {
      id: `s_${Date.now()}`,
      moduleId,
      userId: state.currentUser.id,
      driveLink,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      submissions: [...s.submissions.filter(sub => !(sub.moduleId === moduleId && sub.userId === state.currentUser!.id)), newSubmission],
    }));
  };

  const gradeHomework = (submissionId: string, score: 1 | 2 | 3 | 4, feedback: string) => {
    if (!state.currentUser || state.currentUser.role !== 'audio_engineer') return;
    const newGrade: Grade = {
      id: `g_${Date.now()}`,
      submissionId,
      engineerId: state.currentUser.id,
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

  return (
    <AppContext.Provider value={{ ...state, login, logout, submitHomework, gradeHomework, updateVideoTask }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
