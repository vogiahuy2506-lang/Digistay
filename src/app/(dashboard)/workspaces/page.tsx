'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Alert,
  AlertDescription,
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  Input,
  Loading,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { ArrowRight, Building2, MoreVertical, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { apiError } from '@/lib/i18n/api-errors'
import { uploadPhoto } from '@/lib/media/upload-client'
import { useUploadProblemText } from '@/components/ui/photo-upload'
import { AccountTopBar } from './account-top-bar'
import { BUSINESS_TYPES, CURRENCIES, TIMEZONES, type BusinessType, workspaceSettingsOf } from './options'
import { finishSlugInput, onNameTyped, onSlugTyped, slugFromName } from './slug-input'
import { DeleteWorkspaceDialog } from '@/components/deletion/delete-workspace-dialog'
import { RecentlyDeleted } from '@/components/deletion/recently-deleted'

interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  ownerId: string
  settings?: unknown
  members?: { userId: string; role: string }[]
  _count: { properties: number; members: number }
}

interface CurrentUser {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface Invitation {
  id: string
  token: string
  role: string
  status: string
  message?: string
  workspace: { id: string; name: string; slug: string }
  // /api/users/me/invitations includes the sender as `sender`.
  sender: { id: string; name: string | null; email: string }
}

/** createWorkspaceSchema's limit for the short name. */
const SLUG_MAX = 100

const emptyForm = {
  name: '',
  slug: '',
  /** The short name was typed by hand: it no longer follows the name. */
  slugEdited: false,
  description: '',
  logo: null as string | null,
  businessType: 'boutique_hotel' as BusinessType,
  currency: 'VND',
  timezone: 'GMT+07:00',
}

export default function WorkspacesPage() {
  const t = useTranslations('workspaces')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [user, setUser] = React.useState<CurrentUser | null>(null)
  const [invitations, setInvitations] = React.useState<Invitation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [tab, setTab] = React.useState<'all' | 'owned' | 'invited'>('all')
  const [query, setQuery] = React.useState('')

  const [form, setForm] = React.useState(emptyForm)
  const [formError, setFormError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [editing, setEditing] = React.useState<Workspace | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  /** The workspace in the delete dialog (src/lib/deletion); bumping deletedVersion reloads "Đã xoá gần đây". */
  const [deleting, setDeleting] = React.useState<Workspace | null>(null)
  const [deletedVersion, setDeletedVersion] = React.useState(0)

  const fetchWorkspaces = React.useCallback(async () => {
    const [listRes, meRes] = await Promise.all([fetch('/api/workspaces'), fetch('/api/users/me')])
    if (listRes.status === 401 || meRes.status === 401) {
      router.push('/login')
      return
    }
    const [list, me] = await Promise.all([listRes.json(), meRes.json()])
    if (list.success) setWorkspaces(list.data)
    if (me.success) setUser(me.data)
  }, [router])

  const fetchInvitations = React.useCallback(async () => {
    try {
      const res = await fetch('/api/users/me/invitations')
      if (!res.ok) return
      const data = await res.json()
      if (data.success) {
        setInvitations(data.data.filter((inv: Invitation) => inv.status === 'PENDING'))
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err)
    }
  }, [])

  React.useEffect(() => {
    Promise.all([fetchWorkspaces(), fetchInvitations()]).finally(() => setLoading(false))
  }, [fetchWorkspaces, fetchInvitations])

  // ?createWorkspace=true&hotelName=…&scale=… pre-fills the create form, so a
  // link from the marketing pages still lands on a ready-to-submit dialog.
  React.useEffect(() => {
    if (searchParams.get('createWorkspace') !== 'true') return
    const name = searchParams.get('hotelName') ?? ''
    const scale = searchParams.get('scale')
    setForm({
      ...emptyForm,
      name,
      slug: slugFromName(name, SLUG_MAX),
      businessType: scale === '1-5' ? 'homestay' : scale === '20+' ? 'resort' : 'boutique_hotel',
    })
    setEditing(null)
    setCreateOpen(true)
  }, [searchParams])

  const owned = React.useMemo(
    () => workspaces.filter((ws) => ws.ownerId === user?.id),
    [workspaces, user]
  )
  const invited = React.useMemo(
    () => workspaces.filter((ws) => ws.ownerId !== user?.id),
    [workspaces, user]
  )

  const visible = React.useMemo(() => {
    const pool = tab === 'owned' ? owned : tab === 'invited' ? invited : workspaces
    const q = query.trim().toLowerCase()
    if (!q) return pool
    return pool.filter((ws) => ws.name.toLowerCase().includes(q) || ws.slug.toLowerCase().includes(q))
  }, [tab, owned, invited, workspaces, query])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError('')
    setEditing(null)
    setCreateOpen(true)
  }

  const openEdit = (ws: Workspace) => {
    setForm({
      name: ws.name,
      slug: ws.slug,
      slugEdited: true,
      description: ws.description ?? '',
      logo: ws.logo,
      // What the workspace has saved, not the defaults of a new one.
      ...workspaceSettingsOf(ws.settings),
    })
    setFormError('')
    setEditing(ws)
    setCreateOpen(true)
  }

  const closeForm = () => {
    setCreateOpen(false)
    setEditing(null)
    setFormError('')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setFormError('')
    // Only what the API takes: the short name is set once, at creation (it is
    // in every address of the workspace); no logo is null when editing (removes
    // it) and left out when creating.
    const shared = {
      name: form.name.trim(),
      description: form.description,
      businessType: form.businessType,
      currency: form.currency,
      timezone: form.timezone,
    }
    const slug = finishSlugInput(form.slug)
    const body = editing
      ? { ...shared, logo: form.logo }
      : { ...shared, ...(slug && { slug }), ...(form.logo && { logo: form.logo }) }
    try {
      const res = await fetch(editing ? `/api/workspaces/${editing.id}` : '/api/workspaces', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(apiError(data.error) || t('form.failed'))
        return
      }
      closeForm()
      if (editing) {
        await fetchWorkspaces()
        toast.success(t('form.editSubmit'))
      } else {
        await fetchWorkspaces()
        router.push(routes.workspace(data.data.slug))
      }
    } catch {
      setFormError(t('form.failed'))
    } finally {
      setSaving(false)
    }
  }

  // Deleting asks for the name and says what happens (DeleteWorkspaceDialog).
  const remove = (ws: Workspace) => setDeleting(ws)

  const removed = async () => {
    setDeleting(null)
    await fetchWorkspaces()
    setDeletedVersion((v) => v + 1)
  }

  const answerInvitation = async (invitation: Invitation, accept: boolean) => {
    // The token endpoint, so this page and /invitations/[token] share one path.
    const res = await fetch(`/api/invitations/${invitation.token}/${accept ? 'accept' : 'decline'}`, {
      method: 'POST',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(apiError(data.error) || t('form.failed'))
      return
    }
    toast.success(t(accept ? 'invitations.accept' : 'invitations.decline'))
    await Promise.all([fetchInvitations(), fetchWorkspaces()])
  }

  // An empty tab says why it is empty: nothing matches the search, or nothing
  // of that kind exists yet (the invitations waiting are listed below).
  const emptyText = (() => {
    if (workspaces.length === 0) return { title: t('empty.title'), text: t('empty.text') }
    if (query.trim()) return { title: t('noMatch.title'), text: t('noMatch.text') }
    if (tab === 'invited') {
      return invitations.length > 0
        ? { title: t('emptyInvited.pendingTitle'), text: t('emptyInvited.pending', { count: invitations.length }) }
        : { title: t('emptyInvited.title'), text: t('emptyInvited.text') }
    }
    return { title: t('emptyOwned.title'), text: t('emptyOwned.text') }
  })()

  return (
    <div className="min-h-screen flex flex-col">
      {/* One slim bar: brand, then the account menu. No marketing header. */}
      <AccountTopBar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="max-w-xl">
            <h1 className="font-serif text-[30px] leading-[1.15] tracking-[-0.02em] text-fg sm:text-[38px]">
              {t('title')}
            </h1>
            <p className="mt-2 text-small text-muted sm:text-body">{t('lead')}</p>
          </div>
          <Button onClick={openCreate} className="shrink-0 self-start sm:self-auto">
            <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {t('create')}
          </Button>
        </div>

        <div className="mt-9 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList variant="underline">
              <TabsTrigger value="all">
                {t('filter.all')}
                <Count value={workspaces.length} />
              </TabsTrigger>
              <TabsTrigger value="owned">
                {t('filter.owned')}
                <Count value={owned.length} />
              </TabsTrigger>
              <TabsTrigger value="invited">
                {t('filter.invited')}
                <Count value={invited.length} />
                {/* Invitations not answered yet are listed below the workspaces. */}
                {invitations.length > 0 && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-acc align-middle" aria-hidden="true" />
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="sm:w-64">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('search')}
              icon={<Search className="w-4 h-4" aria-hidden="true" />}
            />
          </div>
        </div>

        {loading ? (
          <Loading className="py-20" text={t('searchPlaceholder')} />
        ) : visible.length === 0 ? (
          <div className="mt-6 rounded-box border border-line bg-panel px-6 py-16 text-center">
            <p className="text-body text-fg">{emptyText.title}</p>
            <p className="mt-1.5 text-small text-muted">{emptyText.text}</p>
            {(workspaces.length === 0 || (tab === 'owned' && !query.trim())) && (
              <Button className="mt-6" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
                {t('empty.action')}
              </Button>
            )}
          </div>
        ) : (
          <ul className="mt-6 border-t border-line">
            {visible.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                workspace={ws}
                isOwner={ws.ownerId === user?.id}
                role={ws.members?.find((m) => m.userId === user?.id)?.role}
                labels={{
                  open: t('open'),
                  properties: t('properties', { count: ws._count.properties }),
                  members: t('members', { count: ws._count.members }),
                  owner: t('owner'),
                  edit: t('actions.edit'),
                  remove: t('actions.delete'),
                }}
                roleLabel={(role) =>
                  role === 'ADMIN' || role === 'MANAGER' || role === 'RECEPTIONIST' || role === 'USER'
                    ? t(`roles.${role}`)
                    : role
                }
                onEdit={() => openEdit(ws)}
                onRemove={() => remove(ws)}
              />
            ))}
          </ul>
        )}

        {invitations.length > 0 && (
          <section className="mt-14">
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="text-body font-semibold text-fg">{t('invitations.title')}</h2>
              <span className="text-small text-muted tabular-nums">
                {t('invitations.pending', { count: invitations.length })}
              </span>
            </div>
            <ul className="border-b border-line">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-fg truncate">{invitation.workspace.name}</p>
                    <p className="mt-0.5 text-small text-muted">
                      {t('invitations.proposedRole', {
                        role:
                          invitation.role === 'ADMIN' ||
                          invitation.role === 'MANAGER' ||
                          invitation.role === 'RECEPTIONIST' ||
                          invitation.role === 'USER'
                            ? t(`roles.${invitation.role}`)
                            : invitation.role,
                      })}
                    </p>
                    <p className="mt-0.5 text-small text-muted truncate">
                      {t('invitations.from', {
                        sender: invitation.sender?.name || invitation.sender?.email,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" onClick={() => answerInvitation(invitation, true)}>
                      {t('invitations.accept')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => answerInvitation(invitation, false)}>
                      {t('invitations.decline')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* The owner's workspaces deleted in the last 30 days, to restore. */}
        <RecentlyDeleted kind="workspace" reloadKey={deletedVersion} />
      </main>

      <DeleteWorkspaceDialog
        workspaceId={deleting?.id ?? null}
        workspaceName={deleting?.name}
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onDeleted={removed}
      />

      <WorkspaceFormModal
        open={createOpen}
        editing={editing}
        form={form}
        error={formError}
        saving={saving}
        onFormChange={setForm}
        onClose={closeForm}
        onSubmit={submit}
      />
    </div>
  )
}

function Count({ value }: { value: number }) {
  return <span className="ml-1.5 text-xs text-muted tabular-nums">{value}</span>
}

interface WorkspaceRowProps {
  workspace: Workspace
  isOwner: boolean
  role?: string
  labels: {
    open: string
    properties: string
    members: string
    owner: string
    edit: string
    remove: string
  }
  roleLabel: (role: string) => string
  onEdit: () => void
  onRemove: () => void
}

/** One row: name and slug on the left, counts, then the way in. */
function WorkspaceRow({ workspace, isOwner, role, labels, roleLabel, onEdit, onRemove }: WorkspaceRowProps) {
  const menuTrigger = (
    <button
      type="button"
      aria-label={labels.edit}
      aria-haspopup="menu"
      className="w-8 h-8 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
    >
      <MoreVertical className="w-4 h-4" aria-hidden="true" />
    </button>
  )

  return (
    <li className="border-b border-line">
      <div className="flex items-center gap-3 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <Building2 className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            <Link
              href={routes.workspace(workspace.slug)}
              className="text-body font-medium text-fg truncate hover:text-acc rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              {workspace.name}
            </Link>
            <span className="shrink-0 rounded-sm bg-plain-soft px-1.5 py-0.5 text-[11px] text-plain">
              {isOwner ? labels.owner : role ? roleLabel(role) : ''}
            </span>
          </div>
          {workspace.description && (
            <p className="mt-1 text-small text-muted line-clamp-1">{workspace.description}</p>
          )}
          <p className="mt-1.5 text-small text-muted flex items-center gap-3 flex-wrap">
            <span className="tabular-nums">{labels.properties}</span>
            <span aria-hidden="true" className="w-px h-3 bg-line" />
            <span className="flex items-center gap-1.5 tabular-nums">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              {labels.members}
            </span>
          </p>
        </div>

        {isOwner && (
          <Dropdown
            align="right"
            trigger={menuTrigger}
            className="min-w-[180px]"
          >
            <DropdownItem onClick={onEdit} icon={<Pencil className="w-4 h-4" />}>
              {labels.edit}
            </DropdownItem>
            <DropdownDivider />
            <DropdownItem onClick={onRemove} danger icon={<Trash2 className="w-4 h-4" />}>
              {labels.remove}
            </DropdownItem>
          </Dropdown>
        )}

        <Link
          href={routes.workspace(workspace.slug)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-ctl border border-ink px-3 h-9 sm:h-8 text-small font-medium text-fg',
            'hover:bg-panel transition-colors duration-160 shrink-0',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2 focus-visible:ring-offset-page'
          )}
        >
          {labels.open}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </li>
  )
}

interface WorkspaceFormModalProps {
  open: boolean
  editing: Workspace | null
  form: typeof emptyForm
  error: string
  saving: boolean
  onFormChange: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void
}

function WorkspaceFormModal({
  open,
  editing,
  form,
  error,
  saving,
  onFormChange,
  onClose,
  onSubmit,
}: WorkspaceFormModalProps) {
  const t = useTranslations('workspaces')
  const slugInput = React.useRef<HTMLInputElement>(null)
  // Upload problems belong to the file field, not the submit error slot.
  const [uploadError, setUploadError] = React.useState('')
  const [logoUploading, setLogoUploading] = React.useState(false)
  const uploadProblem = useUploadProblemText()

  return (
    <Modal isOpen={open} onClose={onClose} size="lg" title={editing ? t('form.editTitle') : t('form.createTitle')}>
      <form
        onSubmit={onSubmit}
        onChange={() => setUploadError('')}
        className="flex flex-col min-h-0"
      >
        <ModalHeader onClose={onClose}>
          <h2 className="text-body font-semibold text-fg">
            {editing ? t('form.editTitle') : t('form.createTitle')}
          </h2>
          {!editing && <p className="text-small text-muted">{t('form.createLead')}</p>}
        </ModalHeader>

        <ModalBody className="space-y-5">
          {(error || uploadError) && (
            <Alert variant="destructive">
              <AlertDescription>{error || uploadError}</AlertDescription>
            </Alert>
          )}

          <Input
            label={t('form.name')}
            required
            value={form.name}
            placeholder={t('form.namePlaceholder')}
            onChange={(e) =>
              onFormChange({
                ...form,
                name: e.target.value,
                // The short name follows the name until it is edited by hand.
                ...onNameTyped(e.target.value, form, SLUG_MAX),
              })
            }
          />

          {/* The slug is shown as the "short name", in the user's language. It is
              set once: PATCH /api/workspaces/[id] does not change it. */}
          {!editing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="workspace-slug" className="block text-small font-medium text-fg">
                  {t('form.shortName')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    slugInput.current?.focus()
                    slugInput.current?.select()
                  }}
                  className="text-small text-acc hover:underline rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                >
                  {t('form.shortNameEdit')}
                </button>
              </div>
              <Input
                id="workspace-slug"
                ref={slugInput}
                value={form.slug}
                placeholder="an-nam-boutique"
                onChange={(e) => onFormChange({ ...form, ...onSlugTyped(e.target.value, SLUG_MAX) })}
                onBlur={() => onFormChange({ ...form, slug: finishSlugInput(form.slug) })}
                hint={t('form.shortNameHint', { slug: form.slug || '…' })}
              />
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-small font-medium text-fg mb-2">{t('form.businessType')}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {BUSINESS_TYPES.map((value) => (
                <label
                  key={value}
                  className={cn(
                    'flex items-center gap-2 rounded-ctl border px-3 h-10 cursor-pointer transition-colors duration-160',
                    form.businessType === value ? 'border-ink bg-plain-soft/60' : 'border-line hover:border-muted'
                  )}
                >
                  <input
                    type="radio"
                    name="business-type"
                    value={value}
                    checked={form.businessType === value}
                    onChange={() => onFormChange({ ...form, businessType: value })}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      form.businessType === value ? 'border-ink' : 'border-line'
                    )}
                  >
                    {form.businessType === value && <span className="h-2 w-2 rounded-full bg-ink" />}
                  </span>
                  <span className="text-small text-fg">{t(`form.businessTypes.${value}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-box border border-dashed border-line bg-plain-soft/50">
              {form.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo} alt={t('form.logoAlt')} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-5 w-5 text-muted" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <label
                htmlFor="workspace-logo"
                className="inline-flex items-center rounded-ctl border border-ink px-3 h-9 sm:h-8 text-small font-medium text-fg cursor-pointer hover:bg-panel transition-colors duration-160"
              >
                {logoUploading ? t('form.logoUploading') : t('form.logoUpload')}
              </label>
              <input
                id="workspace-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={logoUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  // Reset so picking the same file twice still fires.
                  e.target.value = ''
                  if (!file) return
                  setUploadError('')
                  setLogoUploading(true)
                  try {
                    // Stored (Cloudinary), not kept as a data: URL in the workspace row.
                    const url = await uploadPhoto(file, editing ? { workspaceId: editing.id } : {}, 512)
                    onFormChange((current) => ({ ...current, logo: url }))
                  } catch (error) {
                    setUploadError(uploadProblem(error))
                  } finally {
                    setLogoUploading(false)
                  }
                }}
              />
              {form.logo && (
                <button
                  type="button"
                  onClick={() => onFormChange({ ...form, logo: null })}
                  className="ml-2 rounded-ctl px-3 h-9 sm:h-8 text-small font-medium text-err hover:bg-err-soft transition-colors duration-160"
                >
                  {t('form.logoRemove')}
                </button>
              )}
              <p className="mt-1 text-small text-muted">{t('form.logoHint')}</p>
            </div>
          </div>

          <Textarea
            label={t('form.description')}
            rows={2}
            value={form.description}
            placeholder={t('form.descriptionPlaceholder')}
            onChange={(e) => onFormChange({ ...form, description: e.target.value.slice(0, 500) })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={t('form.currency')}
              options={CURRENCIES.map((value) => ({ value, label: t(`form.currencies.${value}`) }))}
              value={form.currency}
              onChange={(e) => onFormChange({ ...form, currency: e.target.value })}
            />
            <Select
              label={t('form.timezone')}
              options={TIMEZONES.map(({ value, key }) => ({ value, label: t(`form.timezones.${key}`) }))}
              value={form.timezone}
              onChange={(e) => onFormChange({ ...form, timezone: e.target.value })}
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('form.cancel')}
          </Button>
          <Button type="submit" isLoading={saving} disabled={!form.name.trim()}>
            {editing ? t('form.editSubmit') : t('form.createSubmit')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}