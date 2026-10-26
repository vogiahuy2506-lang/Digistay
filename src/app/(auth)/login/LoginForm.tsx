'use client'

import * as React from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { inkButton, textLink } from '@/components/marketing/styles'
import { afterLogin } from '@/lib/auth/after-login'
import { LOGIN_ERRORS, TWO_FACTOR_ERRORS } from '@/lib/auth/error-messages'
import { TWO_FACTOR_PROVIDER, TWO_FACTOR_QUERY, TWO_FACTOR_REQUIRED } from '@/lib/auth/two-factor-shared'
import { cn } from '@/lib/utils'
import { CodeInput, Field, GoogleButton, Notice, PasswordInput, authTitle, describedBy, inputClass, useAuthError } from '../_components/ui'

type Problem = 'invalid' | 'tooMany' | 'locked' | 'unverified' | 'other'

/** A clean URL for next-auth's callbackUrl (the page itself navigates after signing in). */
const AFTER_SIGN_IN = '/workspaces'

/**
 * Sign-in (Claude Design "Digistay Dang Nhap"): username or email and
 * password, or Google; then, for accounts with two-factor on, the code from
 * the app or a recovery code (the `two-factor` provider).
 */
export function LoginForm({ google }: { google: boolean }) {
  const t = useTranslations('auth')
  const message = useAuthError()
  const router = useRouter()
  const [form, setForm] = React.useState({ username: '', password: '' })
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<{ kind: Problem; text: string } | null>(null)
  const [sendingCode, setSendingCode] = React.useState(false)
  // Set when the account has two-factor on: the code step replaces the form.
  const [challenge, setChallenge] = React.useState<string | null>(null)
  const [next, setNext] = React.useState('/workspaces')
  // Back from verifying the email on the sign-up page (?verified=1).
  const [verified, setVerified] = React.useState(false)

  // Google sign-in with two-factor on lands here with ?twoFactor=<challenge>,
  // a failed one with ?error=<next-auth code>. Read them once and drop them
  // from the address bar and history.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setNext(afterLogin(params.get('callbackUrl')))
    setVerified(params.get('verified') === '1')
    const fromGoogle = params.get(TWO_FACTOR_QUERY)
    if (fromGoogle) setChallenge(fromGoogle)
    if (params.get('error')) setProblem({ kind: 'other', text: t('login.googleFailed') })
    if (fromGoogle || params.has('error')) {
      params.delete(TWO_FACTOR_QUERY)
      params.delete('error')
      const rest = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`)
    }
  }, [t])

  const goToApp = () => {
    router.push(next)
    router.refresh()
  }

  const missing = { username: !form.username.trim(), password: !form.password }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (missing.username || missing.password) return
    setBusy(true)
    setProblem(null)
    try {
      // callbackUrl: next-auth reads `error` back from the URL it returns, which
      // defaults to this page's: after a failed Google attempt (?error=OAuthSignin)
      // a successful password sign-in came back as that error.
      const result = await signIn('credentials', { username: form.username, password: form.password, redirect: false, callbackUrl: AFTER_SIGN_IN })
      if (result?.error?.startsWith(TWO_FACTOR_REQUIRED)) {
        setChallenge(result.error.slice(TWO_FACTOR_REQUIRED.length))
        setBusy(false)
        return
      }
      if (result?.error) {
        const kind: Problem =
          result.error === LOGIN_ERRORS.invalid || result.error === 'CredentialsSignin'
            ? 'invalid'
            : result.error === LOGIN_ERRORS.tooMany
              ? 'tooMany'
              : result.error === LOGIN_ERRORS.locked
                ? 'locked'
                : result.error === LOGIN_ERRORS.unverified
                  ? 'unverified'
                  : 'other'
        setProblem({ kind, text: message(result.error) })
        setBusy(false)
        return
      }
      goToApp()
    } catch {
      setProblem({ kind: 'other', text: t('common.generic') })
      setBusy(false)
    }
  }

  // An account whose email was never verified: send a new code and finish on the sign-up page.
  const verifyEmail = async () => {
    setSendingCode(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.username }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        router.push(`/register?email=${encodeURIComponent(form.username)}&resend=1`)
        return
      }
      setProblem({ kind: 'other', text: message(data.error) })
    } catch {
      setProblem({ kind: 'other', text: t('common.generic') })
    } finally {
      setSendingCode(false)
    }
  }

  if (challenge) {
    return (
      <TwoFactor
        challenge={challenge}
        onSuccess={goToApp}
        onCancel={() => {
          setChallenge(null)
          setForm((f) => ({ ...f, password: '' }))
        }}
      />
    )
  }

  const err = {
    username: tried && missing.username && t('login.missingLogin'),
    password: tried && missing.password && t('login.missingPassword'),
  }

  return (
    <div>
      <h1 className={authTitle}>{t('login.title')}</h1>
      <p className="mt-3 text-[15px] text-fg/80">
        {t.rich('login.noAccount', {
          link: (c) => (
            <Link href={next === '/workspaces' ? '/register' : `/register?callbackUrl=${encodeURIComponent(next)}`} className={cn(textLink, 'underline')}>
              {c}
            </Link>
          ),
        })}
      </p>

      <div className="mt-7 flex flex-col gap-5">
        {verified && !problem && <Notice tone="ok">{t('login.verified')}</Notice>}
        {problem?.kind === 'invalid' && (
          <Notice tone="err">
            <b className="font-semibold text-err">⚠ {problem.text}</b> {t('login.invalidHint')}
          </Notice>
        )}
        {problem?.kind === 'locked' && (
          <Notice tone="warn">
            <b className="block font-semibold">{t('errors.locked')}</b>
            <span className="mt-1 block text-fg/80">{t('login.lockedText')}</span>
            <Link href="/forgot-password" className={cn(textLink, 'mt-2.5 inline-block underline')}>
              {t('login.resetNow')}
            </Link>
          </Notice>
        )}
        {problem?.kind === 'unverified' && (
          <Notice tone="warn">
            <b className="block font-semibold">{problem.text}</b>
            <button type="button" onClick={verifyEmail} disabled={sendingCode} className={cn(textLink, 'mt-2 underline disabled:opacity-60')}>
              {sendingCode ? t('login.sendingCode') : t('login.verifyNow')}
            </button>
          </Notice>
        )}
        {(problem?.kind === 'tooMany' || problem?.kind === 'other') && <Notice tone="err">⚠ {problem.text}</Notice>}

        {google && (
          <>
            <GoogleButton label={t('common.google')} onClick={() => signIn('google', { callbackUrl: next })} disabled={busy} className="h-[50px] text-[15px]" />
            <div className="flex items-center gap-4 text-[13px] text-muted">
              <span className="h-px flex-1 bg-line" />
              {t('common.or')}
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Field id="login-username" label={t('login.login')} error={err.username}>
            <input
              id="login-username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              disabled={busy}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className={inputClass(!!err.username)}
              {...describedBy('login-username', err.username)}
            />
          </Field>
          <Field id="login-password" label={t('login.password')} error={err.password}>
            <PasswordInput
              id="login-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              disabled={busy}
              autoComplete="current-password"
              bad={!!err.password}
              {...describedBy('login-password', err.password)}
            />
          </Field>
          <div className="-mt-1 flex justify-end">
            <Link href="/forgot-password" className={cn(textLink, 'text-[14px] underline')}>
              {t('login.forgot')}
            </Link>
          </div>
          <button type="submit" disabled={busy} className={cn(inkButton, 'h-[52px] w-full text-[15px] disabled:bg-muted')}>
            {busy ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}

/** Second sign-in step: the app's 6-digit code, or a recovery code. */
function TwoFactor({ challenge, onSuccess, onCancel }: { challenge: string; onSuccess: () => void; onCancel: () => void }) {
  const t = useTranslations('auth')
  const message = useAuthError()
  const [recovery, setRecovery] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!recovery && code.length !== 6) {
      setError(t('common.codeIncomplete'))
      return
    }
    if (recovery && !code.trim()) return
    setBusy(true)
    setError('')
    try {
      const result = await signIn(TWO_FACTOR_PROVIDER, { challenge, code, redirect: false, callbackUrl: AFTER_SIGN_IN })
      if (result?.error) {
        setError(result.error === 'CredentialsSignin' ? message(TWO_FACTOR_ERRORS.invalidCode) : message(result.error))
        setCode('')
        setBusy(false)
        return
      }
      onSuccess()
    } catch {
      setError(t('common.generic'))
      setBusy(false)
    }
  }

  const switchMode = () => {
    setRecovery((r) => !r)
    setCode('')
    setError('')
  }

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" onClick={recovery ? switchMode : onCancel} className={cn(textLink, 'text-[14px]')}>
        ← {recovery ? t('twoFactor.useApp') : t('common.back')}
      </button>
      <p className="mt-6 text-label font-medium uppercase text-muted">{t('twoFactor.step')}</p>
      <h1 className={cn(authTitle, 'mt-3')}>{recovery ? t('twoFactor.recoveryTitle') : t('twoFactor.title')}</h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-fg/80">{recovery ? t('twoFactor.recoveryText') : t('twoFactor.text')}</p>

      <div className="mt-7 flex flex-col gap-4">
        {recovery ? (
          <Field id="login-recovery" label={t('twoFactor.recoveryLabel')} error={error}>
            <input
              id="login-recovery"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              autoFocus
              disabled={busy}
              className={cn(inputClass(!!error), 'font-mono tracking-[0.08em]')}
              {...describedBy('login-recovery', error)}
            />
          </Field>
        ) : (
          <>
            <CodeInput
              value={code}
              onChange={(c) => {
                setCode(c)
                setError('')
              }}
              bad={!!error}
              disabled={busy}
              label={t('common.code')}
              autoFocus
            />
            {error && <Notice tone="err">⚠ {error}</Notice>}
          </>
        )}
        <button type="submit" disabled={busy || (!recovery && code.length !== 6)} className={cn(inkButton, 'h-[52px] w-full text-[15px] disabled:bg-muted')}>
          {busy ? t('common.checking') : t('twoFactor.verify')}
        </button>
        <p className="text-center text-[14px] text-muted">
          {recovery
            ? t.rich('twoFactor.lostAll', { link: (c) => <Link href="/contact" className={cn(textLink, 'underline')}>{c}</Link> })
            : t.rich('twoFactor.noApp', {
                button: (c) => (
                  <button type="button" onClick={switchMode} className={cn(textLink, 'underline')}>
                    {c}
                  </button>
                ),
              })}
        </p>
      </div>
    </form>
  )
}
