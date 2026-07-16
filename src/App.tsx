/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ModuleView } from './components/ModuleView';
import { EngineerDashboard } from './components/EngineerDashboard';
import { ProfileView } from './components/ProfileView';
import { AuthView } from './components/AuthView';
import { AdminDashboard } from './components/AdminDashboard';
import { AppProvider, useAppContext } from './store';

const AppContent = () => {
  const { currentUser, authLoading, hasSession, authError, logout } = useAppContext();
  const [selectedModuleId, setSelectedModuleId] = useState<string>('m4');
  const [view, setView] = useState<'module' | 'profile'>('module');

  // Listen to custom event from sidebar to open profile
  useEffect(() => {
    const handleOpenProfile = () => setView('profile');
    const handleOpenModule = () => setView('module');
    window.addEventListener('open-profile', handleOpenProfile);
    window.addEventListener('open-module', handleOpenModule);
    return () => {
      window.removeEventListener('open-profile', handleOpenProfile);
      window.removeEventListener('open-module', handleOpenModule);
    };
  }, []);

  // Wait for Firebase Auth to report the real session before deciding
  // whether to show the sign-in screen - otherwise there's a flash of the
  // login page for already-signed-in users on every refresh.
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FDFDFB] text-gray-400 font-bold text-sm">
        Loading...
      </div>
    );
  }

  // Signed in (Firebase Auth confirms a real session) but no matching
  // /users/{uid} profile doc could be loaded - either it's still arriving
  // (rare race) or something failed while writing it during signup. Showing
  // the sign-in form here would be confusing since the person IS signed in;
  // show a clear message with a way out instead.
  if (hasSession && !currentUser) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[#FDFDFB] px-6 text-center">
        <p className="text-sm font-bold text-gray-600 max-w-sm">
          {authError || "You're signed in, but we couldn't load your profile yet."}
        </p>
        <button
          onClick={logout}
          className="text-xs font-bold text-white bg-[#2E9DF7] px-5 py-2.5 rounded-full hover:bg-[#1b85df] transition-colors"
        >
          Sign out and try again
        </button>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView />;
  }

  const renderContent = () => {
    if (view === 'profile') {
      return <ProfileView />;
    }
    
    if (currentUser.role === 'sound_designer') {
      return <ModuleView moduleId={selectedModuleId} />;
    }
    
    if (currentUser.role === 'audio_engineer') {
      return <EngineerDashboard moduleId={selectedModuleId} />;
    }
    
    if (currentUser.role === 'admin') {
      return <AdminDashboard />;
    }
    return null;
  };

  return (
    <div className="flex h-screen w-full bg-[#FDFDFB] text-[#2D2D2D] font-sans overflow-hidden">
      <Sidebar 
        selectedModuleId={selectedModuleId} 
        setSelectedModuleId={(id) => {
          setSelectedModuleId(id);
          setView('module');
        }} 
      />
      {renderContent()}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}


