import React, { useState } from 'react';
import { useAppContext } from '../store';
import { AuthShell } from './AuthShell';
import { setStoredTheme, useResolvedTheme } from '../theme';

// Sign-in page only: Vietnamese for the visible text. The language choice shares the
// Audio Hub's key, so it carries over between the two sign-in pages.
const VI: Record<string, string> = {
 "Sign In": "Đăng nhập",
 "Sign Up": "Đăng ký",
 "Reset your password": "Đặt lại mật khẩu",
 "Check your inbox for a link to set a new password.": "Kiểm tra hộp thư để lấy link đặt mật khẩu mới.",
 "Enter the email on your account and we'll send you a reset link.": "Nhập email của tài khoản, chúng tôi sẽ gửi link đặt lại mật khẩu.",
 "Back to Sign In": "Quay lại đăng nhập",
 "Full Name": "Họ và tên",
 "Email Address": "Địa chỉ email",
 "Password": "Mật khẩu",
 "Confirm Password": "Xác nhận mật khẩu",
 "Forgot password?": "Quên mật khẩu?",
 "Minimum 6 characters.": "Tối thiểu 6 ký tự.",
 "Pod (Optional)": "Pod (không bắt buộc)",
 "Sign-up is by invitation. Use the exact email address your coordinator invited - we'll send it a verification link.": "Đăng ký theo lời mời. Dùng đúng email mà điều phối viên đã mời, chúng tôi sẽ gửi link xác minh tới email đó.",
 "By creating an account, you agree to StoryCo's Terms of Service and Privacy Policy.": "Khi tạo tài khoản, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của StoryCo.",
 "Please wait…": "Vui lòng đợi…",
 "Send Reset Link": "Gửi link đặt lại",
 "Create Account": "Tạo tài khoản",
 "Enter your email address": "Nhập địa chỉ email",
 "Name, email, and password are required": "Cần nhập tên, email và mật khẩu",
 "Password must be at least 6 characters": "Mật khẩu phải có ít nhất 6 ký tự",
 "Passwords do not match": "Mật khẩu xác nhận không khớp",
 "Error creating account": "Lỗi khi tạo tài khoản",
 "Email and password are required": "Cần nhập email và mật khẩu",
 "Incorrect email or password.": "Email hoặc mật khẩu không đúng.",
 "Where do you want to sign in?": "Bạn muốn đăng nhập vào đâu?",
 "Audio Hub": "Audio Hub",
 "Audio Training Program": "Chương trình đào tạo Audio",
 "SOPs, checklists, schedules, workshops and resources for the team.": "SOP, checklist, lịch, workshop và tài nguyên cho cả team.",
 "Lessons, assignments, trials and reviews for trainees and reviewers.": "Bài học, bài tập, bài thử và đánh giá cho học viên và reviewer.",
 "Choose another place": "Chọn nơi khác",
 "Audio": "Audio",
 "Language": "Ngôn ngữ"
};
const readLang = (): 'en' | 'vi' => { try { return localStorage.getItem('opsLanguage') === 'vi' ? 'vi' : 'en'; } catch { return 'en'; } };

type Mode = 'signin' | 'signup' | 'reset';

