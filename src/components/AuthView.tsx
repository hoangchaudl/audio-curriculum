import React, { useState } from 'react';
import { useAppContext } from '../store';

type Mode = 'signin' | 'signup' | 'reset';

export const AuthView: React.FC = () => {
  const { login, signup, resetPassword, authError, clearAuthError } = useAppContext();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'sound_designer' | 'audio_engineer' | 'admin'>('sound_designer');
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
      setSubmitting(true);
      const success = await signup(name, email, password, role, pod);
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
    <div className="flex-1 flex flex-col items-center justify-center bg-[#F5FAFF] p-6 h-screen w-full relative overflow-hidden">
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto bg-white border-[3px] border-black rounded-full flex items-center justify-center mb-6 relative">
            <div className="w-12 h-12 bg-[#2E9DF7] rounded-full"></div>
            <div className="absolute -bottom-2 w-8 h-8 bg-[#F4511E] border-2 border-black rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden="true">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          </div>
          <h1 className="flex flex-col items-center leading-none">
            <span className="flex items-center text-4xl font-black text-black tracking-tight uppercase">
              STORY
              <svg viewBox="0 0 24 24" className="w-7 h-7 -mx-0.5 flex-shrink-0 text-[#3DDC97]" fill="currentColor" aria-hidden="true">
                <path d="M7 2v11h3v9l7-12h-4l4-8z" />
              </svg>
              CO
            </span>
            <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mt-2">Audio Academy</span>
          </h1>
        </div>

        <div className="bg-white rounded-2xl p-8 border-[3px] border-black">
          {mode !== 'reset' && (
            <div className="flex gap-3 mb-8">
              <button
                className={`flex-1 font-black uppercase text-xs tracking-wide py-3 rounded-xl border-2 border-black transition-colors ${mode === 'signin' ? 'bg-[#2E9DF7] text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                onClick={() => switchMode('signin')}
              >
                Sign In
              </button>
              <button
                className={`flex-1 font-black uppercase text-xs tracking-wide py-3 rounded-xl border-2 border-black transition-colors ${mode === 'signup' ? 'bg-[#2E9DF7] text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                onClick={() => switchMode('signup')}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-6">
              <h2 className="text-lg font-black text-black uppercase">Reset your password</h2>
              <p className="text-xs text-gray-500 font-bold mt-1">
                {resetSent
                  ? "Check your inbox for a link to set a new password."
                  : "Enter the email on your account and we'll send you a reset link."}
              </p>
            </div>
          )}

          {displayError && (
            <div className="bg-[#FEE2E2] border-2 border-black text-[#B23A2E] px-4 py-3 rounded-xl text-xs font-bold mb-6 flex items-center gap-2">
              <span className="text-lg">⚠️</span> {displayError}
            </div>
          )}

          {mode === 'reset' && resetSent ? (
            <button
              onClick={() => switchMode('signin')}
              className="w-full bg-white text-black font-black py-4 rounded-xl border-[3px] border-black hover:bg-gray-50 transition-colors text-sm uppercase tracking-wider"
            >
              Back to Sign In
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1 ml-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-black rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                    placeholder="Julian Drake"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1 ml-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-black rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                  placeholder="julian@storyco.example"
                />
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1 ml-1 mr-1">
                    <label className="block text-xs font-black text-gray-500 uppercase">Password</label>
                    {mode === 'signin' && (
                      <button type="button" onClick={() => switchMode('reset')} className="text-xs font-bold text-[#2E9DF7] hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-black rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
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
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1 ml-1">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full bg-gray-50 border-2 border-black rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                    >
                      <option value="sound_designer">Sound Designer</option>
                      <option value="audio_engineer">Audio Engineer</option>
                    </select>
                  </div>
                  {role === 'sound_designer' && (
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase mb-1 ml-1">Pod (Optional)</label>
                      <input
                        type="text"
                        value={pod}
                        onChange={(e) => setPod(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-black rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                        placeholder="e.g. Neon Synthesis"
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    By creating an account, you agree to StoryCo's Terms of Service and Privacy Policy.
                  </p>
                </>
              )}

              <div className={mode === 'signup' ? '' : 'pt-4'}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#F4511E] text-white font-black py-4 rounded-xl border-[3px] border-black hover:bg-black transition-colors text-sm uppercase tracking-wider disabled:opacity-60"
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
                  className="w-full text-center text-xs font-bold text-gray-500 hover:text-black transition-colors"
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
