'use client'

import * as React from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { inkButton, textLink } from '@/components/marketing/styles'
import { AUTH_ERROR_KEYS } from '@/lib/auth/error-messages'
import { afterLogin } from '@/lib/auth/after-login'
import { cn } from '@/lib/utils'
import {
  CodeInput,
  Field,
  GoogleButton,
  Notice,
  PasswordInput,
  StrengthMeter,
  authTitle,
  describedBy,
  inputClass,
  mmss,
  useAuthError,
  useCountdown,
} from '../_components/ui'

type FieldName = 'name' | 'username' | 'email' | 'phone' | 'password' | 'confirm' | 'terms'
const RESEND_SEC = 60

/**
 * Sign-up in two steps (Claude Design "Digistay Dang Ky"): the account, then
 * the 6-digit code emailed to it. /register?email=…&resend=1 (from the login
 * page, for an account never verified) opens on the code step: the login
 * page has just sent a new code.
 */
export function RegisterForm({ google }: { google: boolean }) {
  const t = useTranslations('auth')
  const message = useAuthError()
  const router = useRouter()
  const [form, setForm] = React.useState({ name: '', username: '', email: '', phone: '', password: '', confirm: '' })
  const [terms, setTerms] = React.useState(false)
  const [tried, setTried] = React.useState(false)
  // Set by "Sign up with Google" with the terms box unticked: only that box's error shows.
  const [googleTried, setGoogleTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [taken, setTaken] = React.useState<{ username?: string; email?: string }>({})
  const [error, setError] = React.useState('')
  const [step, setStep] = React.useState<'form' | 'verify'>('form')
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [codeError, setCodeError] = React.useState<'wrong' | 'tooMany' | string | null>(null)
  const [resent, setResent] = React.useState(false)
  const [cooldown, startCooldown] = useCountdown()
  // Where to go once the account is ready: ?callbackUrl= (a plan picked on the pricing page, say).
  const [next, setNext] = React.useState('/workspaces')
  const withNext = (path: string) => (next === '/workspaces' ? path : `${path}${path.includes('?') ? '&' : '?'}callbackUrl=${encodeURIComponent(next)}`)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setNext(afterLogin(params.get('callbackUrl')))
    const fromLogin = params.get('email')
    if (fromLogin && params.get('resend') === '1') {
      setEmail(fromLogin)
      setStep('verify')
      startCooldown(RESEND_SEC)
    }
  }, [startCooldown])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (k === 'username' || k === 'email') setTaken((x) => ({ ...x, [k]: undefined }))
  }

  const problems: Partial<Record<FieldName, string>> = {}
  if (form.name.trim().length < 2) problems.name = t('register.nameError')
  if (form.username.length < 3) problems.username = t('register.usernameShort')
  else if (form.username.length > 30) problems.username = t('register.usernameLong')
  else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) problems.username = t('register.usernameChars')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) problems.email = t('common.emailInvalid')
  const digits = form.phone.replace(/\D/g, '').length
  if (form.phone.trim() && (!/^[\d\s+().-]+$/.test(form.phone.trim()) || digits < 8 || digits > 15)) problems.phone = t('register.phoneError')
  if (form.password.length < 8) problems.password = t('common.passwordShort')
  if (!form.confirm || form.confirm !== form.password) problems.confirm = t('common.mismatch')
  if (!terms) problems.terms = t('register.termsRequired')

  const shown: Partial<Record<FieldName, string>> = tried ? { ...problems } : {}
  if (taken.username) shown.username = taken.username
  if (taken.email) shown.email = taken.email
  const count = Object.keys(shown).length

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    setError('')
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          username: form.username,
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const key = AUTH_ERROR_KEYS[data.error]
        if (key === 'errors.usernameTaken') setTaken((x) => ({ ...x, username: message(data.error) }))
        else if (key === 'errors.emailTaken') setTaken((x) => ({ ...x, email: message(data.error) }))
        else setError(message(data.error))
        setBusy(false)
        return
      }
      if (data.data?.requiresVerification) {
        setEmail(data.data.email)
        setCode('')
        setCodeError(null)
        setStep('verify')
        startCooldown(RESEND_SEC)
        setBusy(false)
        return
      }
      await finish()
    } catch {
      setError(t('common.generic'))
      setBusy(false)
    }
  }

  // Signs in with what was just typed; back from the login page there is no password: sign in there.
  const finish = async () => {
    if (!form.password) {
      router.push(withNext('/login?verified=1'))
      return
    }
    // callbackUrl: next-auth reads `error` back from the URL it returns (see LoginForm).
    const result = await signIn('credentials', { username: form.username, password: form.password, redirect: false, callbackUrl: next })
    router.push(result?.error ? withNext('/login?verified=1') : next)
  }

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (code.length !== 6) {
      setCodeError(t('common.codeIncomplete'))
      return
    }
    setBusy(true)
    setCodeError(null)
    setResent(false)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code, purpose: 'verify_otp' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const key = AUTH_ERROR_KEYS[data.error]
        setCodeError(key === 'errors.codeWrong' ? 'wrong' : key === 'errors.codeTooManyTries' ? 'tooMany' : message(data.error))
        setCode('')
        setBusy(false)
        return
      }
      await finish()
    } catch {
      setCodeError(t('common.generic'))
      setBusy(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0) return
    setCodeError(null)
    setResent(false)
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'register' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setResent(true)
        setCode('')
        startCooldown(RESEND_SEC)
      } else setCodeError(message(data.error))
    } catch {
      setCodeError(t('common.generic'))
    }
  }

  const stepBar = (n: 1 | 2) => (
    <div className="mb-6">
      <div className="flex items-baseline justify-between gap-4 text-[13px]">
        <span className="font-semibold text-fg">{n === 1 ? t('register.step1') : t('register.step2')}</span>
        {n === 1 && <span className="text-muted">{t('register.next1')}</span>}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-1">
        <span className="h-[3px] rounded-full bg-ink" />
        <span className={cn('h-[3px] rounded-full', n === 2 ? 'bg-ink' : 'bg-line')} />
      </div>
    </div>
  )

  if (step === 'verify') {
    return (
      <form onSubmit={verify} noValidate>
        {stepBar(2)}
        <h1 className={authTitle}>{t('register.verifyTitle')}</h1>
        <p className="mt-3 text-[15px] leading-[1.65] text-fg/80">
          {t.rich('register.verifyText', { email, b: (c) => <b className="font-semibold text-fg">{c}</b> })}
        </p>
        <button type="button" onClick={() => setStep('form')} className={cn(textLink, 'mt-2 text-[14px] underline')}>
          {t('common.changeEmail')}
        </button>
        <div className="mt-7 flex flex-col gap-4">
          {codeError === 'tooMany' && <Notice tone="warn">{t('errors.codeTooManyTries')}</Notice>}
          <CodeInput
            value={code}
            onChange={(c) => {
              setCode(c)
              if (codeError !== 'tooMany') setCodeError(null)
            }}
            bad={!!codeError && codeError !== 'tooMany'}
            disabled={busy}
            label={t('common.code')}
            autoFocus
          />
          {codeError && codeError !== 'tooMany' && (
            <Notice tone="err">⚠ {codeError === 'wrong' ? t('register.verifyWrong') : codeError}</Notice>
          )}
          {resent && <Notice tone="ok">{t('common.resent')}</Notice>}
          <button type="submit" disabled={busy || code.length !== 6} className={cn(inkButton, 'h-[52px] w-full text-[15px] disabled:bg-muted')}>
            {busy ? t('common.checking') : t('register.verifySubmit')}
          </button>
          <p className="flex flex-wrap justify-center gap-1.5 text-[14px] text-muted">
            <span>{t('common.noCode')}</span>
            {cooldown > 0 ? (
              <span>{t.rich('common.resendIn', { time: mmss(cooldown), b: (c) => <b className="font-semibold tabular-nums text-fg">{c}</b> })}</span>
            ) : (
              <button type="button" onClick={resend} className={cn(textLink, 'underline')}>
                {t('common.resend')}
              </button>
            )}
          </p>
        </div>
      </form>
    )
  }

  const termsError = shown.terms ?? (googleTried && !terms ? t('register.termsRequired') : undefined)

  // Google makes the account on its first sign-in (next-auth adapter); the terms box counts for it too.
  const signUpWithGoogle = () => {
    if (!terms) {
      setGoogleTried(true)
      return
    }
    signIn('google', { callbackUrl: next })
  }

  return (
    <form onSubmit={submit} noValidate>
      {stepBar(1)}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={authTitle}>{t('register.title')}</h1>
          <p className="mt-3 text-[15px] text-fg/80">
            {t.rich('register.haveAccount', { link: (c) => <Link href={withNext('/login')} className={cn(textLink, 'underline')}>{c}</Link> })}
          </p>
        </div>
        {/* Beside the title, not above the fields, so the step still fits one laptop screen */}
        {google && <GoogleButton label={t('register.google')} onClick={signUpWithGoogle} disabled={busy} className="h-11 shrink-0 px-4 text-[14.5px]" />}
      </div>
      <div className="mt-6 flex flex-col gap-5">
        {count > 0 && <Notice tone="err">⚠ {t('common.summary', { count })}</Notice>}
        {error && <Notice tone="err">⚠ {error}</Notice>}

        {/* Two fields a row from sm, so the whole step fits one laptop screen */}
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 sm:items-start">
          <Field id="reg-name" label={t('register.name')} error={shown.name}>
            <input id="reg-name" value={form.name} onChange={set('name')} disabled={busy} autoComplete="name" className={inputClass(!!shown.name)} {...describedBy('reg-name', shown.name)} />
          </Field>
          <Field id="reg-username" label={t('register.username')} error={shown.username}>
            <input
              id="reg-username"
              value={form.username}
              onChange={set('username')}
              disabled={busy}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t('register.usernamePlaceholder')}
              className={inputClass(!!shown.username)}
              {...describedBy('reg-username', shown.username)}
            />
          </Field>
          <Field id="reg-email" label={t('common.email')} error={shown.email}>
            <input
              id="reg-email"
              type="email"
              inputMode="email"
              value={form.email}
              onChange={set('email')}
              disabled={busy}
              autoComplete="email"
              className={inputClass(!!shown.email)}
              {...describedBy('reg-email', shown.email)}
            />
          </Field>
          <Field id="reg-phone" label={t('register.phone')} extra={t('register.optional')} error={shown.phone}>
            <input id="reg-phone" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} disabled={busy} autoComplete="tel" className={inputClass(!!shown.phone)} {...describedBy('reg-phone', shown.phone)} />
          </Field>
          <Field id="reg-password" label={t('register.password')} error={shown.password} hint={t('register.passwordHint')}>
            <PasswordInput
              id="reg-password"
              value={form.password}
              onChange={set('password')}
              disabled={busy}
              autoComplete="new-password"
              bad={!!shown.password}
              {...describedBy('reg-password', shown.password, true)}
            />
            <StrengthMeter password={form.password} />
          </Field>
          <Field id="reg-confirm" label={t('register.confirm')} error={shown.confirm}>
            <PasswordInput
              id="reg-confirm"
              value={form.confirm}
              onChange={set('confirm')}
              disabled={busy}
              autoComplete="new-password"
              bad={!!shown.confirm}
              {...describedBy('reg-confirm', shown.confirm)}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-3 text-[14.5px] leading-[1.55] text-fg">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              disabled={busy}
              aria-invalid={!!termsError || undefined}
              className={cn('mt-0.5 h-5 w-5 flex-none rounded-[4px] accent-ink', termsError && 'outline outline-1 outline-err')}
            />
            <span>
              {t.rich('register.terms', {
                terms: (c) => <Link href="/terms" className="font-semibold underline">{c}</Link>,
                privacy: (c) => <Link href="/privacy" className="font-semibold underline">{c}</Link>,
              })}
            </span>
          </label>
          {termsError && <span className="text-[13px] text-err">⚠ {termsError}</span>}
        </div>
        <button type="submit" disabled={busy} className={cn(inkButton, 'h-[52px] w-full text-[15px] disabled:bg-muted')}>
          {busy ? t('register.submitting') : t('register.submit')}
        </button>
      </div>
    </form>
  )
}
