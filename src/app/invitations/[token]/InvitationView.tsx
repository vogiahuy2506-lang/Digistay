'use client'

import * as React from 'react'
import Link from 'next/link'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { inkButton, lineButton } from '@/components/marketing/styles'
import { cn } from '@/lib/utils'
import { Field, Notice, PasswordInput, StrengthMeter, authTitle, describedBy, inputClass } from '@/app/(auth)/_components/ui'
import { apiError } from '@/lib/i18n/api-errors'

interface Invitation {
  email: string
  role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'
  /** Permissions ticked for them rather than the role's. */
  customPermissions?: boolean
  /** The properties they will work at; null: all. */
  properties?: string[] | null
  /** Whether the email has a Digistay account (sign in) or not (set a password here). */
  hasAccount?: boolean
  status: string
  expiresAt: string
  workspace: { id: string; name: string; description: string | null }
  sender: { name: string | null; email: string }
}

type State = 'loading' | 'pending' | 'accepted' | 'declined' | 'used' | 'expired' | 'revoked' | 'invalid'

/**
 * An invitation to a workspace (Claude Design "Digistay Loi Moi"): who
 * invites whom, with which role; accept or decline once signed in with the
 * invited email. The accept / decline routes check that email again. An
 * invitee without an account chooses a name and password here and is in
 * (POST /api/invitations/[token]/register), like UKNOW's.
 */
