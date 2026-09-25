import React from 'react';
import { useAppContext } from '../store';

// Shown to a sound designer who has an account but isn't enrolled in the
// program yet (e.g. signed up without an invite). Enrollment appears live, so this page is replaced the moment
// a coordinator enrolls them.
export const WaitingView: React.FC = () => {
  const { currentUser } = useAppContext();
  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-page overflow-y-auto">
      <div className="bg-surface rounded-[32px] p-8 md:p-10 border border-gray-100 shadow-sm max-w-lg text-center space-y-4">
        <p className="text-5xl" aria-hidden="true">🎧</p>
        <h2 className="text-2xl font-black text-[#2E9DF7]">You're in{currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : ''}!</h2>
        <p className="text-sm text-gray-600">
          Your account is ready. A coordinator will add you to the StoryCo Audio Training Program and set your start date and reviewers -
          this page switches to your program as soon as they do.
        </p>
        <div className="bg-sky text-navy rounded-2xl p-4 text-sm text-left space-y-1">
          <p className="font-black">While you wait</p>
          <p>• Make sure you can open the shared Google Drive and Pro Tools on your workstation.</p>
          <p>• Add a profile photo from the menu at the bottom of the sidebar.</p>
        </div>
        <p className="text-xs text-gray-400">Signed up with the wrong email? Ask your coordinator to send an invite to your StoryCo address.</p>
      </div>
    </main>
  );
};
