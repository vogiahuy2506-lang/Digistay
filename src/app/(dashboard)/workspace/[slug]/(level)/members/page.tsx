'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { History, Lock, LockOpen, Mail, MoreVertical, RotateCw, ShieldCheck, Trash2, UserPlus, Users, XCircle } from 'lucide-react'
import { TitleBlock } from '@/components/layout'
import { Avatar, Button, Dropdown, DropdownDivider, DropdownItem, Loading, Modal, ModalBody, ModalFooter, toast } from '@/components/ui'
import { NoAccess } from '@/components/payment/no-access'
import { useCan } from '@/components/layout/workspace-context'
import { AccessEditor, type AccessValue, type EditorLimits } from '@/components/members/access-editor'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'
import { routes } from '@/lib/utils/routes'
import { cn } from '@/lib/utils'
import { PERMISSIONS, ROLE_PRESETS, type Permission, type Role } from '@/lib/auth/permissions'

interface Person {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface Member {
  id: string
  user: Person
  role: Role
  customPermissions: boolean
  permissions: Permission[]
  allProperties: boolean
  propertyIds: string[]
  joinedAt: string
  disabledAt: string | null
  planLockedAt: string | null
  isSelf: boolean
  /** Why the caller may not change them (the API's message), or null. */
  locked: string | null
}

interface MembersData {
  owner: Person & { joinedAt: string; isSelf: boolean }
  members: Member[]
  properties: { id: string; name: string }[]
  seats: { used: number; limit: number | null }
  me: EditorLimits
}

interface Invitation {
  id: string
  email: string
  role: Role
  customPermissions: boolean
  allProperties: boolean
  propertyIds: string[]
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED'
  createdAt: string
  expiresAt: string
  sender: Person
}

interface ActivityRow {
  id: string
  action: string
  at: string
  actor: { name: string | null; email: string } | null
  subject: { email: string; name: string | null }
  changes: { role?: [Role, Role] | Role; added?: Permission[]; removed?: Permission[]; properties?: [unknown, unknown] } | null
}

type Tab = 'members' | 'invitations' | 'activity'
type Confirm =
  | { kind: 'remove'; member: Member }
  | { kind: 'lock'; member: Member }
  | { kind: 'revoke'; invitation: Invitation }

const NEW_MEMBER: AccessValue = { role: 'RECEPTIONIST', permissions: [...ROLE_PRESETS.RECEPTIONIST], allProperties: true, propertyIds: [] }

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, error: apiError(data.error) as string | undefined }
}

/**
 * Members, like UKNOW's staff page: who works in the workspace, what each
 * may do and where, the invitations sent (resend, cancel) and the log of
 * what was done to members (members_manage).
 */
