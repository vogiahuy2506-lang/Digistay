'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { inkButton, textLink } from '@/components/marketing/styles'
import { AUTH_ERROR_KEYS } from '@/lib/auth/error-messages'
import { cn } from '@/lib/utils'
import {
  CodeInput,
  Field,
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

type Step = 'email' | 'code' | 'password' | 'done'
const STEPS: Step[] = ['email', 'code', 'password', 'done']
const RESEND_SEC = 60

/**
 * Password reset in four steps (Claude Design "Digistay Quen Mat Khau"):
 * email → 6-digit code (/api/auth/otp/verify hands out a single-use reset
 * token) → new password (/api/auth/reset-password) → done. The server
 * answers the same for an email without an account.
 */
export function ForgotForm() {
  const t = useTranslations('auth')
  const message = useAuthError()
  const [step, setStep] = React.useState<Step>('email')
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [token, setToken] = React.useState('')
  const [pw, setPw] = React.useState({ next: '', confirm: '' })
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [codeWrong, setCodeWrong] = React.useState(false)
  const [resent, setResent] = React.useState(false)
  const [cooldown, startCooldown] = useCountdown()

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: res.ok, data: await res.json().catch(() => ({})) }
  }

  const emailBad = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (emailBad) return
    setBusy(true)
    setError('')
    try {
      const { ok, data } = await post('/api/auth/otp/send', { email: email.trim(), purpose: 'forgot_password' })
      if (ok && data.success) {
        setStep('code')
        setCode('')
        setTried(false)
        startCooldown(RESEND_SEC)
      } else setError(message(data.error))
    } catch {
      setError(t('common.generic'))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0) return
    setError('')
    setCodeWrong(false)
    setResent(false)
    try {
      const { ok, data } = await post('/api/auth/otp/send', { email: email.trim(), purpose: 'forgot_password' })
      if (ok && data.success) {
        setResent(true)
        setCode('')
        startCooldown(RESEND_SEC)
      } else setError(message(data.error))
    } catch {
      setError(t('common.generic'))
    }
  }

  const checkCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (code.length !== 6) return
    setBusy(true)
    setError('')
    setCodeWrong(false)
    setResent(false)
    try {
      const { data } = await post('/api/auth/otp/verify', { email: email.trim(), otp: code })
      if (data.success) {
        setToken(data.resetToken)
        setStep('password')
        setTried(false)
      } else if (AUTH_ERROR_KEYS[data.error] === 'errors.codeWrong') {
        setCodeWrong(true)
        setCode('')
      } else setError(message(data.error))
    } catch {
      setError(t('common.generic'))
    } finally {
      setBusy(false)
    }
  }

  const pwProblems = {
    next: pw.next.length < 8 ? t('common.passwordShort') : '',
    confirm: !pw.confirm || pw.confirm !== pw.next ? t('common.mismatch') : '',
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (pwProblems.next || pwProblems.confirm) return
    setBusy(true)
    setError('')
    try {
      const { data } = await post('/api/auth/reset-password', { resetToken: token, newPassword: pw.next })
      if (data.success) setStep('done')
      else setError(message(data.error))
    } catch {
      setError(t('common.generic'))
    } finally {
      setBusy(false)
    }
  }

  const n = STEPS.indexOf(step) + 1
  const bold = (c: React.ReactNode) => <b className="font-semibold text-fg">{c}</b>
  const submitClass = cn(inkButton, 'h-[52px] w-full text-[15px] disabled:bg-muted')

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-baseline justify-between gap-4 text-[13px]">
          <span className="font-semibold text-fg">{t('forgot.step', { n, name: t(`forgot.steps.${step}`) })}</span>
          {step !== 'done' && (
            <Link href="/login" className="text-muted hover:text-fg hover:underline">
              {t('common.backToLogin')}
            </Link>
          )}
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1">
          {STEPS.map((s, i) => (
            <span key={s} className={cn('h-[3px] rounded-full', i < n ? 'bg-ink' : 'bg-line')} />
          ))}
        </div>
      </div>

      {step === 'email' && (
        <form onSubmit={sendCode} noValidate>
          <h1 className={authTitle}>{t('forgot.title')}</h1>
          <p className="mt-3 text-[15px] leading-[1.65] text-fg/80">{t('forgot.text')}</p>
          <div className="mt-7 flex flex-col gap-5">
            {error && <Notice tone="err">⚠ {error}</Notice>}
            <Field id="forgot-email" label={t('common.email')} error={tried && emailBad && t('common.emailInvalid')}>
              <input
                id="forgot-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                autoComplete="email"
                autoFocus
                className={inputClass(tried && emailBad)}
                {...describedBy('forgot-email', tried && emailBad)}
              />
            </Field>
            <button type="submit" disabled={busy} className={submitClass}>
              {busy ? t('forgot.sending') : t('forgot.send')}
            </button>
          </div>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={checkCode} noValidate>
          <h1 className={authTitle}>{t('forgot.codeTitle')}</h1>
          <p className="mt-3 text-[15px] leading-[1.65] text-fg/80">{t.rich('forgot.codeText', { email: email.trim(), b: bold })}</p>
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setError('')
              setCodeWrong(false)
            }}
            className={cn(textLink, 'mt-2 text-[14px] underline')}
          >
            {t('common.changeEmail')}
          </button>
          <div className="mt-7 flex flex-col gap-4">
            <CodeInput
              value={code}
              onChange={(c) => {
                setCode(c)
                setCodeWrong(false)
              }}
              bad={codeWrong}
              disabled={busy}
              label={t('common.code')}
              autoFocus
            />
            {codeWrong && <Notice tone="err">⚠ {t('errors.codeWrong')}</Notice>}
            {error && <Notice tone="err">⚠ {error}</Notice>}
            {resent && <Notice tone="ok">{t('common.resent')}</Notice>}
            <button type="submit" disabled={busy || code.length !== 6} className={submitClass}>
              {busy ? t('common.checking') : t('forgot.continue')}
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
      )}

      {step === 'password' && (
        <form onSubmit={save} noValidate>
          <h1 className={authTitle}>{t('forgot.passwordTitle')}</h1>
          <p className="mt-3 text-[15px] leading-[1.65] text-fg/80">{t.rich('forgot.passwordText', { email: email.trim(), b: bold })}</p>
          <div className="mt-7 flex flex-col gap-5">
            {error && <Notice tone="err">⚠ {error}</Notice>}
            <Field id="forgot-new" label={t('forgot.newPassword')} error={tried && pwProblems.next} hint={t('forgot.newHint')}>
              <PasswordInput
                id="forgot-new"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                disabled={busy}
                autoComplete="new-password"
                autoFocus
                bad={tried && !!pwProblems.next}
                {...describedBy('forgot-new', tried && pwProblems.next, true)}
              />
              <StrengthMeter password={pw.next} />
            </Field>
            <Field id="forgot-confirm" label={t('forgot.confirm')} error={tried && pwProblems.confirm}>
              <PasswordInput
                id="forgot-confirm"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                disabled={busy}
                autoComplete="new-password"
                bad={tried && !!pwProblems.confirm}
                {...describedBy('forgot-confirm', tried && pwProblems.confirm)}
              />
            </Field>
            <button type="submit" disabled={busy} className={submitClass}>
              {busy ? t('forgot.saving') : t('forgot.save')}
            </button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <div role="status">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-soft text-[22px] text-ok">
            ✓
          </span>
          <h1 className={cn(authTitle, 'mt-5')}>{t('forgot.doneTitle')}</h1>
          <p className="mt-3 text-[15px] leading-[1.65] text-fg/80">{t.rich('forgot.doneText', { email: email.trim(), b: bold })}</p>
          <Link href="/login" className={cn(inkButton, 'mt-8 h-[52px] w-full text-[15px]')}>
            {t('common.backToLogin')}
          </Link>
        </div>
      )}
    </div>
  )
}