export const AuthView: React.FC = () => {
  const { login, signup, resetPassword, authError, clearAuthError } = useAppContext();
  const [lang, setLang] = useState(readLang);
  const t = (text: string) => (lang === 'vi' ? VI[text] ?? text : text);
  const chooseLang = (l: 'en' | 'vi') => { setLang(l); try { localStorage.setItem('opsLanguage', l); } catch { /* lasts until reload */ } };
  const isDark = useResolvedTheme(null) === 'dark';
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [pod, setPod] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Which product the person is signing in to; the Audio Hub has its own sign-in at /audiohub/.
  const [area, setArea] = useState<'' | 'training'>('');

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
        setError(t('Enter your email address'));
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
        setError(t('Name, email, and password are required'));
        return;
      }
      if (password.length < 6) {
        setError(t('Password must be at least 6 characters'));
        return;
      }
      if (password !== confirmPassword) {
        setError(t('Passwords do not match'));
        return;
      }
      // Invite-only: the role comes from the admin's invite for this email,
      // applied once the email is verified (see AccountSetupView).
      setSubmitting(true);
      const success = await signup(name, email, password, pod);
      setSubmitting(false);
      if (!success) {
        setError(t('Error creating account'));
      }
    } else {
      if (!email || !password) {
        setError(t('Email and password are required'));
        return;
      }
      setSubmitting(true);
      const success = await login(email, password);
      setSubmitting(false);
      if (!success) {
        setError(t('Incorrect email or password.'));
      }
    }
  };

  // authError comes from Firebase Auth itself (wrong password, no such
  // account, weak password, etc.) and is more specific than the generic
  // messages above - prefer it when present.
  const displayError = authError || error;

  return (
    <AuthShell subtitle={t(area ? 'Audio Training Program' : 'Audio Team')}
      language={{ label: t('Language'), value: lang, onChange: chooseLang }}
      isDark={isDark} onTheme={dark => setStoredTheme(dark ? 'dark' : 'light')}
      back={area ? <button type="button" onClick={() => { setArea(''); switchMode('signin'); }}>← {t('Choose another place')}</button> : undefined}>
        {!area ? (
          <div className="bg-surface rounded-2xl p-8 shadow-2xl border-4 border-surface space-y-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase text-center">{t('Where do you want to sign in?')}</h2>
            <a href="/audiohub/" className="block rounded-2xl bg-sky hover:bg-brand/20 transition-colors p-5">
              <span className="block font-bold text-navy text-lg">{t('Audio Hub')}</span>
              <span className="block text-xs font-bold text-gray-500 mt-1">{t('SOPs, checklists, schedules, workshops and resources for the team.')}</span>
            </a>
            <button type="button" onClick={() => setArea('training')} className="block w-full text-left rounded-2xl bg-sky hover:bg-brand/20 transition-colors p-5">
              <span className="block font-bold text-navy text-lg">{t('Audio Training Program')}</span>
              <span className="block text-xs font-bold text-gray-500 mt-1">{t('Lessons, assignments, trials and reviews for trainees and reviewers.')}</span>
            </button>
          </div>
        ) : (
          <>
        <div className="bg-surface rounded-2xl p-8 shadow-2xl border-4 border-surface">
          {mode !== 'reset' && (
            <div className="flex gap-4 mb-8">
              <button
                className={`flex-1 font-bold py-3 rounded-2xl transition-all ${mode === 'signin' ? 'bg-brand text-white active:translate-y-[2px] active:shadow-none' : 'bg-sky text-navy hover:bg-brand/20'}`}
                onClick={() => switchMode('signin')}
              >
                {t('Sign In')}
              </button>
              <button
                className={`flex-1 font-bold py-3 rounded-2xl transition-all ${mode === 'signup' ? 'bg-brand text-white active:translate-y-[2px] active:shadow-none' : 'bg-sky text-navy hover:bg-brand/20'}`}
                onClick={() => switchMode('signup')}
              >
                {t('Sign Up')}
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-brand">{t('Reset your password')}</h2>
              <p className="text-xs text-gray-500 font-bold mt-1">
                {resetSent
                  ? t("Check your inbox for a link to set a new password.")
                  : t("Enter the email on your account and we'll send you a reset link.")}
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
              className="w-full bg-sky text-navy font-bold py-4 rounded-2xl hover:bg-brand/20 transition-colors text-sm uppercase tracking-wider"
            >
              {t('Back to Sign In')}
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-full-name" className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{t('Full Name')}</label>
                  <input id="auth-full-name" autoComplete="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand transition-all font-medium"
                    placeholder="Julian Drake"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email-address" className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{t('Email Address')}</label>
                <input id="auth-email-address" autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand transition-all font-medium"
                  placeholder="julian@storyco.example"
                />
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1 ml-1 mr-1">
                    <label htmlFor="auth-password" className="block text-xs font-bold text-gray-500 uppercase">{t('Password')}</label>
                    {mode === 'signin' && (
                      <button type="button" onClick={() => switchMode('reset')} className="text-xs font-bold text-brand hover:underline">
                        {t('Forgot password?')}
                      </button>
                    )}
                  </div>
                  <input id="auth-password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand transition-all font-medium"
                    placeholder="••••••••"
                  />
                  {mode === 'signup' && (
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">{t('Minimum 6 characters.')}</p>
                  )}
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-confirm-password" className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{t('Confirm Password')}</label>
                  <input id="auth-confirm-password" autoComplete="new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>
              )}

              {mode === 'signup' && (
                <>
                  <div>
                    <label htmlFor="auth-pod-optional" className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{t('Pod (Optional)')}</label>
                    <input id="auth-pod-optional"
                      type="text"
                      value={pod}
                      onChange={(e) => setPod(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand transition-all font-medium"
                      placeholder="e.g. Neon Synthesis"
                    />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {t("Sign-up is by invitation. Use the exact email address your coordinator invited - we'll send it a verification link.")}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    {t("By creating an account, you agree to StoryCo's Terms of Service and Privacy Policy.")}
                  </p>
                </>
              )}

              <div className={mode === 'signup' ? '' : 'pt-4'}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-warm text-white font-bold py-4 rounded-2xl transition-all text-sm uppercase tracking-wider disabled:opacity-60 active:shadow-none active:translate-y-[2px]"
                >
                  {submitting
                    ? t('Please wait…')
                    : t(mode === 'reset' ? 'Send Reset Link' : mode === 'signup' ? 'Create Account' : 'Sign In')}
                </button>
              </div>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full text-center text-xs font-bold text-gray-500 hover:text-brand transition-colors"
                >
                  {t('Back to Sign In')}
                </button>
              )}
            </form>
          )}
        </div>
          </>
        )}
    </AuthShell>
  );
};