export function InvitationView({ token }: { token: string }) {
  const t = useTranslations('auth.invite')
  const tc = useTranslations('auth.common')
  const locale = useLocale()
  const router = useRouter()
  const session = useSession()
  const [invite, setInvite] = React.useState<Invitation | null>(null)
  const [state, setState] = React.useState<State>('loading')
  const [busy, setBusy] = React.useState(false)
  const [confirmDecline, setConfirmDecline] = React.useState(false)
  const [error, setError] = React.useState('')
  const [form, setForm] = React.useState({ name: '', password: '' })
  const [formErrors, setFormErrors] = React.useState<{ name?: string; password?: string }>({})
  const [joinedSlug, setJoinedSlug] = React.useState<string | null>(null)

  React.useEffect(() => {
    let live = true
    fetch(`/api/invitations/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!live) return
        if (!data.data) return setState('invalid')
        setInvite(data.data)
        const s = data.data.status
        setState(s === 'EXPIRED' ? 'expired' : s === 'PENDING' ? 'pending' : s === 'DECLINED' ? 'declined' : s === 'REVOKED' ? 'revoked' : 'used')
      })
      .catch(() => live && setState('invalid'))
    return () => {
      live = false
    }
  }, [token])

  const toLogin = `/login?callbackUrl=${encodeURIComponent(`/invitations/${token}`)}`
  const signedIn = session.status === 'authenticated' ? session.data?.user?.email?.toLowerCase() : null
  const otherEmail = state === 'pending' && invite && signedIn && signedIn !== invite.email.toLowerCase()

  const act = async (what: 'accept' | 'decline') => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/${what}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) return router.push(toLogin)
      if (res.ok) {
        if (what === 'accept') setJoinedSlug(data.data?.workspaceSlug ?? null)
        return setState(what === 'accept' ? 'accepted' : 'declined')
      }
      if (res.status === 410) return setState('expired')
      if (res.status === 400) return setState('used')
      setError(apiError(data.error) || tc('generic'))
    } catch {
      setError(tc('generic'))
    } finally {
      setBusy(false)
      setConfirmDecline(false)
    }
  }

  // No account yet: their name and a password, then signed in with it.
  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = {
      name: form.name.trim().length < 2 ? t('nameShort') : undefined,
      password: form.password.length < 8 ? t('passwordShort') : undefined,
    }
    setFormErrors(errors)
    if (errors.name || errors.password || !invite) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), password: form.password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        setInvite({ ...invite, hasAccount: true })
        return setError(apiError(data.error) || tc('generic'))
      }
      if (res.status === 410) return setState('expired')
      if (!res.ok) {
        if (data.code === 'ANSWERED') return setState('used')
        return setError(apiError(data.error) || tc('generic'))
      }
      const slug: string | null = data.data?.workspaceSlug ?? null
      const login = await signIn('credentials', { username: invite.email, password: form.password, redirect: false })
      setJoinedSlug(slug)
      setState('accepted')
      if (!login?.error && slug) router.push(`/workspace/${slug}`)
    } catch {
      setError(tc('generic'))
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || (state === 'pending' && session.status === 'loading')) {
    return <p className="py-16 text-center text-[15px] text-muted">{t('loading')}</p>
  }

  const role = invite ? t(`roles.${invite.role}`) : ''
  const sender = invite ? invite.sender.name || invite.sender.email : ''
  const chips: Record<State, { label: string; tone: string }> = {
    loading: { label: '', tone: '' },
    pending: otherEmail ? { label: t('otherChip'), tone: 'bg-warn-soft text-warn' } : { label: t('pendingChip'), tone: 'bg-warn-soft text-warn' },
    accepted: { label: t('acceptedChip'), tone: 'bg-ok-soft text-ok' },
    declined: { label: t('declinedChip'), tone: 'bg-plain-soft text-plain' },
    used: { label: t('usedChip'), tone: 'bg-plain-soft text-plain' },
    expired: { label: t('expiredChip'), tone: 'bg-plain-soft text-plain' },
    revoked: { label: t('revokedChip'), tone: 'bg-plain-soft text-plain' },
    invalid: { label: t('invalidChip'), tone: 'bg-plain-soft text-plain' },
  }
  const ws = invite?.workspace.name ?? ''
  const heading: Record<Exclude<State, 'loading'>, [string, string]> = {
    pending: otherEmail
      ? [t('otherTitle'), t('otherLead', { current: signedIn ?? '', invited: invite?.email ?? '' })]
      : [
          t('title', { sender, workspace: ws }),
          signedIn ? t('lead', { role }) : invite?.hasAccount === false ? t('joinLead', { role }) : t('loginLead', { role }),
        ],
    accepted: [t('acceptedTitle', { workspace: ws }), t('acceptedLead')],
    declined: [t('declinedTitle'), t('declinedLead')],
    used: [t('usedTitle'), t('usedLead')],
    expired: [t('expiredTitle'), t('expiredLead')],
    revoked: [t('revokedTitle'), t('revokedLead')],
    invalid: [t('invalidTitle'), t('invalidLead')],
  }
  const [title, lead] = heading[state]
  const date = invite ? new Date(invite.expiresAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''
  const button = (primary: boolean) => cn(primary ? inkButton : lineButton, 'h-[52px] flex-1 px-6 text-[15px] disabled:bg-muted')

  return (
    <div>
      <span className={cn('inline-flex items-center gap-2 rounded-ctl px-2.5 py-1 text-[12.5px] font-semibold', chips[state].tone)}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {chips[state].label}
      </span>
      <h1 className={cn(authTitle, 'mt-5 text-balance')}>{title}</h1>
      <p className="mt-3 text-[15.5px] leading-[1.65] text-fg/80">{lead}</p>

      {invite && state !== 'invalid' && (
        <div className="mt-7 overflow-hidden rounded-box border border-line bg-panel">
          <div className="flex items-center gap-3.5 border-b border-line px-5 py-[18px]">
            <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-ctl bg-plain-soft font-serif text-[20px] font-medium">
              {ws.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold">{ws}</p>
              {invite.workspace.description && <p className="truncate text-[13px] text-muted">{invite.workspace.description}</p>}
            </div>
          </div>
          <dl className="px-5 text-[14px]">
            {[
              [
                t('role'),
                <span key="r" className="rounded-[4px] bg-info-soft px-2 py-0.5 text-[13px] font-semibold text-info">
                  {invite.customPermissions ? t('customRole', { role }) : role}
                </span>,
              ],
              ...(invite.properties ? [[t('properties'), <span key="p">{invite.properties.join(', ')}</span>]] : []),
              [t('sender'), <span key="s" className="text-right">{sender}<br /><span className="text-[13px] text-muted">{invite.sender.email}</span></span>],
              [t('sentTo'), <b key="e" className="font-semibold">{invite.email}</b>],
              [t('expires'), date],
            ].map(([k, v], i) => (
              <div key={i} className="flex items-start justify-between gap-6 border-b border-line/70 py-3.5 last:border-b-0">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {error && <Notice tone="err">⚠ {error}</Notice>}

        {state === 'pending' && !otherEmail && signedIn && !confirmDecline && (
          <>
            <p className="text-[14px] text-fg/80">{t.rich('signedInAs', { email: signedIn, b: (c) => <b className="font-semibold text-fg">{c}</b> })}</p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button type="button" onClick={() => act('accept')} disabled={busy} className={button(true)}>
                {busy ? t('accepting') : t('accept')}
              </button>
              <button type="button" onClick={() => setConfirmDecline(true)} disabled={busy} className={cn(button(false), 'sm:flex-none')}>
                {t('decline')}
              </button>
            </div>
          </>
        )}
        {state === 'pending' && confirmDecline && (
          <div className="rounded-box border border-line bg-panel p-5">
            <p className="font-semibold">{t('declineTitle')}</p>
            <p className="mt-1.5 text-[14px] text-fg/80">{t('declineText', { sender })}</p>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => act('decline')}
                disabled={busy}
                className="inline-flex h-11 items-center justify-center rounded-ctl border border-err/40 px-5 text-[14px] font-medium text-err hover:bg-err-soft"
              >
                {t('declineConfirm')}
              </button>
              <button type="button" onClick={() => setConfirmDecline(false)} className={cn(lineButton, 'h-11 px-5 text-[14px]')}>
                {tc('back')}
              </button>
            </div>
          </div>
        )}
        {state === 'pending' && !signedIn && invite && invite.hasAccount === false && (
          <form onSubmit={join} noValidate className="flex flex-col gap-4 rounded-box border border-line bg-panel p-5">
            <p className="text-[14px] text-fg/80">{t.rich('joinAs', { email: invite.email, b: (c) => <b className="font-semibold text-fg">{c}</b> })}</p>
            <Field id="invite-name" label={t('name')} error={formErrors.name}>
              <input
                id="invite-name"
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass(!!formErrors.name)}
                {...describedBy('invite-name', formErrors.name)}
              />
            </Field>
            <Field id="invite-password" label={t('password')} error={formErrors.password} hint={t('passwordHint')}>
              <PasswordInput
                id="invite-password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                bad={!!formErrors.password}
                {...describedBy('invite-password', formErrors.password, t('passwordHint'))}
              />
              <StrengthMeter password={form.password} />
            </Field>
            <button type="submit" disabled={busy} className={cn(inkButton, 'h-[52px] w-full px-6 text-[15px] disabled:bg-muted')}>
              {busy ? t('joining') : t('join')}
            </button>
            <p className="text-[13px] text-muted">
              {t.rich('haveAccount', { link: (c) => <Link href={toLogin} className="font-medium text-fg underline underline-offset-2">{c}</Link> })}
            </p>
          </form>
        )}
        {state === 'pending' && !signedIn && invite && invite.hasAccount !== false && (
          <>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link href={toLogin} className={button(true)}>{t('loginToAccept')}</Link>
            </div>
            <p className="text-[13.5px] text-muted">{t('useEmail', { email: invite.email })}</p>
          </>
        )}
        {otherEmail && (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button type="button" onClick={() => signOut({ callbackUrl: toLogin })} className={button(true)}>
              {t('switchAccount')}
            </button>
            <Link href="/" className={button(false)}>{tc('home')}</Link>
          </div>
        )}
        {state === 'accepted' && (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href={joinedSlug ? `/workspace/${joinedSlug}` : '/workspaces'} className={button(true)}>
              {joinedSlug ? t('openWorkspace', { workspace: ws }) : t('openWorkspaces')}
            </Link>
          </div>
        )}
        {state === 'used' && (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href={signedIn ? '/workspaces' : toLogin} className={button(true)}>{signedIn ? t('openWorkspaces') : t('login')}</Link>
            <Link href="/" className={button(false)}>{tc('home')}</Link>
          </div>
        )}
        {(state === 'expired' || state === 'declined' || state === 'revoked') && invite && (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <a href={`mailto:${invite.sender.email}`} className={button(true)}>{t('askResend')}</a>
            <Link href="/" className={button(false)}>{tc('home')}</Link>
          </div>
        )}
        {state === 'invalid' && (
          // A lone button still sits in a row: `flex-1` in the column above would squash it.
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href="/" className={button(false)}>{tc('home')}</Link>
          </div>
        )}
      </div>
    </div>
  )
}
