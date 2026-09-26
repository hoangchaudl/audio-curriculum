import React, { useState } from 'react';
import { useAppContext } from '../store';
import { auth } from '../firebase';
import { secondaryBtn } from './assessment/ui';

// Shown to a sound designer who has an account but isn't enrolled in the
// program yet (e.g. an account from before sign-up was invite-only).
// Enrollment appears live, so this page is replaced the moment a
// coordinator enrolls them or their invite is claimed.
export const WaitingView: React.FC = () => {
  const { currentUser, claimInvite, resendVerification } = useAppContext();
  const [message, setMessage] = useState('');
  const verified = !!auth.currentUser?.emailVerified;

  const check = async () => {
    setMessage('Checking…');
    try {
      const result = await claimInvite();
      setMessage(result === 'unverified' ? 'Your email is not verified yet - click the link in the email first.'
        : result === 'no-invite' ? 'No invite for this email yet.' : '');
    } catch (err) {
      console.error('Invite check failed', err);
      setMessage('Something went wrong. Check your connection and try again.');
    }
  };
  const resend = async () => {
    try {
      await resendVerification();
      setMessage(`Verification link sent to ${auth.currentUser?.email}.`);
    } catch (err) {
      console.error('Resend verification failed', err);
      setMessage('Could not send the email. Try again in a minute.');
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-page overflow-y-auto">
      <div className="bg-surface rounded-[32px] p-8 md:p-10 border border-gray-100 shadow-sm max-w-lg text-center space-y-4">
        <p className="text-5xl" aria-hidden="true">🎧</p>
        <h2 className="text-2xl font-black text-[#2E9DF7]">You're in{currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : ''}!</h2>
        <p className="text-sm text-gray-600">
          Your account is ready. A coordinator will add you to the StoryCo Audio Training Program and set your start date and reviewers -
          this page switches to your program as soon as they do.
        </p>
        {!verified && (
          <p className="text-sm text-gray-600 bg-peach rounded-2xl p-4">
            Please verify your email so your invite can be matched to this account.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {!verified && <button onClick={resend} className={secondaryBtn}>Send verification email</button>}
          <button onClick={check} className={secondaryBtn}>Check for my invite</button>
        </div>
        {message && <p className="text-xs font-bold text-gray-600" role="status">{message}</p>}
        <div className="bg-sky text-navy rounded-2xl p-4 text-sm text-left space-y-1">
          <p className="font-black">While you wait</p>
          <p>• Make sure you can open the shared Google Drive and Pro Tools on your workstation.</p>
          <p>• Add a profile photo from the menu at the bottom of the sidebar.</p>
        </div>
        <p className="text-xs text-gray-500">Signed up with the wrong email? Ask your coordinator to send an invite to your StoryCo address.</p>
      </div>
    </main>
  );
};
