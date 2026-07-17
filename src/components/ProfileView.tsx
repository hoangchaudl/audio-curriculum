import React, { useRef, useState } from 'react';
import { useAppContext } from '../store';

// Keeps avatars small enough that a phone photo (often several MB) can't
// blow past Firestore's 1MB document limit. avatarBase64 lives on the
// /users/{uid} doc that every signed-in user reads via a live listener (see
// store.tsx), so an oversized one doesn't just fail to save for its owner -
// it silently breaks reads of the whole users collection for everyone else.
// Resizing to a small square JPEG client-side keeps every avatar in the
// tens-of-KB range regardless of the source photo.
const MAX_AVATAR_DIMENSION = 256;
const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;

const resizeImageToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (file.size > MAX_SOURCE_FILE_BYTES) {
      reject(new Error('That image is too large. Please choose a smaller photo.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Image resizing is not supported in this browser.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

export const ProfileView: React.FC = () => {
  const { currentUser, updateUserAvatar, updateUserName, resetPassword } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUser?.name || '');
  const [passwordResetState, setPasswordResetState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (!currentUser) return <div className="p-10">Not logged in</div>;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      updateUserAvatar(currentUser.id, dataUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not update your photo.');
    } finally {
      e.target.value = '';
    }
  };

  const startEditingName = () => {
    setNameInput(currentUser.name);
    setEditingName(true);
  };

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== currentUser.name) {
      updateUserName(currentUser.id, trimmed);
    }
    setEditingName(false);
  };

  const handleSendPasswordReset = async () => {
    setPasswordResetState('sending');
    const ok = await resetPassword(currentUser.email);
    setPasswordResetState(ok ? 'sent' : 'error');
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F5FAFF]">
      <header className="min-h-20 bg-white border-b-[3px] border-black flex items-center gap-4 px-4 md:px-10 py-3 flex-shrink-0">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-module'))}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center border-2 border-black rounded-lg bg-white hover:bg-gray-50 transition-colors"
          title="Back to course"
          aria-label="Back to course"
        >
          ←
        </button>
        <div>
          <h2 className="text-2xl font-black text-black">My Profile</h2>
          <p className="text-xs text-gray-500 font-bold">Manage your personal information</p>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-10 overflow-y-auto flex justify-center">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-2xl p-6 md:p-10 border-[3px] border-black flex flex-col items-center">

            <div className="relative mb-4 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-32 h-32 rounded-full overflow-hidden border-[3px] border-black flex items-center justify-center bg-[#E0F2FE]">
                {currentUser.avatarBase64 ? (
                  <img src={currentUser.avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-[#2E9DF7]">{currentUser.name.substring(0, 2).toUpperCase()}</span>
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
            {avatarError && (
              <p className="text-xs font-bold text-[#B23A2E] mb-4 text-center">{avatarError}</p>
            )}

            {editingName ? (
              <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  autoFocus
                  className="text-xl font-black text-black text-center bg-gray-50 border-2 border-black rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-[#2E9DF7] transition-all"
                />
                <button
                  onClick={saveName}
                  disabled={!nameInput.trim()}
                  className="text-xs font-black uppercase text-white bg-[#2E9DF7] border-2 border-black px-3 py-1.5 rounded-full hover:bg-black transition-colors disabled:bg-gray-200 disabled:text-gray-400"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="text-xs font-black uppercase text-gray-600 bg-white border-2 border-black px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={startEditingName} className="group/name flex items-center gap-2 mb-1" title="Edit name">
                <h3 className="text-2xl font-black text-black">{currentUser.name}</h3>
                <span className="text-xs text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity">✏️</span>
              </button>
            )}

            <div className="flex items-center gap-2 mb-8 mt-1">
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
               <div className="bg-gray-50 border-2 border-black p-4 rounded-xl">
                  <p className="text-xs text-gray-500 font-black uppercase mb-2">Password</p>
                  {passwordResetState === 'sent' ? (
                    <p className="text-sm font-bold text-[#2A8F62]">✓ Reset link sent to {currentUser.email} - check your inbox.</p>
                  ) : (
                    <button
                      onClick={handleSendPasswordReset}
                      disabled={passwordResetState === 'sending'}
                      className="text-xs font-black uppercase text-white bg-[#2E9DF7] border-2 border-black px-4 py-2 rounded-full hover:bg-black transition-colors disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      {passwordResetState === 'sending' ? 'Sending...' : 'Send Password Reset Email'}
                    </button>
                  )}
                  {passwordResetState === 'error' && (
                    <p className="text-xs font-bold text-[#B23A2E] mt-2">Something went wrong. Please try again.</p>
                  )}
               </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
};
