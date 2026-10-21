'use client'

import * as React from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { inkButton, lineButton } from '@/components/marketing/styles'
import { cn } from '@/lib/utils'
import { Notice, authTitle } from '@/app/(auth)/_components/ui'

interface Invitation {
  email: string
  role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'
  status: string
  expiresAt: string
  workspace: { id: string; name: string; description: string | null }
  sender: { name: string | null; email: string }
}

type State = 'loading' | 'pending' | 'accepted' | 'declined' | 'used' | 'expired' | 'invalid'

/**
 * An invitation to a workspace (Claude Design "Digistay Loi Moi"): who
 * invites whom, with which role; accept or decline once signed in with the
 * invited email. The accept / decline routes check that email again.
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

  React.useEffect(() => {
    let live = true
    fetch(`/api/invitations/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!live) return
        if (!data.data) return setState('invalid')
        setInvite(data.data)
        const s = data.data.status
        setState(s === 'EXPIRED' ? 'expired' : s === 'PENDING' ? 'pending' : s === 'DECLINED' ? 'declined' : 'used')
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
      if (res.ok) return setState(what === 'accept' ? 'accepted' : 'declined')
      if (res.status === 400 && /hết hạn/.test(data.error ?? '')) return setState('expired')
      if (res.status === 400) return setState('used')
      setError(locale === 'vi' && data.error ? data.error : tc('generic'))
    } catch {
      setError(tc('generic'))
    } finally {
      setBusy(false)
      setConfirmDecline(false)
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
    invalid: { label: t('invalidChip'), tone: 'bg-plain-soft text-plain' },
  }
  const ws = invite?.workspace.name ?? ''
  const heading: Record<Exclude<State, 'loading'>, [string, string]> = {
    pending: otherEmail
      ? [t('otherTitle'), t('otherLead', { current: signedIn ?? '', invited: invite?.email ?? '' })]
      : [t('title', { sender, workspace: ws }), signedIn ? t('lead', { role }) : t('loginLead', { role })],
    accepted: [t('acceptedTitle', { workspace: ws }), t('acceptedLead')],
    declined: [t('declinedTitle'), t('declinedLead')],
    used: [t('usedTitle'), t('usedLead')],
    expired: [t('expiredTitle'), t('expiredLead')],
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
              [t('role'), <span key="r" className="rounded-[4px] bg-info-soft px-2 py-0.5 text-[13px] font-semibold text-info">{role}</span>],
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
        {state === 'pending' && !signedIn && invite && (
          <>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link href={toLogin} className={button(true)}>{t('loginToAccept')}</Link>
              <Link href="/register" className={button(false)}>{t('createAccount')}</Link>
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
          <Link href="/workspaces" className={button(true)}>{t('openWorkspaces')}</Link>
        )}
        {state === 'used' && (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href={signedIn ? '/workspaces' : toLogin} className={button(true)}>{signedIn ? t('openWorkspaces') : t('login')}</Link>
            <Link href="/" className={button(false)}>{tc('home')}</Link>
          </div>
        )}
        {(state === 'expired' || state === 'declined') && invite && (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <a href={`mailto:${invite.sender.email}`} className={button(true)}>{t('askResend')}</a>
            <Link href="/" className={button(false)}>{tc('home')}</Link>
          </div>
        )}
        {state === 'invalid' && (
          <Link href="/" className={button(false)}>{tc('home')}</Link>
        )}
      </div>
    </div>
  )
}
