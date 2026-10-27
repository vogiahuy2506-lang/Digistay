'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Lock, TrendingUp } from 'lucide-react'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { formatVnd } from '@/lib/bookings/display'
import { apiError } from '@/lib/i18n/api-errors'
import { YEARLY_MONTHS, planById, yearlyPrice, type PlanId } from '@/lib/marketing/plans'
import { readPlanLimitFacts, type PlanLimitFacts } from '@/lib/billing/plan-fit'
import { routes } from '@/lib/utils/routes'
import { cn } from '@/lib/utils'

/** The same refusal is not shown again this soon after it was: a page may retry the request. */
export const REOPEN_AFTER_MS = 5_000

/** What the dialog shows: the codes of src/lib/billing/guard.ts. */
type Prompt =
  | { code: 'PLAN_LIMIT'; facts: PlanLimitFacts | null; message: string | undefined }
  | { code: 'WORKSPACE_LOCKED' }
  | { code: 'PROPERTY_PLAN_LOCKED' }

/** The prompt an API response body asks for, or null when it is about something else. */
function promptFrom(body: unknown): Prompt | null {
  if (!body || typeof body !== 'object') return null
  const { code, limit, error } = body as { code?: unknown; limit?: unknown; error?: unknown }
  if (code === 'PLAN_LIMIT') return { code, facts: readPlanLimitFacts(limit), message: apiError(error) }
  if (code === 'WORKSPACE_LOCKED') return { code }
  if (code === 'PROPERTY_PLAN_LOCKED') return { code }
  return null
}

/** One key per kind of refusal, for "not again so soon". */
const keyOf = (prompt: Prompt) => (prompt.code === 'PLAN_LIMIT' ? `${prompt.code}:${prompt.facts?.kind ?? ''}` : prompt.code)

/** Whether a fetch goes to this site's own API (not to Cloudinary, PayOS...). */
function isOwnApi(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.href)
    return url.origin === window.location.origin && url.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

/**
 * The "buy a bigger plan" dialog of every workspace page. When the API
 * refuses a change for the plan (src/lib/billing/guard.ts) — 403 PLAN_LIMIT
 * (a property, rooms, a staff account or an e-invoice beyond the plan, with
 * the facts in `limit`: src/lib/billing/plan-fit.ts), 402 WORKSPACE_LOCKED
 * (read-only since the plan ended) or 402 PROPERTY_PLAN_LOCKED (a property
 * locked for being over the plan) — it says what the limit is, which plan
 * would fit and at what price, and leads to the plan page. Who may not buy
 * the plan (billing_manage) is told to ask the owner instead.
 *
 * Why it wraps window.fetch: dozens of pages and dialogs make those
 * requests, each with its own fetch and its own way of showing an error
 * (a toast, a line in a form). Wiring each of them to the prompt would be
 * a change to every page and easy to forget in the next one. Instead this
 * component, mounted once in the workspace layout, wraps window.fetch
 * while it is mounted and looks at the answers of this site's /api/ with
 * status 402 or 403: it reads a clone of the response (the page reads the
 * original as if nothing happened, and gets it without waiting) and opens
 * the dialog when the body's `code` is one of the three. Nothing else is
 * read or changed; the page still shows its own message under the dialog.
 * On unmount the original fetch is put back.
 *
 * One dialog at a time: a refusal while one is open is ignored, and the
 * same refusal (code and kind) is not shown again within REOPEN_AFTER_MS of
 * the last one, so a page that retries does not bring it back at once.
 */
