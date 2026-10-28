'use client'

/**
 * The free trial's welcome: a new workspace gets the Growth plan for
 * TRIAL_DAYS days (src/lib/billing/period.ts), and its owner is told so the
 * first time they open it (welcomesTrial). Closing it, by either button,
 * Escape or the backdrop, marks it seen on the server, so it does not come
 * back on another device.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Gift, X } from 'lucide-react'
import { Button, Modal, ModalFooter } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { planById } from '@/lib/marketing/plans'
import { routes } from '@/lib/utils/routes'

interface TrialWelcomeProps {
  workspaceId: string
  workspaceName: string
  slug: string
  /** When the trial ends (ISO). */
  periodEnd: string
  /** Its length in days, and its plan: TRIAL_DAYS of TRIAL_PLAN, unless an operator changed them (/admin). */
  days: number
  planId: string
}

export function TrialWelcome({ workspaceId, workspaceName, slug, periodEnd, days, planId }: TrialWelcomeProps) {
  const t = useTranslations('dash.billing.trialWelcome')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const router = useRouter()
  const [open, setOpen] = React.useState(true)
  const plan = planById(planId)
  const planName = plan.id.charAt(0).toUpperCase() + plan.id.slice(1)

  const close = (then?: string) => {
    setOpen(false)
    // keepalive: still sent when the button leads to another page at once.
    fetch(`/api/workspaces/${workspaceId}/subscription/welcome`, { method: 'POST', keepalive: true }).catch(() => {})
    if (then) router.push(then)
  }

  if (!open) return null
  const title = t('title', { days, plan: planName })
  const includes = [
    t('includes.properties', { count: plan.properties }),
    t('includes.rooms', { count: plan.rooms }),
    t('includes.staff', { count: plan.staff }),
    t('includes.invoices', { count: plan.invoices }),
    t('includes.website'),
  ]

  return (
    <Modal isOpen onClose={() => close()} size="sm" title={title}>
      <div className="relative px-6 pb-5 pt-7 text-center">
        <button
          type="button"
          onClick={() => close()}
          aria-label={tc('actions.close')}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-160 hover:bg-fg/5 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-acc-soft text-acc">
          <Gift className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-xl font-semibold leading-snug text-fg">{title}</h2>
        <p className="mt-2 text-body text-fg/80">{t('lead', { workspace: workspaceName, plan: planName, date: labels.date(periodEnd) })}</p>
      </div>
      <div className="px-6 pb-6">
        <p className="mb-2 text-label uppercase text-muted">{t('includesTitle')}</p>
        <ul className="space-y-2 rounded-box border border-line bg-panel p-4">
          {includes.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-small text-fg">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-small text-muted">{t('after')}</p>
      </div>
      <ModalFooter>
        <Button variant="outline" onClick={() => close(routes.billing(slug))} className="w-full sm:w-auto">
          {t('plans')}
        </Button>
        <Button onClick={() => close()} className="w-full sm:w-auto">
          {t('start')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
