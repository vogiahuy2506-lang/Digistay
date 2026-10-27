'use client'

/**
 * What an operator can do to an account (src/lib/admin/users.ts), from the
 * accounts list and a workspace's people: lock or unlock it, reset its
 * two-factor sign-in, open its activity. Each asks for a reason first; the
 * 2FA reset also for how the person was verified (docs/RUNBOOK.md).
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { KeyRound, Lock, LockOpen, MoreVertical, ScrollText } from 'lucide-react'
import { Button, Dropdown, DropdownItem, Modal, ModalBody, ModalFooter, ModalHeader, Select, Textarea, toast } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { Pill, adminSend } from './admin-ui'

/** An account as /api/admin/users and the customer detail list it (src/lib/admin/users.ts userView). */
export interface AdminAccount {
  id: string
  name: string | null
  email: string
  username: string | null
  phone: string | null
  role: string
  emailVerified: string | null
  disabledAt: string | null
  disabledReason: string | null
  createdAt: string
  twoFactor: boolean
  ownedWorkspaces: number
  memberships: number
}

const VIA = ['phone', 'video', 'owner'] as const

/** The account's state as pills: operator, locked or active, 2FA, unverified email. */
export function AccountPills({ account }: { account: AdminAccount }) {
  const t = useTranslations('dash.admin.accounts')
  const labels = useDashLabels()
  return (
    <span className="flex flex-wrap gap-1">
      {account.role === 'SUPER_ADMIN' && <Pill tone="info">{t('operator')}</Pill>}
      {account.disabledAt ? (
        <Pill tone="bad" title={t('lockedSince', { date: labels.date(account.disabledAt), reason: account.disabledReason ?? '' })}>
          {t('locked')}
        </Pill>
      ) : (
        <Pill tone="ok">{t('active')}</Pill>
      )}
      <Pill tone={account.twoFactor ? 'info' : 'muted'}>{account.twoFactor ? t('twoFactorOn') : t('twoFactorOff')}</Pill>
      {!account.emailVerified && <Pill tone="warn">{t('unverified')}</Pill>}
    </span>
  )
}

export function AccountActions({ account, onDone }: { account: AdminAccount; onDone: () => void }) {
  const t = useTranslations('dash.admin.accounts')
  const tc = useTranslations('dash.admin.common')
  const router = useRouter()
  const [open, setOpen] = React.useState<'lock' | 'unlock' | 'twoFactor' | null>(null)
  const [note, setNote] = React.useState('')
  const [via, setVia] = React.useState<(typeof VIA)[number] | ''>('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const start = (action: typeof open) => {
    setNote('')
    setVia('')
    setError('')
    setOpen(action)
  }
  const close = () => !busy && setOpen(null)

  const submit = async () => {
    if (note.trim().length < 3) return setError(tc('noteRequired'))
    if (open === 'twoFactor' && !via) return setError(t('twoFactor.via'))
    setBusy(true)
    setError('')
    try {
      if (open === 'twoFactor') {
        await adminSend(`/api/admin/users/${account.id}/two-factor`, 'DELETE', { verifiedVia: via, note })
        toast.success(t('twoFactor.done', { email: account.email }))
      } else {
        await adminSend(`/api/admin/users/${account.id}`, 'PATCH', { locked: open === 'lock', note })
        toast.success(t(open === 'lock' ? 'lock.done' : 'unlock.done', { email: account.email }))
      }
      setOpen(null)
      onDone()
    } catch (e) {
      setError(tc('failed', { error: (e as Error).message }))
    } finally {
      setBusy(false)
    }
  }

  // Operators are managed with SQL (docs/RUNBOOK.md): nothing to do here.
  const operator = account.role === 'SUPER_ADMIN'
  const copy = open === 'twoFactor' ? 'twoFactor' : open === 'unlock' ? 'unlock' : 'lock'

  return (
    <>
      <Dropdown
        trigger={
          <button type="button" aria-label={t('actions.menu')} className="flex h-9 w-9 items-center justify-center rounded-ctl text-muted hover:bg-fg/5 hover:text-fg">
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        }
      >
        {!operator &&
          (account.disabledAt ? (
            <DropdownItem icon={<LockOpen className="h-4 w-4" />} onClick={() => start('unlock')}>
              {t('actions.unlock')}
            </DropdownItem>
          ) : (
            <DropdownItem icon={<Lock className="h-4 w-4" />} danger onClick={() => start('lock')}>
              {t('actions.lock')}
            </DropdownItem>
          ))}
        {!operator && account.twoFactor && (
          <DropdownItem icon={<KeyRound className="h-4 w-4" />} onClick={() => start('twoFactor')}>
            {t('actions.resetTwoFactor')}
          </DropdownItem>
        )}
        <DropdownItem icon={<ScrollText className="h-4 w-4" />} onClick={() => router.push(`/admin/activity?user=${account.id}`)}>
          {t('actions.activity')}
        </DropdownItem>
      </Dropdown>

      <Modal isOpen={open !== null} onClose={close} size="md" title={t(`${copy}.title`, { email: account.email })}>
        <ModalHeader onClose={close}>
          <h2 className="text-lg font-semibold text-fg">{t(`${copy}.title`, { email: account.email })}</h2>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-fg/80">{t(`${copy}.text`)}</p>
            {open === 'twoFactor' && (
              <>
                <p className="text-sm text-muted">{t('twoFactor.after')}</p>
                <Select
                  label={t('twoFactor.via')}
                  value={via}
                  onChange={(e) => setVia(e.target.value as typeof via)}
                  placeholder="—"
                  options={VIA.map((v) => ({ value: v, label: t(`twoFactor.viaOptions.${v}`) }))}
                />
              </>
            )}
            <Textarea
              label={open === 'twoFactor' ? t('twoFactor.note') : t(`${copy === 'unlock' ? 'unlock' : 'lock'}.reason`)}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={open === 'twoFactor' ? t('twoFactor.notePlaceholder') : t(`${copy === 'unlock' ? 'unlock' : 'lock'}.reasonPlaceholder`)}
              rows={3}
            />
            {error && <p className="text-sm text-err">{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            {tc('cancel')}
          </Button>
          <Button variant={open === 'unlock' ? 'primary' : 'danger'} onClick={submit} isLoading={busy}>
            {t(`${copy}.confirm`)}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
