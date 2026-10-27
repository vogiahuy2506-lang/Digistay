'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Check } from 'lucide-react'
import { Button, Input, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useDashLabels } from '@/lib/i18n/dash'
import {
  PERMISSION_GROUPS,
  PERMISSION_REQUIRES,
  PERMISSIONS,
  ROLES,
  ROLE_PRESETS,
  normalizePermissions,
  presetOf,
  type Permission,
  type PermissionGroup,
  type Role,
} from '@/lib/auth/permissions'

/** What the editor gives (src/lib/members/grant.ts grantSchema). */
export interface AccessValue {
  role: Role
  permissions: Permission[]
  allProperties: boolean
  propertyIds: string[]
}

/** What the person editing holds: nobody gives more (the API refuses it too). */
export interface EditorLimits {
  isOwner: boolean
  permissions: Permission[]
  /** null: every property. */
  propertyIds: string[] | null
}

const GROUPS = Object.keys(PERMISSION_GROUPS) as PermissionGroup[]

/** The permissions that need `p` (PERMISSION_REQUIRES): unticking it unticks them. */
const NEEDING = (p: Permission) => PERMISSIONS.filter((q) => PERMISSION_REQUIRES[q] === p)

/**
 * Invite a member or change one's access, like UKNOW's employee permissions:
 * a role picks a preset, then each permission can be ticked or unticked
 * (grouped by area), and the member can be limited to some properties.
 */
