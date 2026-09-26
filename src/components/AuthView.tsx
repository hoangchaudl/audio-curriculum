import React, { useState } from 'react';
import { useAppContext } from '../store';

type Mode = 'signin' | 'signup' | 'reset';

export const AuthView: React.FC = () => {
  const { login, signup, resetPassword, authError, clearAuthError } = useAppContext();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pod, setPod] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setResetSent(false);
    clearAuthError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearAuthError();

    if (mode === 'reset') {
      if (!email) {
        setError('Enter your email address');
        return;
      }
      setSubmitting(true);
      const success = await resetPassword(email);
      setSubmitting(false);
      if (success) setResetSent(true);
      return;
    }

    if (mode === 'signup') {
      if (!name || !email || !password) {
        setError('Name, email, and password are required');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      // Invite-only: the role comes from the admin's invite for this email,
      // applied once the email is verified (see AccountSetupView).
      setSubmitting(true);
      const success = await signup(name, email, password, pod);
      setSubmitting(false);
      if (!success) {
        setError('Error creating account');
      }
    } else {
      if (!email || !password) {
        setError('Email and password are required');
        return;
      }
      setSubmitting(true);
      const success = await login(email, password);
      setSubmitting(false);
      if (!success) {
        setError('Incorrect email or password.');
      }
    }
  };

  // authError comes from Firebase Auth itself (wrong password, no such
  // account, weak password, etc.) and is more specific than the generic
  // messages above - prefer it when present.
  const displayError = authError || error;

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-page p-6 h-screen w-full relative overflow-hidden">
      {/* Doraemon-inspired decorative elements */}
      <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-[#2E9DF7] rounded-full opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-150px] right-[-50px] w-[500px] h-[500px] bg-[#F4511E] rounded-full opacity-10 pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto bg-surface shadow-xl border-4 border-page rounded-full flex items-center justify-center mb-6 relative">
            <div className="w-12 h-12 bg-[#2E9DF7] rounded-full"></div>
            <div className="absolute -bottom-2 w-8 h-8 bg-[#F4511E] border-4 border-surface rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden="true">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          </div>
          <h1 className="flex flex-col items-center leading-none">
            <img src="/storyco-logo-text-light.png" alt="StoryCo" className="h-9 w-auto dark:hidden" />
            <img src="/storyco-logo-text-dark.png" alt="" aria-hidden="true" className="h-9 w-auto hidden dark:block" />
            <span className="text-sm font-bold uppercase tracking-[0.3em] text-gray-500 mt-2">Audio Training Program</span>
          </h1>
        </div>

        <div className="bg-surface rounded-[40px] p-8 shadow-2xl border-4 border-surface">
          {mode !== 'reset' && (
            <div className="flex gap-4 mb-8">
              <button
                className={`flex-1 font-bold py-3 rounded-2xl transition-all ${mode === 'signin' ? 'bg-[#2E9DF7] text-white shadow-[0_4px_0_#1b85df] active:translate-y-[2px] active:shadow-none' : 'bg-sky text-navy hover:bg-[#2E9DF7]/20'}`}
                onClick={() => switchMode('signin')}
              >
                Sign In
              </button>
              <button
                className={`flex-1 font-bold py-3 rounded-2xl transition-all ${mode === 'signup' ? 'bg-[#2E9DF7] text-white shadow-[0_4px_0_#1b85df] active:translate-y-[2px] active:shadow-none' : 'bg-sky text-navy hover:bg-[#2E9DF7]/20'}`}
                onClick={() => switchMode('signup')}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-6">
              <h2 className="text-lg font-black text-[#2E9DF7]">Reset your password</h2>
              <p className="text-xs text-gray-500 font-bold mt-1">
                {resetSent
                  ? "Check your inbox for a link to set a new password."
                  : "Enter the email on your account and we'll send you a reset link."}
              </p>
            </div>
          )}

          {displayError && (
            <div className="bg-rose text-ember px-4 py-3 rounded-2xl text-xs font-bold mb-6 flex items-center gap-2">
              <span className="text-lg">⚠️</span> {displayError}
            </div>
          )}

          {mode === 'reset' && resetSent ? (
            <button
              onClick={() => switchMode('signin')}
              className="w-full bg-sky text-navy font-bold py-4 rounded-2xl hover:bg-[#2E9DF7]/20 transition-colors text-sm uppercase tracking-wider"
            >
              Back to Sign In
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-full-name" className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Full Name</label>
                  <input id="auth-full-name" autoComplete="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-50 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                    placeholder="Julian Drake"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email-address" className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email Address</label>
                <input id="auth-email-address" autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                  placeholder="julian@storyco.example"
                />
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1 ml-1 mr-1">
                    <label htmlFor="auth-password" className="block text-xs font-bold text-gray-500 uppercase">Password</label>
                    {mode === 'signin' && (
                      <button type="button" onClick={() => switchMode('reset')} className="text-xs font-bold text-[#2E9DF7] hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input id="auth-password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                    placeholder="••••••••"
                  />
                  {mode === 'signup' && (
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Minimum 6 characters.</p>
                  )}
                </div>
              )}

              {mode === 'signup' && (
                <>
                  <div>
                    <label htmlFor="auth-pod-optional" className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Pod (Optional)</label>
                    <input id="auth-pod-optional"
                      type="text"
                      value={pod}
                      onChange={(e) => setPod(e.target.value)}
                      className="w-full bg-gray-50 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                      placeholder="e.g. Neon Synthesis"
                    />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Sign-up is by invitation. Use the exact email address your coordinator invited - we'll send it a verification link.
                  </p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    By creating an account, you agree to StoryCo's Terms of Service and Privacy Policy.
                  </p>
                </>
              )}

              <div className={mode === 'signup' ? '' : 'pt-4'}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#F4511E] text-white font-bold py-4 rounded-2xl transition-all text-sm uppercase tracking-wider disabled:opacity-60 shadow-[0_6px_0_#C53914] active:shadow-none active:translate-y-[2px]"
                >
                  {submitting
                    ? 'Please wait…'
                    : mode === 'reset' ? 'Send Reset Link' : mode === 'signup' ? 'Create Account' : 'Sign In'}
                </button>
              </div>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full text-center text-xs font-bold text-gray-500 hover:text-[#2E9DF7] transition-colors"
                >
                  Back to Sign In
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
