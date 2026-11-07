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
import { KeyRound, Lock, LockOpen, MoreVertical, Package, ScrollText } from 'lucide-react'
import { Button, Dropdown, DropdownItem, Input, Modal, ModalBody, ModalFooter, ModalHeader, Select, Textarea, toast } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { Pill, adminSend } from './admin-ui'
import type { PlanView } from './plan-bits'

const PLANS = ['starter', 'growth', 'business'] as const
const DAY_MS = 86_400_000

/** "YYYY-MM-DD" of `date` in Vietnam time, for a date input. */
const vnDay = (date: Date) => new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

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
  plan?: PlanView | null
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

export function UserPlanModal({
  account,
  onClose,
  onSaved,
}: {
  account: AdminAccount
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('dash.admin')
  const current = account.plan
  const [plan, setPlan] = React.useState<string>(current?.plan ?? 'growth')
  const [trial, setTrial] = React.useState(current?.trial ?? false)
  const defaultDate =
    current && Date.parse(current.periodEnd) > Date.now()
      ? new Date(Date.parse(current.periodEnd))
      : new Date(Date.now() + 365 * DAY_MS)
  const [end, setEnd] = React.useState(vnDay(defaultDate))
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const save = async () => {
    if (note.trim().length < 3) return setError(t('common.noteRequired'))
    setBusy(true)
    setError('')
    try {
      await adminSend(`/api/admin/users/${account.id}/plan`, 'POST', { plan, trial, periodEnd: end, note })
      toast.success(t('accounts.userPlan.done', { email: account.email }))
      onSaved()
    } catch (e) {
      setError(t('common.failed', { error: (e as Error).message }))
      setBusy(false)
    }
  }

  const close = () => !busy && onClose()
  return (
    <Modal isOpen onClose={close} size="md" title={t('accounts.userPlan.title', { email: account.email })}>
      <ModalHeader onClose={close}>
        <h2 className="text-lg font-semibold text-fg">{t('accounts.userPlan.title', { email: account.email })}</h2>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <p className="text-sm text-fg/80">
            {t('accounts.userPlan.lead', { email: account.email, count: account.ownedWorkspaces })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('planForm.plan')}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              options={PLANS.map((p) => ({ value: p, label: t(`plans.${p}`) }))}
            />
            <Select
              label={t('planForm.kind')}
              value={trial ? 'trial' : 'paid'}
              onChange={(e) => setTrial(e.target.value === 'trial')}
              options={[
                { value: 'paid', label: t('planForm.kindPaid') },
                { value: 'trial', label: t('planForm.kindTrial') },
              ]}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-fg">{t('planForm.end')}</label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            <div className="mt-1 flex flex-wrap gap-1 text-xs">
              {[
                { d: 7, label: '+7 ngày' },
                { d: 30, label: '+1 tháng' },
                { d: 90, label: '+3 tháng' },
                { d: 180, label: '+6 tháng' },
                { d: 365, label: '+1 năm' },
              ].map(({ d, label }) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setEnd(vnDay(new Date(Date.now() + d * DAY_MS)))}
                  className="rounded border border-line px-1.5 py-0.5 text-muted hover:border-fg/30 hover:text-fg"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label={t('common.note')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('common.noteRequired')}
            rows={3}
          />
          {error && <p className="text-sm text-err">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={close} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={save} isLoading={busy}>
          {t('common.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export function AccountActions({ account, onDone }: { account: AdminAccount; onDone: () => void }) {
  const t = useTranslations('dash.admin.accounts')
  const tc = useTranslations('dash.admin.common')
  const router = useRouter()
  const [open, setOpen] = React.useState<'lock' | 'unlock' | 'twoFactor' | null>(null)
  const [planOpen, setPlanOpen] = React.useState(false)
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
        <DropdownItem icon={<Package className="h-4 w-4" />} onClick={() => setPlanOpen(true)}>
          {t('actions.setPlan')}
        </DropdownItem>
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

      {planOpen && (
        <UserPlanModal
          account={account}
          onClose={() => setPlanOpen(false)}
          onSaved={() => {
            setPlanOpen(false)
            onDone()
          }}
        />
      )}

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