export default function MembersPage() {
  const t = useTranslations('dash.members')
  const labels = useDashLabels()
  const params = useParams<{ slug: string }>()
  const allowed = useCan('members_manage')
  const { workspace, loading: wsLoading } = useWorkspace()
  const workspaceId = workspace?.id

  const [tab, setTab] = React.useState<Tab>('members')
  const [data, setData] = React.useState<MembersData | null>(null)
  const [invitations, setInvitations] = React.useState<Invitation[]>([])
  const [activity, setActivity] = React.useState<ActivityRow[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState('')
  const [editing, setEditing] = React.useState<{ mode: 'invite' } | { mode: 'edit'; member: Member } | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState('')
  const [confirm, setConfirm] = React.useState<Confirm | null>(null)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!workspaceId) return
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`, { cache: 'no-store' }),
        fetch(`/api/workspaces/${workspaceId}/invitations`, { cache: 'no-store' }),
      ])
      const [membersJson, invitationsJson] = await Promise.all([membersRes.json(), invitationsRes.json()])
      if (!membersJson.success) {
        setLoadError(apiError(membersJson.error) || t('toast.failed'))
        return
      }
      setData(membersJson.data)
      if (invitationsJson.success) setInvitations(invitationsJson.data)
      setLoadError('')
    } catch {
      setLoadError(t('toast.failed'))
    } finally {
      setLoading(false)
    }
  }, [workspaceId, t])

  const loadActivity = React.useCallback(async () => {
    if (!workspaceId) return
    const res = await fetch(`/api/workspaces/${workspaceId}/members/activity`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    setActivity(json?.success ? json.data : [])
  }, [workspaceId])

  React.useEffect(() => {
    if (allowed) load()
  }, [allowed, load])
  React.useEffect(() => {
    if (tab === 'activity' && allowed) loadActivity()
  }, [tab, allowed, loadActivity])

  // After a change: the lists, and the log if it is open.
  const refresh = async () => {
    await load()
    if (tab === 'activity') await loadActivity()
    else setActivity(null)
  }

  if (!allowed) return <NoAccess title={t('title')} inPage />
  if (wsLoading || (loading && !loadError)) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loading size="lg" />
      </div>
    )
  }
  if (!data) {
    return (
      <div>
        <TitleBlock title={t('title')} />
        <p role="alert" className="mt-6 rounded-box border border-line bg-panel px-6 py-10 text-center text-body text-err">
          {loadError}
        </p>
      </div>
    )
  }

  const nameOf = (p: { name: string | null; email: string }) => p.name || p.email
  const date = (iso: string) => labels.date(iso)
  const propertyName = new Map(data.properties.map((p) => [p.id, p.name]))
  const seatsFull = data.seats.limit != null && data.seats.used >= data.seats.limit
  const pending = invitations.filter((i) => i.status === 'PENDING').length

  const submitAccess = async (value: AccessValue & { email?: string }) => {
    if (!workspaceId || !editing) return
    setSaving(true)
    setFormError('')
    const { email, ...grant } = value
    const result =
      editing.mode === 'invite'
        ? await send(`/api/workspaces/${workspaceId}/invitations`, 'POST', { email, ...grant })
        : await send(`/api/workspaces/${workspaceId}/members/${editing.member.id}`, 'PATCH', grant)
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error || t('toast.failed'))
      return
    }
    toast.success(editing.mode === 'invite' ? t('toast.invited', { email: email ?? '' }) : t('toast.updated', { name: nameOf(editing.member.user) }))
    if (editing.mode === 'invite') setTab('invitations')
    setEditing(null)
    await refresh()
  }

  const act = async (run: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true)
    const result = await run()
    setBusy(false)
    setConfirm(null)
    if (!result.ok) {
      toast.error(t('toast.failed'), result.error)
      return
    }
    toast.success(success)
    await refresh()
  }

  const setDisabled = (member: Member, disabled: boolean) =>
    act(
      () => send(`/api/workspaces/${workspaceId}/members/${member.id}`, 'PATCH', { disabled }),
      t(disabled ? 'toast.locked' : 'toast.unlocked', { name: nameOf(member.user) })
    )
  const remove = (member: Member) =>
    act(() => send(`/api/workspaces/${workspaceId}/members/${member.id}`, 'DELETE'), t('toast.removed', { name: nameOf(member.user) }))
  const resend = (invitation: Invitation) =>
    act(() => send(`/api/workspaces/${workspaceId}/invitations/${invitation.id}/resend`, 'POST'), t('toast.resent', { email: invitation.email }))
  const revoke = (invitation: Invitation) =>
    act(() => send(`/api/workspaces/${workspaceId}/invitations/${invitation.id}`, 'DELETE'), t('toast.revoked', { email: invitation.email }))

  const scopeText = (all: boolean, ids: string[]) =>
    all ? t('allProperties') : ids.length === 1 ? propertyName.get(ids[0]) ?? t('someProperties', { count: 1 }) : t('someProperties', { count: ids.length })
  const scopeTitle = (all: boolean, ids: string[]) => (all ? undefined : ids.map((id) => propertyName.get(id)).filter(Boolean).join(', '))

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'members', label: t('tabs.members'), icon: <Users className="h-4 w-4" aria-hidden="true" />, count: data.members.length + 1 },
    { key: 'invitations', label: t('tabs.invitations'), icon: <Mail className="h-4 w-4" aria-hidden="true" />, count: pending || undefined },
    { key: 'activity', label: t('tabs.activity'), icon: <History className="h-4 w-4" aria-hidden="true" /> },
  ]

  return (
    <div>
      <TitleBlock
        title={t('title')}
        lead={t('lead')}
        actions={
          <Button onClick={() => { setFormError(''); setEditing({ mode: 'invite' }) }} disabled={seatsFull}>
            <UserPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t('invite')}
          </Button>
        }
      />

      {data.seats.limit != null && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-box border border-line bg-panel px-4 py-3">
          <div className="min-w-[200px] flex-1">
            <p className="text-small text-fg">{t('seats', { used: data.seats.used, limit: data.seats.limit })}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10" aria-hidden="true">
              <div
                className={cn('h-full rounded-full', seatsFull ? 'bg-warn' : 'bg-acc')}
                style={{ width: `${Math.min(100, (data.seats.used / Math.max(1, data.seats.limit)) * 100)}%` }}
              />
            </div>
          </div>
          {seatsFull && (
            <p className="flex items-center gap-3 text-small text-warn">
              {t('seatsFull')}
              {data.me.permissions.includes('billing_manage') && (
                <Link href={routes.billing(params.slug)} className="font-semibold underline underline-offset-4">
                  {t('upgrade')}
                </Link>
              )}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-fg/5 p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition',
              tab === item.key ? 'bg-panel text-acc shadow-sm' : 'text-muted hover:text-fg'
            )}
          >
            {item.icon}
            {item.label}
            {item.count != null && <span className="text-xs tabular-nums text-muted">{item.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'members' && (
        <div className="mt-4 overflow-hidden rounded-box border border-line bg-panel">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-4 border-b border-line px-5 py-2.5 text-label uppercase text-muted lg:grid">
            <span>{t('columns.person')}</span>
            <span>{t('columns.role')}</span>
            <span>{t('columns.properties')}</span>
            <span>{t('columns.status')}</span>
            <span className="w-[132px]" />
          </div>
          <ul className="divide-y divide-line">
            <li className="grid items-center gap-x-4 gap-y-2 px-5 py-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
              <PersonCell person={data.owner} you={data.owner.isSelf ? t('you') : null} noName={t('noName')} />
              <span className="text-small font-semibold text-fg">{t('owner')}</span>
              <span className="text-small text-muted">{t('ownerAccess')}</span>
              <span>
                <StatusBadge tone="ok">{t('status.active')}</StatusBadge>
              </span>
              <span className="hidden w-[132px] lg:block" />
            </li>
            {data.members.map((member) => {
              const status = member.planLockedAt ? 'planLocked' : member.disabledAt ? 'disabled' : 'active'
              return (
                <li
                  key={member.id}
                  className="grid items-center gap-x-4 gap-y-2 px-5 py-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]"
                >
                  <PersonCell person={member.user} you={member.isSelf ? t('you') : null} noName={t('noName')} />
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-small text-fg">
                    <span className="font-medium">{labels.role(member.role)}</span>
                    {member.customPermissions && (
                      <span className="rounded-sm bg-info-soft px-1.5 py-0.5 text-[11px] font-medium text-info">
                        {t('custom')} · {t('permissionCount', { count: member.permissions.length, total: PERMISSIONS.length })}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-small text-muted" title={scopeTitle(member.allProperties, member.propertyIds)}>
                    {scopeText(member.allProperties, member.propertyIds)}
                  </span>
                  <span className="min-w-0">
                    <StatusBadge tone={status === 'active' ? 'ok' : 'err'}>{t(`status.${status}`)}</StatusBadge>
                    {status !== 'active' && (
                      <span
                        className="mt-1 block text-[12px] leading-snug text-muted"
                        title={status === 'planLocked' ? t('planLockedNote') : t('disabledHint')}
                      >
                        {status === 'planLocked' ? t('planLockedShort') : t('disabledNote', { date: date(member.disabledAt!) })}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 lg:w-[132px] lg:justify-end">
                    {!member.locked && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setFormError(''); setEditing({ mode: 'edit', member }) }}
                        >
                          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          {t('actions.edit')}
                        </Button>
                        <Dropdown
                          align="right"
                          className="min-w-[200px]"
                          trigger={
                            <button
                              type="button"
                              aria-label={t('actions.menu', { name: nameOf(member.user) })}
                              aria-haspopup="menu"
                              className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-160 hover:bg-fg/5 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>
                          }
                        >
                          {member.disabledAt ? (
                            <DropdownItem icon={<LockOpen className="h-4 w-4" />} onClick={() => setDisabled(member, false)}>
                              {t('actions.unlock')}
                            </DropdownItem>
                          ) : (
                            <DropdownItem icon={<Lock className="h-4 w-4" />} onClick={() => setConfirm({ kind: 'lock', member })}>
                              {t('actions.lock')}
                            </DropdownItem>
                          )}
                          <DropdownDivider />
                          <DropdownItem danger icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm({ kind: 'remove', member })}>
                            {t('actions.remove')}
                          </DropdownItem>
                        </Dropdown>
                      </>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          {data.members.length === 0 && (
            <div className="border-t border-line px-6 py-10 text-center">
              <p className="text-body font-medium text-fg">{t('empty.title')}</p>
              <p className="mx-auto mt-1 max-w-md text-small text-muted">{t('empty.text')}</p>
              <Button className="mt-4" onClick={() => { setFormError(''); setEditing({ mode: 'invite' }) }} disabled={seatsFull}>
                {t('empty.action')}
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === 'invitations' && (
        <div className="mt-4 overflow-hidden rounded-box border border-line bg-panel">
          {invitations.length === 0 ? (
            <p className="px-6 py-10 text-center text-small text-muted">{t('invitations.empty')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {invitations.map((invitation) => {
                const open = invitation.status === 'PENDING'
                return (
                  <li key={invitation.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-body font-medium text-fg">{invitation.email}</span>
                        <StatusBadge tone={open ? 'warn' : invitation.status === 'ACCEPTED' ? 'ok' : 'plain'}>
                          {t(`invitations.status.${invitation.status}`)}
                        </StatusBadge>
                      </p>
                      <p className="mt-1 text-small text-muted">
                        {labels.role(invitation.role)}
                        {invitation.customPermissions && ` (${t('custom')})`} · {scopeText(invitation.allProperties, invitation.propertyIds)}
                      </p>
                      <p className="mt-0.5 text-small text-muted">
                        {t('invitations.sent', { name: nameOf(invitation.sender), date: date(invitation.createdAt) })}
                        {open && ` · ${t('invitations.expires', { date: date(invitation.expiresAt) })}`}
                      </p>
                    </div>
                    {(open || invitation.status === 'EXPIRED') && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => resend(invitation)}>
                          <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          {t('invitations.resend')}
                        </Button>
                        {open && (
                          <Button size="sm" variant="danger-outline" disabled={busy} onClick={() => setConfirm({ kind: 'revoke', invitation })}>
                            <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            {t('invitations.revoke')}
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="mt-4 overflow-hidden rounded-box border border-line bg-panel">
          {activity === null ? (
            <div className="flex justify-center py-12">
              <Loading />
            </div>
          ) : activity.length === 0 ? (
            <p className="px-6 py-10 text-center text-small text-muted">{t('activity.empty')}</p>
          ) : (
            <ol className="divide-y divide-line">
              {activity.map((row) => (
                <ActivityItem key={row.id} row={row} scopeAll={t('activity.all')} />
              ))}
            </ol>
          )}
        </div>
      )}

      <AccessEditor
        open={editing !== null}
        mode={editing?.mode ?? 'invite'}
        name={editing?.mode === 'edit' ? nameOf(editing.member.user) : undefined}
        initial={
          editing?.mode === 'edit'
            ? {
                role: editing.member.role,
                permissions: editing.member.permissions,
                allProperties: editing.member.allProperties,
                propertyIds: editing.member.propertyIds,
              }
            : NEW_MEMBER
        }
        properties={data.properties}
        limits={data.me}
        saving={saving}
        error={formError}
        onClose={() => setEditing(null)}
        onSubmit={submitAccess}
      />

      <Modal isOpen={confirm !== null} onClose={() => setConfirm(null)} size="sm" title={confirmTitle(confirm, t, nameOf)} showHeader>
        <ModalBody>
          <p className="text-body text-fg/80">
            {confirm?.kind === 'remove' ? t('confirmRemove.text') : confirm?.kind === 'lock' ? t('confirmLock.text') : t('invitations.confirmRevoke.text')}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setConfirm(null)}>
            {t('editor.cancel')}
          </Button>
          <Button
            variant="danger"
            isLoading={busy}
            onClick={() => {
              if (confirm?.kind === 'remove') remove(confirm.member)
              else if (confirm?.kind === 'lock') setDisabled(confirm.member, true)
              else if (confirm?.kind === 'revoke') revoke(confirm.invitation)
            }}
          >
            {confirm?.kind === 'remove' ? t('confirmRemove.confirm') : confirm?.kind === 'lock' ? t('confirmLock.confirm') : t('invitations.confirmRevoke.confirm')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

function confirmTitle(
  confirm: Confirm | null,
  t: ReturnType<typeof useTranslations<'dash.members'>>,
  nameOf: (p: { name: string | null; email: string }) => string
) {
  if (!confirm) return ''
  if (confirm.kind === 'revoke') return t('invitations.confirmRevoke.title', { email: confirm.invitation.email })
  return t(confirm.kind === 'remove' ? 'confirmRemove.title' : 'confirmLock.title', { name: nameOf(confirm.member.user) })
}

function PersonCell({ person, you, noName }: { person: Person; you: string | null; noName: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar src={person.image ?? undefined} name={person.name || person.email} size="md" />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-body font-medium text-fg">{person.name || noName}</span>
          {you && <span className="shrink-0 rounded-sm bg-plain-soft px-1.5 py-0.5 text-[11px] text-plain">{you}</span>}
        </span>
        <span className="block truncate text-small text-muted">{person.email}</span>
      </span>
    </span>
  )
}

function StatusBadge({ tone, children }: { tone: 'ok' | 'err' | 'warn' | 'plain'; children: React.ReactNode }) {
  const tones = {
    ok: 'bg-ok-soft text-ok',
    err: 'bg-err-soft text-err',
    warn: 'bg-warn-soft text-warn',
    plain: 'bg-plain-soft text-plain',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[12px] font-medium', tones[tone])}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

const ACTIONS = [
  'MEMBER_INVITED',
  'INVITE_RESENT',
  'INVITE_REVOKED',
  'INVITE_ACCEPTED',
  'INVITE_DECLINED',
  'MEMBER_UPDATED',
  'MEMBER_LOCKED',
  'MEMBER_UNLOCKED',
  'MEMBER_REMOVED',
  'MEMBER_LEFT',
] as const

/** One line of the log: who did what to whom, when, and for a change what changed. */
function ActivityItem({ row, scopeAll }: { row: ActivityRow; scopeAll: string }) {
  const t = useTranslations('dash.members')
  const labels = useDashLabels()
  const action = ACTIONS.find((a) => a === row.action)
  if (!action) return null
  const actor = row.actor ? row.actor.name || row.actor.email : t('activity.someone')
  const subject = row.subject.name || row.subject.email
  const c = row.changes
  const details: string[] = []
  if (action === 'MEMBER_UPDATED' && c) {
    if (Array.isArray(c.role) && c.role[0] !== c.role[1]) details.push(t('activity.role', { from: labels.role(c.role[0]), to: labels.role(c.role[1]) }))
    const perm = (list: Permission[]) => list.map((p) => t(`perm.${p}.label`)).join(', ')
    if (c.added?.length) details.push(t('activity.added', { list: perm(c.added) }))
    if (c.removed?.length) details.push(t('activity.removed', { list: perm(c.removed) }))
    if (Array.isArray(c.properties) && c.properties[0] !== c.properties[1]) {
      const scope = (v: unknown) => (v === 'all' ? scopeAll : t('someProperties', { count: Number(v) || 0 }))
      details.push(t('activity.properties', { from: scope(c.properties[0]), to: scope(c.properties[1]) }))
    }
  }
  return (
    <li className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-6">
      <time dateTime={row.at} className="shrink-0 text-small tabular-nums text-muted sm:w-36">
        {labels.dateTime(row.at)}
      </time>
      <div className="min-w-0 text-body text-fg">
        <p>{t.rich(`activity.${action}`, { actor, subject, b: (chunks) => <b className="font-semibold">{chunks}</b> })}</p>
        {details.map((line) => (
          <p key={line} className="mt-0.5 text-small text-muted">
            {line}
          </p>
        ))}
      </div>
    </li>
  )
}
