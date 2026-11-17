'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AUTH_ERROR_KEYS } from '@/lib/auth/error-messages'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'

/**
 * Pieces of the account pages (Claude Design "Digistay Dang Nhap", "Dang
 * Ky", "Quen Mat Khau"): labelled fields, password with show/hide, the
 * 6-digit code boxes, the strength bar, notices. Light only, role tokens.
 */

export const inputClass = (bad?: boolean) =>
  cn(
    'h-12 w-full rounded-ctl border bg-panel px-3.5 text-[15px] text-fg placeholder:text-muted/80 transition-[border-color,box-shadow] duration-160',
    'focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:opacity-60',
    bad ? 'border-err bg-err-soft/40' : 'border-line',
  )

export const authTitle = 'font-serif text-[36px] font-medium leading-[1.12] tracking-[-0.02em] text-fg lg:text-[44px]'

/** A label over its control, with an error (⚠) or a hint under it. */
export function Field({
  label,
  extra,
  error,
  hint,
  id,
  children,
}: {
  label: string
  extra?: React.ReactNode
  error?: string | false | null
  hint?: React.ReactNode
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-medium text-fg">
        {label} {extra && <span className="font-normal text-muted">{extra}</span>}
      </label>
      {children}
      {error ? (
        <span id={`${id}-msg`} className="text-[13px] leading-[1.5] text-err">
          ⚠ {error}
        </span>
      ) : hint ? (
        <span id={`${id}-msg`} className="text-[13px] leading-[1.5] text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

/** aria props tying a control to Field's message. */
export const describedBy = (id: string, error?: string | boolean | null, hint?: React.ReactNode) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error || hint ? `${id}-msg` : undefined,
})

export function PasswordInput({
  id,
  bad,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string; bad?: boolean }) {
  const t = useTranslations('auth.common')
  const [shown, setShown] = React.useState(false)
  return (
    <div className="relative">
      <input id={id} type={shown ? 'text' : 'password'} className={cn(inputClass(bad), 'pr-16')} {...props} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? t('hidePassword') : t('showPassword')}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex items-center px-4 text-[13.5px] font-medium text-fg underline underline-offset-2"
      >
        {shown ? t('hide') : t('show')}
      </button>
    </div>
  )
}

/** Weak / fair / strong for a new password (the sign-up page's old scoring). */
export function passwordScore(p: string): 0 | 1 | 2 | 3 {
  if (!p) return 0
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 10) score++
  if (/[A-Z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  return score <= 1 ? 1 : score <= 3 ? 2 : 3
}

export function StrengthMeter({ password }: { password: string }) {
  const t = useTranslations('auth.common')
  const level = passwordScore(password)
  const color = level === 1 ? 'bg-err' : level === 2 ? 'bg-warn' : 'bg-ok'
  const label = level === 0 ? t('strength') : level === 1 ? t('weak') : level === 2 ? t('medium') : t('strong')
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="grid flex-1 grid-cols-3 gap-1">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn('h-[3px] rounded-full', i <= level ? color : 'bg-line')} />
        ))}
      </div>
      <span className={cn('min-w-[72px] text-right text-[12.5px] font-medium', level === 0 ? 'text-muted' : 'text-fg')}>{label}</span>
    </div>
  )
}

/**
 * Six boxes showing the digits of one real input (numeric, one-time-code
 * autofill), so paste and the phone's code suggestion work.
 */
export function CodeInput({
  value,
  onChange,
  bad,
  disabled,
  label,
  autoFocus,
}: {
  value: string
  onChange: (code: string) => void
  bad?: boolean
  disabled?: boolean
  label: string
  autoFocus?: boolean
}) {
  const [focused, setFocused] = React.useState(false)
  return (
    <div className="relative">
      <div aria-hidden className="grid grid-cols-6 gap-2 sm:gap-2.5">
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && !bad && i === Math.min(value.length, 5)
          return (
            <div
              key={i}
              className={cn(
                'flex h-14 items-center justify-center rounded-ctl border bg-panel font-mono text-[24px] font-medium text-fg sm:h-[60px]',
                bad ? 'border-err bg-err-soft/40' : active ? 'border-ink ring-[3px] ring-ink/10' : 'border-line',
              )}
            >
              {value[i] ?? ''}
            </div>
          )
        })}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-label={label}
        aria-invalid={bad || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
    </div>
  )
}

/** An error, warning, success or neutral note above a form. */
export function Notice({ tone, children }: { tone: 'err' | 'warn' | 'ok' | 'info'; children: React.ReactNode }) {
  const tones = {
    err: 'border-err/25 bg-err-soft text-fg',
    warn: 'border-warn/25 bg-warn-soft text-fg',
    ok: 'border-ok/25 bg-ok-soft text-fg',
    info: 'border-line bg-plain-soft/60 text-fg',
  }
  return (
    <div role={tone === 'err' ? 'alert' : 'status'} className={cn('rounded-ctl border px-4 py-3 text-[14px] leading-[1.55]', tones[tone])}>
      {children}
    </div>
  )
}

/** Seconds left on a timer that ticks down to 0. */
export function useCountdown(): [number, (sec: number) => void] {
  const [left, setLeft] = React.useState(0)
  React.useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  return [left, setLeft]
}

export const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

/**
 * A server error message (Vietnamese) in the page's language: known ones by
 * AUTH_ERROR_KEYS; others through the API dictionary (apiError), else as is in
 * Vietnamese and the generic text in English.
 */
export function useAuthError() {
  const t = useTranslations('auth')
  const locale = useLocale()
  return React.useCallback(
    (message?: string | null) => {
      const key = message ? AUTH_ERROR_KEYS[message] : undefined
      if (key) return t(key)
      return apiError(message) || t('common.generic')
    },
    [t, locale],
  )
}

/** "Continue with Google" (sign-in) / "Sign up with Google": a prominent button with the official Google G logo. */
export function GoogleButton({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group inline-flex items-center justify-center gap-3 rounded-ctl border border-line bg-panel font-medium text-fg shadow-sm transition-all duration-160 ease-ds hover:border-ink/80 hover:bg-plain-soft/50 hover:shadow active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2 focus-visible:ring-offset-page',
        className,
      )}
    >
      <svg className="h-5 w-5 shrink-0 transition-transform duration-160 group-hover:scale-105" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          fill="#EA4335"
        />
      </svg>
      <span>{label}</span>
    </button>
  )
}