export function PlanLimitPrompt({ slug, canBuy }: { slug: string; canBuy: boolean }) {
  const t = useTranslations('dash.billing')
  const locale = useLocale() === 'en' ? 'en' : 'vi'
  const router = useRouter()
  const [prompt, setPrompt] = React.useState<Prompt | null>(null)
  // Refs, not state: the fetch wrapper outlives renders and must see the latest at once.
  const shown = React.useRef<Prompt | null>(null)
  const last = React.useRef<{ key: string; at: number } | null>(null)

  const show = React.useCallback((next: Prompt | null) => {
    if (!next || shown.current) return
    const key = keyOf(next)
    if (last.current?.key === key && Date.now() - last.current.at < REOPEN_AFTER_MS) return
    shown.current = next
    last.current = { key, at: Date.now() }
    setPrompt(next)
  }, [])

  const close = React.useCallback(() => {
    if (shown.current) last.current = { key: keyOf(shown.current), at: Date.now() }
    shown.current = null
    setPrompt(null)
  }, [])

  React.useEffect(() => {
    const original = window.fetch
    let active = true
    const wrapped: typeof window.fetch = async (input, init) => {
      const response = await original.call(window, input, init)
      if (active && (response.status === 402 || response.status === 403) && isOwnApi(input)) {
        response
          .clone()
          .json()
          .then((body: unknown) => active && show(promptFrom(body)))
          .catch(() => {})
      }
      return response
    }
    window.fetch = wrapped
    return () => {
      active = false
      // When something wrapped fetch again on top of this, leave theirs in
      // place: this wrapper only stops looking (`active`).
      if (window.fetch === wrapped) window.fetch = original
    }
  }, [show])

  const go = (href: string) => {
    close()
    router.push(href)
  }

  if (!prompt) return null
  const view = describe(prompt, t, slug, locale)
  const { action, askOwner } = view

  return (
    <Modal isOpen onClose={close} size="sm">
      <ModalHeader onClose={close}>
        <span
          aria-hidden="true"
          className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', view.locked ? 'bg-err-soft text-err' : 'bg-warn-soft text-warn')}
        >
          {view.locked ? <Lock className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
        </span>
        <h2 className="text-lg font-semibold leading-snug text-fg">{view.title}</h2>
      </ModalHeader>
      <ModalBody className="space-y-4">
        {view.text && <p className="text-body text-fg/80">{view.text}</p>}
        {view.offer}
      </ModalBody>
      <ModalFooter>
        {canBuy && action ? (
          <>
            <Button variant="outline" onClick={close} className="w-full sm:w-auto">
              {t('limitPrompt.later')}
            </Button>
            <Button onClick={() => go(action.href)} className="w-full sm:w-auto">
              {action.label}
            </Button>
          </>
        ) : (
          <>
            {askOwner ? <p className="text-center text-small text-muted sm:text-left">{askOwner}</p> : <span className="hidden sm:block" />}
            <Button variant="outline" onClick={close} className="w-full sm:w-auto">
              {t('limitPrompt.close')}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  )
}

type T = ReturnType<typeof useTranslations<'dash.billing'>>

interface View {
  title: string
  text?: string
  /** The plan that would fit, or why none does. */
  offer?: React.ReactNode
  locked?: boolean
  /** The button for who may buy the plan. */
  action?: { label: string; href: string }
  /** Instead of the button, for who may not. */
  askOwner?: string
}

/** The words and the way out for one prompt. */
function describe(p: Prompt, t: T, slug: string, locale: 'vi' | 'en'): View {
  const billing = routes.billing(slug)
  if (p.code === 'WORKSPACE_LOCKED') {
    return {
      title: t('limitPrompt.locked.title'),
      text: t('limitPrompt.locked.text'),
      locked: true,
      action: { label: t('limitPrompt.locked.action'), href: billing },
      askOwner: t('limitPrompt.locked.askOwner'),
    }
  }
  if (p.code === 'PROPERTY_PLAN_LOCKED') {
    return {
      title: t('limitPrompt.propertyLocked.title'),
      text: t('limitPrompt.propertyLocked.text'),
      locked: true,
      action: { label: t('limitPrompt.propertyLocked.action'), href: billing },
      askOwner: t('limitPrompt.askOwner'),
    }
  }
  const upgrade = { label: t('limitPrompt.upgrade'), href: billing }
  const f = p.facts
  // An answer without the facts: its own message, and the plan page.
  if (!f) return { title: t('limitPrompt.fallbackTitle'), text: p.message, action: upgrade, askOwner: t('limitPrompt.askOwner') }

  const name = (id: PlanId) => t(`plans.${id}.name`)
  const plan = name(f.plan)
  const noInvoices = f.kind === 'invoices' && f.limit === 0
  // Some left but not enough for this (rooms come several at a time): not "all used".
  const title = noInvoices
    ? t('limitPrompt.noInvoicesTitle', { plan })
    : f.used < f.limit
      ? t(`limitPrompt.notEnough.${f.kind}`, { plan })
      : t(`limitPrompt.title.${f.kind}`, { plan })
  const usage = noInvoices ? undefined : t(`limitPrompt.usage.${f.kind}`, { plan, limit: f.limit, used: f.used })
  // Rooms come in batches (a room type of 12): say how many the change adds.
  const text = usage && f.adding > 1 ? `${usage} ${t(`limitPrompt.adding.${f.kind}`, { count: f.adding })}` : usage

  if (!f.suggested) {
    return {
      title,
      text,
      offer: <p className="rounded-ctl border border-line bg-page px-4 py-3 text-small text-fg">{t('limitPrompt.noPlan')}</p>,
      // Nothing to buy: the way out is talking to Digistay (or using less).
      action: { label: t('limitPrompt.contact'), href: '/contact' },
    }
  }
  const next = planById(f.suggested)
  const offer = (
    <div data-testid="plan-offer" className="rounded-ctl border border-line bg-page px-4 py-3">
      <p className="text-label uppercase text-muted">{t('limitPrompt.suggested')}</p>
      <p className="mt-1 font-semibold text-fg">
        {t(`limitPrompt.offer.${f.kind}`, { plan: name(next.id), limit: next[f.kind] })}
        <span className="font-normal text-muted"> · </span>
        <span className="whitespace-nowrap">{t('limitPrompt.price', { price: formatVnd(next.price, locale) })}</span>
      </p>
      <p className="mt-0.5 text-small text-muted">
        {t('limitPrompt.yearly', { price: formatVnd(yearlyPrice(next), locale), months: 12 - YEARLY_MONTHS })}
      </p>
    </div>
  )
  return { title, text, offer, action: upgrade, askOwner: t('limitPrompt.askOwner') }
}
