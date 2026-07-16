import React, { useState, useRef } from 'react';
import { useAppContext } from '../store';

export const ProfileView: React.FC = () => {
  const { currentUser, updateUserAvatar } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return <div className="p-10">Not logged in</div>;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      updateUserAvatar(currentUser.id, base64String);
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-[#F5FAFF]">
      <header className="h-20 bg-white border-b-[3px] border-black flex items-center justify-between px-10 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-black text-black">My Profile</h2>
          <p className="text-xs text-gray-500 font-bold">Manage your personal information</p>
        </div>
      </header>

      <div className="flex-1 p-10 overflow-y-auto flex justify-center">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-2xl p-10 border-[3px] border-black flex flex-col items-center">

            <div className="relative mb-8 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-32 h-32 rounded-full overflow-hidden border-[3px] border-black flex items-center justify-center bg-[#E0F2FE]">
                {currentUser.avatarBase64 ? (
                  <img src={currentUser.avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-[#2E9DF7]">{currentUser.name.substring(0,2).toUpperCase()}</span>
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-black uppercase tracking-wider">Change</span>
              </div>
              <div className="absolute bottom-0 right-0 w-10 h-10 bg-[#F4511E] border-2 border-black rounded-full flex items-center justify-center pointer-events-none">
                <span className="text-white text-lg">📷</span>
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />

            <h3 className="text-2xl font-black text-black mb-1">{currentUser.name}</h3>
            <div className="flex items-center gap-2 mb-8">
              <span className="bg-[#E0F2FE] text-[#1E40AF] border-2 border-black px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                {currentUser.role.replace('_', ' ')}
              </span>
              {currentUser.pod && (
                <span className="bg-gray-100 text-gray-600 border-2 border-black px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                  Pod: {currentUser.pod}
                </span>
              )}
            </div>

            <div className="w-full space-y-4">
               <div className="bg-gray-50 border-2 border-black p-4 rounded-xl">
                  <p className="text-xs text-gray-500 font-black uppercase mb-1">Email</p>
                  <p className="text-sm font-bold text-gray-800">{currentUser.email}</p>
               </div>
               <div className="bg-gray-50 border-2 border-black p-4 rounded-xl">
                  <p className="text-xs text-gray-500 font-black uppercase mb-1">Member Since</p>
                  <p className="text-sm font-bold text-gray-800">{new Date(currentUser.createdAt).toLocaleDateString()}</p>
               </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
};
