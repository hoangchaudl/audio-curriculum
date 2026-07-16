import React, { useState } from 'react';
import { useAppContext } from '../store';

export const AuthView: React.FC = () => {
  const { login, signup } = useAppContext();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // Not authenticated securely for prototype, but keep field for UI
  const [name, setName] = useState('');
  const [role, setRole] = useState<'sound_designer' | 'audio_engineer' | 'admin'>('sound_designer');
  const [pod, setPod] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSignUp) {
      if (!name || !email) {
        setError('Name and email are required');
        return;
      }
      const success = await signup(name, email, role, pod);
      if (!success) {
        setError('Error creating account');
      }
    } else {
      if (!email) {
        setError('Email is required');
        return;
      }
      const success = login(email);
      if (!success) {
        setError('Account not found. Please try another email or sign up.');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#FDFDFB] p-6 h-screen w-full relative overflow-hidden">
      {/* Doraemon-inspired decorative elements */}
      <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-[#2E9DF7] rounded-full opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-150px] right-[-50px] w-[500px] h-[500px] bg-[#F4511E] rounded-full opacity-10 pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-[#FDFDFB] mb-6 relative">
            <div className="w-12 h-12 bg-[#2E9DF7] rounded-full"></div>
            {/* Bell/Collar Accent */}
            <div className="absolute -bottom-2 w-8 h-8 bg-[#F4511E] rounded-full border-4 border-white flex items-center justify-center">
              <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
            </div>
          </div>
          <h1 className="text-4xl font-black text-[#2E9DF7] tracking-tight mb-2">StoryCo Audio</h1>
          <p className="text-gray-500 font-bold tracking-wide uppercase text-sm">Curriculum Platform</p>
        </div>

        <div className="bg-white rounded-[40px] p-8 shadow-2xl border-4 border-white">
          <div className="flex gap-4 mb-8">
            <button 
              className={`flex-1 font-bold py-3 rounded-2xl transition-all ${!isSignUp ? 'bg-[#2E9DF7] text-white shadow-[0_4px_0_#1b85df] active:translate-y-[2px] active:shadow-none' : 'bg-[#E0F2FE] text-[#1E40AF] hover:bg-[#2E9DF7]/20'}`}
              onClick={() => { setIsSignUp(false); setError(''); }}
            >
              Sign In
            </button>
            <button 
              className={`flex-1 font-bold py-3 rounded-2xl transition-all ${isSignUp ? 'bg-[#2E9DF7] text-white shadow-[0_4px_0_#1b85df] active:translate-y-[2px] active:shadow-none' : 'bg-[#E0F2FE] text-[#1E40AF] hover:bg-[#2E9DF7]/20'}`}
              onClick={() => { setIsSignUp(true); setError(''); }}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="bg-[#FEE2E2] text-[#C53914] px-4 py-3 rounded-2xl text-xs font-bold mb-6 flex items-center gap-2">
              <span className="text-lg">⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                  placeholder="Julian Drake"
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                placeholder="julian@storyco.example"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                placeholder="••••••••"
              />
            </div>

            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Role</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                  >
                    <option value="sound_designer">Sound Designer</option>
                    <option value="audio_engineer">Audio Engineer</option>
                  </select>
                </div>
                {role === 'sound_designer' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Pod (Optional)</label>
                    <input 
                      type="text" 
                      value={pod}
                      onChange={(e) => setPod(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#2E9DF7] transition-all font-medium"
                      placeholder="e.g. Neon Synthesis"
                    />
                  </div>
                )}
              </>
            )}

            <div className="pt-4">
              <button 
                type="submit" 
                className="w-full bg-[#F4511E] text-white font-bold py-4 rounded-2xl shadow-[0_6px_0_#C53914] active:shadow-none active:translate-y-[2px] transition-all text-sm uppercase tracking-wider"
              >
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </div>
          </form>

          {!isSignUp && (
            <div className="mt-8 text-center bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200">
              <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Dev Shortcuts</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={() => { setEmail('julian@storyco.example'); setPassword('password'); }} className="text-xs bg-white border px-3 py-1 rounded-full font-bold text-[#2E9DF7] hover:bg-gray-100">Designer</button>
                <button onClick={() => { setEmail('sarah@storyco.example'); setPassword('password'); }} className="text-xs bg-white border px-3 py-1 rounded-full font-bold text-[#F4511E] hover:bg-gray-100">Engineer</button>
                <button onClick={() => { setEmail('admin@storyco.example'); setPassword('password'); }} className="text-xs bg-white border px-3 py-1 rounded-full font-bold text-[#3DDC97] hover:bg-gray-100">Admin</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
