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
  const { currentUser, modules } = useAppContext();
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


