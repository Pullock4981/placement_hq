'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ArrowRight, AtSign, BriefcaseBusiness, CheckCircle2, Eye, EyeOff, Hash, Loader2, Lock, Mail, Sparkles, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REGISTRATION_TEAM_ROLE_OPTIONS } from '@/constants';
import { LoginSchema, RegisterSchema, type LoginInput, type RegisterInput } from '@/lib/validators/auth.schema';

type AuthMode = 'login' | 'register';

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs font-medium text-rose-500">{message}</p> : null;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const loginForm = useForm<LoginInput>({ resolver: zodResolver(LoginSchema), defaultValues: { email: '', password: '' } });
  const registerForm = useForm<RegisterInput>({ resolver: zodResolver(RegisterSchema), defaultValues: { name: '', email: '', teamRole: 'mentor', discordUsername: '', discordUserId: '', password: '' } });
  const isSubmitting = loginForm.formState.isSubmitting || registerForm.formState.isSubmitting;

  async function onLogin(values: LoginInput) {
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) return void toast.error(data.message || 'Unable to sign in.');
      toast.success(`Welcome back, ${data.user.name}!`);
      router.replace(data.redirectTo);
      router.refresh();
    } catch {
      toast.error('Could not reach the server. Please try again.');
    }
  }

  async function onRegister(values: RegisterInput) {
    try {
      const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) return void toast.error(data.message || 'Unable to create your account.');
      setPendingEmail(values.email);
      registerForm.reset();
    } catch {
      toast.error('Could not reach the server. Please try again.');
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPendingEmail('');
    setShowPassword(false);
  }

  return (
    <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-2xl shadow-violet-950/15 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-[690px] overflow-hidden bg-[#5b21b6] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#fbbf24]/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/20 bg-white shadow-lg"><Image src="/assets/icon.webp" alt="Programming Hero" width={48} height={48} className="h-full w-full object-cover" priority /></div>
          <div><p className="text-lg font-black tracking-tight">Programming Hero</p><p className="text-xs font-semibold text-violet-200">Job Placement Operations</p></div>
        </div>
        <div className="relative z-10 max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/15 px-3 py-1.5 text-xs font-bold text-amber-200"><Sparkles className="h-3.5 w-3.5" /> Dream job journeys, organized</div>
          <h1 className="text-5xl font-black leading-[1.08] tracking-tight">Empower every learner to launch their career.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-violet-100/85">One secure workspace for placement teams to guide students, coordinate follow-ups, and celebrate every successful hire.</p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[['Private', 'Sheet access'], ['Role-based', 'Workspaces'], ['Focused', 'Placement ops']].map(([title, caption]) => <div key={title} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><p className="text-sm font-black">{title}</p><p className="mt-1 text-[11px] font-medium text-violet-200">{caption}</p></div>)}
        </div>
      </section>

      <section className="flex min-h-[690px] items-center px-6 py-10 sm:px-12 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><Image src="/assets/icon.webp" alt="Programming Hero" width={44} height={44} className="rounded-xl" /><div><p className="font-black">PlacementHQ</p><p className="text-xs text-muted-foreground">Programming Hero</p></div></div>
          {pendingEmail ? (
            <div className="animate-scale-in text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300"><CheckCircle2 className="h-8 w-8" /></div>
              <h2 className="mt-6 text-3xl font-black tracking-tight">Request received!</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Your account for <span className="font-bold text-foreground">{pendingEmail}</span> has been created. Please wait for Admin approval before signing in.</p>
              <Button className="mt-8 w-full" onClick={() => switchMode('login')}>Return to sign in</Button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Team Portal</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">{mode === 'login' ? 'Welcome back' : 'Join the placement team'}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{mode === 'login' ? 'Sign in with your authorized team account.' : 'Create a request. Access starts after Admin approval.'}</p>
              </div>

              <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">{(['login', 'register'] as const).map((item) => <button key={item} type="button" onClick={() => switchMode(item)} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === item ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{item === 'login' ? 'Sign in' : 'Create account'}</button>)}</div>
              {mode === 'login' ? (
                <form className="mt-6 space-y-5" onSubmit={loginForm.handleSubmit(onLogin)}>
                  <div><Label htmlFor="login-email">Email address</Label><div className="relative mt-2"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="login-email" type="email" autoComplete="email" placeholder="you@programming-hero.com" className="h-11 pl-10" {...loginForm.register('email')} /></div><FieldError message={loginForm.formState.errors.email?.message} /></div>
                  <div><Label htmlFor="login-password">Password</Label><div className="relative mt-2"><Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" className="h-11 pl-10 pr-11" {...loginForm.register('password')} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><FieldError message={loginForm.formState.errors.password?.message} /></div>
                  <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-violet-600 font-bold hover:bg-violet-700">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in securely <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
                </form>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={registerForm.handleSubmit(onRegister)}>
                  <div><Label htmlFor="register-name">Full name</Label><div className="relative mt-2"><UserRound className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="register-name" autoComplete="name" placeholder="Your full name" className="h-11 pl-10" {...registerForm.register('name')} /></div><FieldError message={registerForm.formState.errors.name?.message} /></div>
                  <div><Label htmlFor="register-email">Work email</Label><div className="relative mt-2"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="register-email" type="email" autoComplete="email" placeholder="you@programming-hero.com" className="h-11 pl-10" {...registerForm.register('email')} /></div><FieldError message={registerForm.formState.errors.email?.message} /></div>
                  <div><Label htmlFor="register-team-role">Team role</Label><Select value={registerForm.watch('teamRole')} onValueChange={(value: RegisterInput['teamRole']) => registerForm.setValue('teamRole', value, { shouldValidate: true })}><SelectTrigger id="register-team-role" className="mt-2 h-11 px-3"><span className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Select your team role" /></span></SelectTrigger><SelectContent>{REGISTRATION_TEAM_ROLE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}><span className="font-semibold">{option.nickname}</span></SelectItem>)}</SelectContent></Select><FieldError message={registerForm.formState.errors.teamRole?.message} /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="register-discord-username">Discord username</Label><div className="relative mt-2"><AtSign className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="register-discord-username" autoComplete="off" placeholder="your.username" className="h-11 pl-10" {...registerForm.register('discordUsername')} /></div><FieldError message={registerForm.formState.errors.discordUsername?.message} /></div>
                    <div><Label htmlFor="register-discord-id">Discord user ID</Label><div className="relative mt-2"><Hash className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="register-discord-id" inputMode="numeric" autoComplete="off" placeholder="123456789012345678" className="h-11 pl-10" {...registerForm.register('discordUserId')} /></div><FieldError message={registerForm.formState.errors.discordUserId?.message} /></div>
                  </div>
                  <div><Label htmlFor="register-password">Password</Label><div className="relative mt-2"><Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="8+ characters" className="h-11 pl-10 pr-11" {...registerForm.register('password')} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><FieldError message={registerForm.formState.errors.password?.message} /></div>
                  <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-violet-600 font-bold hover:bg-violet-700">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send access request <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
                  <p className="text-center text-[11px] leading-5 text-muted-foreground">Your selected team role and Discord identity are stored with a pending account. An Admin must verify and activate access.</p>
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-[690px] w-full max-w-6xl animate-pulse rounded-[2rem] bg-card shadow-xl" />}>
      <LoginPageContent />
    </Suspense>
  );
}