export function AccessEditor({
  open,
  mode,
  name,
  initial,
  properties,
  limits,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'invite' | 'edit'
  /** Who is edited (edit mode). */
  name?: string
  initial: AccessValue
  properties: { id: string; name: string }[]
  limits: EditorLimits
  saving: boolean
  error: string
  onClose: () => void
  onSubmit: (value: AccessValue & { email?: string }) => void
}) {
  const t = useTranslations('dash.members')
  const labels = useDashLabels()
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<Role>(initial.role)
  const [ticked, setTicked] = React.useState<Set<Permission>>(new Set(initial.permissions))
  const [allProperties, setAllProperties] = React.useState(initial.allProperties)
  const [propertyIds, setPropertyIds] = React.useState<string[]>(initial.propertyIds)
  const [touched, setTouched] = React.useState(false)

  // A fresh form each time it opens.
  React.useEffect(() => {
    if (!open) return
    setEmail('')
    setRole(initial.role)
    setTicked(new Set(initial.permissions))
    setAllProperties(limits.propertyIds === null ? initial.allProperties : false)
    setPropertyIds(initial.propertyIds)
    setTouched(false)
  }, [open, initial, limits.propertyIds])

  const mine = new Set(limits.permissions)
  const grantable = (p: Permission) => limits.isOwner || mine.has(p)
  const permissions = normalizePermissions([...ticked])
  const custom = permissions.join(',') !== ROLE_PRESETS[role].join(',')
  const choosable = limits.propertyIds === null ? properties : properties.filter((p) => limits.propertyIds!.includes(p.id))
  const needsProperty = !allProperties && propertyIds.length === 0

  const pickRole = (next: Role) => {
    setRole(next)
    setTicked(new Set(ROLE_PRESETS[next].filter(grantable)))
  }

  const toggle = (p: Permission, on: boolean) => {
    const next = new Set(ticked)
    if (on) {
      next.add(p)
      const needed = PERMISSION_REQUIRES[p]
      if (needed) next.add(needed)
    } else {
      next.delete(p)
      for (const q of NEEDING(p)) next.delete(q)
    }
    setTicked(next)
    // A set equal to another role's preset is that role.
    const preset = presetOf([...next])
    if (preset) setRole(preset)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (needsProperty) return
    onSubmit({
      ...(mode === 'invite' && { email: email.trim() }),
      role,
      permissions,
      allProperties,
      propertyIds: allProperties ? [] : propertyIds,
    })
  }

  const title = mode === 'invite' ? t('editor.inviteTitle') : t('editor.editTitle', { name: name ?? '' })

  return (
    <Modal isOpen={open} onClose={onClose} size="xl" title={title} showHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <ModalBody className="space-y-7">
          {mode === 'invite' && (
            <div>
              <label htmlFor="invite-email" className="mb-1.5 block text-small font-medium text-fg">
                {t('editor.email')}
              </label>
              <Input
                id="invite-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('editor.emailPlaceholder')}
              />
              <p className="mt-1.5 text-small text-muted">{t('editor.emailHint')}</p>
            </div>
          )}

          <fieldset>
            <legend className="text-small font-medium text-fg">{t('editor.role')}</legend>
            <p className="mt-0.5 text-small text-muted">{t('editor.roleHint')}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {ROLES.map((r) => {
                const disabled = !ROLE_PRESETS[r].every(grantable) && !limits.isOwner
                const selected = role === r
                return (
                  <label
                    key={r}
                    className={cn(
                      'relative flex cursor-pointer flex-col rounded-box border px-3.5 py-3 transition-colors duration-160',
                      selected ? 'border-acc bg-acc/[0.06]' : 'border-line hover:border-muted',
                      disabled && 'cursor-not-allowed opacity-50 hover:border-line'
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={selected}
                      disabled={disabled}
                      onChange={() => pickRole(r)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2 text-body font-semibold text-fg">
                      {labels.role(r)}
                      {selected && <Check className="h-4 w-4 text-acc" aria-hidden="true" />}
                    </span>
                    <span className="mt-0.5 text-small text-muted">{t(`roleHints.${r}`)}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <legend className="text-small font-medium text-fg">{t('editor.permissions')}</legend>
              <span className="text-small text-muted">
                {custom ? (
                  <>
                    {t('editor.customNote', { role: labels.role(role) })}{' '}
                    <button type="button" onClick={() => pickRole(role)} className="font-medium text-acc hover:underline">
                      {t('editor.resetPreset', { role: labels.role(role) })}
                    </button>
                  </>
                ) : (
                  t('editor.presetNote', { role: labels.role(role) })
                )}
              </span>
            </div>
            <div className="mt-3 grid gap-x-8 gap-y-6 lg:grid-cols-2">
              {GROUPS.map((group) => (
                <div key={group}>
                  <p className="border-b border-line pb-2 text-label uppercase text-muted">{t(`groups.${group}`)}</p>
                  <ul className="mt-1">
                    {PERMISSION_GROUPS[group].map((p) => {
                      const allowed = grantable(p)
                      const needed = PERMISSION_REQUIRES[p]
                      return (
                        <li key={p}>
                          <label
                            className={cn(
                              'flex items-start gap-3 rounded-ctl px-1 py-2',
                              allowed ? 'cursor-pointer hover:bg-fg/[0.03]' : 'cursor-not-allowed opacity-50'
                            )}
                            title={allowed ? undefined : t('editor.notYours')}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 shrink-0 accent-acc"
                              checked={ticked.has(p)}
                              disabled={!allowed}
                              onChange={(e) => toggle(p, e.target.checked)}
                            />
                            <span className="min-w-0">
                              <span className="block text-body text-fg">{t(`perm.${p}.label`)}</span>
                              <span className="block text-small text-muted">
                                {t(`perm.${p}.hint`)}
                                {needed && ` · ${t('editor.requires', { perm: t(`perm.${needed}.label`) })}`}
                              </span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
            {permissions.length === 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-ctl bg-warn-soft px-3 py-2 text-small text-warn">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {t('editor.noPermissions')}
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-small font-medium text-fg">{t('editor.properties')}</legend>
            <p className="mt-0.5 text-small text-muted">{t('editor.propertiesNote')}</p>
            <div className="mt-3 space-y-2">
              <label className={cn('flex items-center gap-3', limits.propertyIds !== null && 'cursor-not-allowed opacity-50')}>
                <input
                  type="radio"
                  name="scope"
                  className="h-4 w-4 accent-acc"
                  checked={allProperties}
                  disabled={limits.propertyIds !== null}
                  onChange={() => setAllProperties(true)}
                />
                <span className="text-body text-fg">{t('editor.propertiesAll')}</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="scope"
                  className="h-4 w-4 accent-acc"
                  checked={!allProperties}
                  onChange={() => setAllProperties(false)}
                />
                <span className="text-body text-fg">{t('editor.propertiesSome')}</span>
              </label>
              {!allProperties && (
                <div className="ml-7 grid gap-1 sm:grid-cols-2">
                  {choosable.length === 0 && <p className="text-small text-muted">{t('noProperty')}</p>}
                  {choosable.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-ctl px-1 py-1.5 hover:bg-fg/[0.03]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-acc"
                        checked={propertyIds.includes(p.id)}
                        onChange={(e) =>
                          setPropertyIds((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id)))
                        }
                      />
                      <span className="truncate text-body text-fg">{p.name}</span>
                    </label>
                  ))}
                  {touched && needsProperty && <p className="text-small text-err sm:col-span-2">{t('editor.pickProperty')}</p>}
                </div>
              )}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-ctl bg-err-soft px-3 py-2 text-small text-err">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('editor.cancel')}
          </Button>
          <Button type="submit" isLoading={saving}>
            {mode === 'invite' ? t('editor.send') : t('editor.save')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
