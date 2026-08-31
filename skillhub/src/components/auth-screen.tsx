import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type AuthMode = 'login' | 'signup';

export function AuthScreen() {
  const { login, signup, verifyEmail, resendEmailCode } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendBusy, setResendBusy] = useState(false);

  const isSignup = mode === 'signup';
  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (isSignup && fullName.trim().length < 2) {
      setError('Add your name so your learning profile feels like you.');
      return;
    }
    setBusy(true);
    try {
      const result = isSignup
        ? await signup(fullName, email, password)
        : await login(email, password);
      if (result.profileError) {
        const providerContext = [
          result.profileError.message,
          result.profileError.code ? `code: ${result.profileError.code}` : '',
          result.profileError.details ? `details: ${result.profileError.details}` : '',
          result.profileError.hint ? `hint: ${result.profileError.hint}` : '',
        ].filter(Boolean).join(' · ');
        setError(`Your Supabase Auth account was created, but the existing profiles insert failed: ${providerContext}`);
        setMode('login');
        setPassword('');
        return;
      }
      if (result.needsEmailConfirmation) {
        setVerificationOpen(true);
        setVerificationCode('');
        setNotice(`We sent a 6-digit verification code to ${email.trim().toLowerCase()}.`);
        setPassword('');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to continue. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await verifyEmail(email, verificationCode);
      if (result.profileError) {
        const providerContext = [
          result.profileError.message,
          result.profileError.code ? `code: ${result.profileError.code}` : '',
          result.profileError.details ? `details: ${result.profileError.details}` : '',
          result.profileError.hint ? `hint: ${result.profileError.hint}` : '',
        ].filter(Boolean).join(' · ');
        setNotice(`Email verified. Your profile still needs attention: ${providerContext}`);
      }
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'That code could not be verified.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    setResendBusy(true);
    try {
      await resendEmailCode(email);
      setNotice(`A new verification code was sent to ${email.trim().toLowerCase()}.`);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Unable to resend the verification code.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#f8f2e8] px-4 py-6 text-[#1d4348] sm:px-8 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-5xl overflow-hidden rounded-[30px] border border-[#dfd2c0] bg-[#fffaf1] shadow-[0_18px_55px_rgba(29,67,72,.11)] lg:grid-cols-[.9fr_1.1fr]">
        <section className="soft-grid relative hidden overflow-hidden bg-[#1d4348] p-8 text-[#fffaf1] lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="brand-mark text-3xl font-bold tracking-tight text-[#f7c968]">skillhub</span>
              <span className="mt-1 h-2 w-2 rounded-full bg-[#f7c968]" />
            </div>
            <p className="mono mt-16 max-w-xs text-[10px] uppercase tracking-[.2em] text-[#9fc5bd]">A useful place to learn out loud</p>
            <h1 className="display mt-4 max-w-md text-5xl font-bold leading-[1.04]">Keep the question.<br /><span className="text-[#f7c968]">Build the skill.</span></h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#b9d0cc]">Join people who make, fix and figure things out — one practical answer at a time.</p>
          </div>
          <div className="rounded-2xl border border-[#3d6869] bg-[#23484d] p-4">
            <div className="flex items-center gap-2 text-[#f7c968]"><Sparkles size={17} /><span className="text-xs font-bold">Your workshop is waiting</span></div>
            <p className="mt-2 text-xs leading-5 text-[#9db8b2]">Save your field notes, follow people who explain clearly, and keep your progress in one place.</p>
          </div>
        </section>

        <section className="flex items-center p-5 sm:p-10 lg:p-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <div className="flex items-center gap-2">
                <span className="brand-mark text-3xl font-bold tracking-tight text-[#1d4348]">skillhub</span>
                <span className="mt-1 h-2 w-2 rounded-full bg-[#f7c968]" />
              </div>
            </div>
            <p className="mono text-[10px] uppercase tracking-[.2em] text-[#2f817d]">{isSignup ? 'Start building in public' : 'Welcome back'}</p>
            <h2 className="display mt-3 text-4xl font-bold leading-tight">{isSignup ? 'Make room for your next skill.' : 'Pick up where you left off.'}</h2>
            <p className="mt-3 text-sm leading-6 text-[#70878a]">{isSignup ? 'Create your free profile and find your people.' : 'Your circles, courses and practical notes are right here.'}</p>

            {verificationOpen ? <div className="mt-8">
              <div className="rounded-2xl border border-[#b8d0c2] bg-[#e8f0e6] p-4"><p className="text-sm font-bold text-[#286d68]">Check your inbox</p><p className="mt-1 text-xs leading-5 text-[#527075]">Enter the 6-digit code sent to <strong>{email.trim().toLowerCase()}</strong>. Codes can expire, so use the newest one.</p></div>
              <form onSubmit={submitVerification} className="mt-5 space-y-4">
                <label className="block text-xs font-bold text-[#527075]">Verification code<input data-testid="input-auth-verification-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required placeholder="123456" className="mt-2 w-full rounded-xl border border-[#dfd2c0] bg-[#f8f2e8] px-4 py-4 text-center text-2xl font-bold tracking-[.35em] outline-none transition focus:border-[#2f817d] focus:ring-2 focus:ring-[#dceceb]" /></label>
                {error && <p data-testid="text-auth-error" className="rounded-xl border border-[#e9c3b8] bg-[#fff0eb] px-3 py-2.5 text-xs font-bold leading-5 text-[#a24f42]">{error}</p>}
                {notice && <p data-testid="text-auth-notice" className="rounded-xl border border-[#b8d0c2] bg-[#e8f0e6] px-3 py-2.5 text-xs font-bold leading-5 text-[#286d68]">{notice}</p>}
                <button data-testid="button-auth-verify" disabled={busy} type="submit" className="press inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2f817d] px-4 py-3.5 text-sm font-extrabold text-[#fffaf1] shadow-[0_8px_18px_rgba(47,129,125,.2)] transition hover:bg-[#266d69] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Verifying…' : 'Verify email'}{!busy && <ArrowRight size={17} />}</button>
              </form>
              <div className="mt-4 flex items-center justify-between gap-3"><button data-testid="button-auth-resend" type="button" disabled={resendBusy} onClick={() => void resend()} className="text-xs font-bold text-[#2f817d] disabled:opacity-50">{resendBusy ? 'Sending…' : 'Resend code'}</button><button data-testid="button-auth-back" type="button" onClick={() => { setVerificationOpen(false); setError(''); setNotice(''); }} className="text-xs font-bold text-[#789093]">Use a different email</button></div>
            </div> : <>
              <div className="mt-8 flex rounded-xl bg-[#eee3d1] p-1">
                <button data-testid="button-auth-login-mode" onClick={() => switchMode('login')} className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition ${!isSignup ? 'bg-[#fffaf1] text-[#1d4348] shadow-sm' : 'text-[#789093]'}`}>Log in</button>
                <button data-testid="button-auth-signup-mode" onClick={() => switchMode('signup')} className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition ${isSignup ? 'bg-[#fffaf1] text-[#1d4348] shadow-sm' : 'text-[#789093]'}`}>Sign up</button>
              </div>

              <form onSubmit={submit} className="mt-7 space-y-4">
                {isSignup && <label className="block text-xs font-bold text-[#527075]">Full name<div className="relative mt-2"><UserRound className="absolute left-3 top-3.5 text-[#789093]" size={17} /><input data-testid="input-auth-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="e.g. Tobi Adeyemi" className="w-full rounded-xl border border-[#dfd2c0] bg-[#f8f2e8] py-3.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#2f817d] focus:ring-2 focus:ring-[#dceceb]" /></div></label>}
                <label className="block text-xs font-bold text-[#527075]">Email address<div className="relative mt-2"><Mail className="absolute left-3 top-3.5 text-[#789093]" size={17} /><input data-testid="input-auth-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" placeholder="you@example.com" className="w-full rounded-xl border border-[#dfd2c0] bg-[#f8f2e8] py-3.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#2f817d] focus:ring-2 focus:ring-[#dceceb]" /></div></label>
                <label className="block text-xs font-bold text-[#527075]">Password<div className="relative mt-2"><LockKeyhole className="absolute left-3 top-3.5 text-[#789093]" size={17} /><input data-testid="input-auth-password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="At least 6 characters" className="w-full rounded-xl border border-[#dfd2c0] bg-[#f8f2e8] py-3.5 pl-10 pr-11 text-sm outline-none transition focus:border-[#2f817d] focus:ring-2 focus:ring-[#dceceb]" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-2 rounded-lg p-2 text-[#789093] hover:bg-[#eadfce]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>

                {error && <p data-testid="text-auth-error" className="rounded-xl border border-[#e9c3b8] bg-[#fff0eb] px-3 py-2.5 text-xs font-bold leading-5 text-[#a24f42]">{error}</p>}
                {notice && <p data-testid="text-auth-notice" className="rounded-xl border border-[#b8d0c2] bg-[#e8f0e6] px-3 py-2.5 text-xs font-bold leading-5 text-[#286d68]">{notice}</p>}
                <button data-testid="button-auth-submit" disabled={busy} type="submit" className="press mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2f817d] px-4 py-3.5 text-sm font-extrabold text-[#fffaf1] shadow-[0_8px_18px_rgba(47,129,125,.2)] transition hover:bg-[#266d69] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Working…' : isSignup ? 'Create my profile' : 'Log in to SkillHub'}{!busy && <ArrowRight size={17} />}</button>
              </form>
            </>}
            <p className="mt-6 text-center text-[11px] leading-5 text-[#789093]">Your account is secured by Supabase Auth. SkillHub never stores your password.</p>
          </div>
        </section>
      </div>
    </main>
  );
}