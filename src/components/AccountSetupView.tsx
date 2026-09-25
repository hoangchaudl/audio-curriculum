import React, { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../store';
import { auth } from '../firebase';
import { primaryBtn, secondaryBtn } from './assessment/ui';

// A signed-in account with no profile yet. Sign-up is invite-only: the
// profile (with the invited role) is created once the person has verified
// their email and an invite exists for it. Re-checks automatically when
// they come back to this tab from the verification email.
export const AccountSetupView: React.FC = () => {
  const { completeAccountSetup, resendVerification, logout } = useAppContext();
  const [status, setStatus] = useState<'checking' | 'unverified' | 'no-invite' | 'error'>('checking');
  const [resent, setResent] = useState(false);
  const email = auth.currentUser?.email ?? 'your email';

  const check = useCallback(() => {
    setStatus('checking');
    completeAccountSetup()
      .then(result => { if (result !== 'done') setStatus(result); })
      .catch(err => { console.error('Account setup failed', err); setStatus('error'); });
  }, [completeAccountSetup]);

  useEffect(() => {
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
    // Run on mount and on focus only (completeAccountSetup is recreated every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async () => {
    try {
      await resendVerification();
      setResent(true);
    } catch (err) {
      console.error('Resend verification failed', err);
      setStatus('error');
    }
  };

  return (
    <main className="flex h-screen w-full items-center justify-center p-6 bg-page overflow-y-auto">
      <div className="bg-surface rounded-[32px] p-8 md:p-10 border border-gray-100 shadow-sm max-w-lg text-center space-y-4" role="status" aria-live="polite">
        {status === 'checking' && <p className="text-sm font-bold text-gray-600">Checking your account…</p>}

        {status === 'unverified' && (
          <>
            <h2 className="text-2xl font-black text-[#2E9DF7]">Check your inbox</h2>
            <p className="text-sm text-gray-600">
              We sent a verification link to <b>{email}</b>. Click it, then come back here - this page continues by itself.
            </p>
            {resent && <p className="text-xs font-bold text-leaf">Sent again - it can take a minute. Check spam too.</p>}
          </>
        )}

        {status === 'no-invite' && (
          <>
            <h2 className="text-2xl font-black text-[#2E9DF7]">No invite for this email</h2>
            <p className="text-sm text-gray-600">
              The StoryCo Audio Training Program is invite-only. Ask your coordinator to invite <b>{email}</b> exactly, then press Check again.
            </p>
          </>
        )}

        {status === 'error' && <p className="text-sm font-bold text-ember">Something went wrong. Check your connection and try again.</p>}

        {status !== 'checking' && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button onClick={check} className={primaryBtn}>{status === 'unverified' ? "I've verified - continue" : 'Check again'}</button>
            {status === 'unverified' && <button onClick={resend} className={secondaryBtn}>Resend email</button>}
            <button onClick={logout} className={secondaryBtn}>Sign out</button>
          </div>
        )}
      </div>
    </main>
  );
};
