'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, ArrowRight, Sparkles, Trophy, Clock } from 'lucide-react'
import { QUICKSTART_STEPS, type QuickstartStep } from '@/lib/help/help-docs'
import { routes } from '@/lib/utils/routes'
import { cn } from '@/lib/utils'

export interface AutoOnboardingStatus {
  hasPropertyInfo: boolean
  hasRooms: boolean
  hasPublishedWebsite: boolean
  hasBookings: boolean
  hasInvitedMembers: boolean
}

interface OnboardingChecklistProps {
  workspaceSlug: string
  defaultPropertyId?: string | null
  autoStatus?: AutoOnboardingStatus
}

export function OnboardingChecklist({
  workspaceSlug,
  defaultPropertyId,
  autoStatus,
}: OnboardingChecklistProps) {
  const storageKey = `digistay_help_checklist_${workspaceSlug}`
  const [manualChecked, setManualChecked] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setManualChecked(JSON.parse(saved))
    } catch {
      // ignore storage errors
    }
  }, [storageKey])

  const toggleStep = (id: string) => {
    setManualChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const isStepCompleted = (step: QuickstartStep): boolean => {
    if (manualChecked[step.id]) return true
    if (!autoStatus) return false
    switch (step.hrefType) {
      case 'propertySettings':
        return autoStatus.hasPropertyInfo
      case 'rooms':
        return autoStatus.hasRooms
      case 'website':
        return autoStatus.hasPublishedWebsite
      case 'bookingNew':
        return autoStatus.hasBookings
      case 'members':
        return autoStatus.hasInvitedMembers
      default:
        return false
    }
  }

  const getStepHref = (step: QuickstartStep): string => {
    if (step.hrefType === 'members') {
      return routes.members(workspaceSlug)
    }
    if (!defaultPropertyId) {
      return routes.newProperty(workspaceSlug)
    }
    switch (step.hrefType) {
      case 'propertySettings':
        return routes.propertySettings(workspaceSlug, defaultPropertyId)
      case 'rooms':
        return routes.propertyRooms(workspaceSlug, defaultPropertyId)
      case 'website':
        return routes.propertyWebsite(workspaceSlug, defaultPropertyId)
      case 'bookingNew':
        return routes.propertyBookingNew(workspaceSlug, defaultPropertyId)
      default:
        return routes.workspace(workspaceSlug)
    }
  }

  const completedCount = QUICKSTART_STEPS.filter(isStepCompleted).length
  const progressPercent = Math.round((completedCount / QUICKSTART_STEPS.length) * 100)

  return (
    <section className="rounded-2xl border border-line bg-panel overflow-hidden shadow-xs">
      {/* Header & Progress */}
      <div className="p-5 border-b border-line bg-raised/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ok-soft text-ok flex items-center justify-center shrink-0 border border-ok/20">
              {completedCount === QUICKSTART_STEPS.length ? (
                <Trophy className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-fg">
                Checklist 5 Bước Thiết Lập Nhanh
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {completedCount === QUICKSTART_STEPS.length
                  ? 'Tuyệt vời! Khách sạn của bạn đã sẵn sàng đón khách & nhận đặt phòng.'
                  : 'Hoàn thành 5 bước dưới đây để vận hành khách sạn trơn tru trong chưa đầy 15 phút.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-[180px]">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-muted">Tiến độ</span>
                <span className="text-fg">
                  {completedCount}/{QUICKSTART_STEPS.length} ({progressPercent}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-raised border border-line overflow-hidden">
                <div
                  className="h-full bg-ok rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="divide-y divide-line">
        {QUICKSTART_STEPS.map((step) => {
          const done = isStepCompleted(step)
          const href = getStepHref(step)

          return (
            <div
              key={step.id}
              className={cn(
                'p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors',
                done ? 'bg-ok-soft/15' : 'hover:bg-raised/50'
              )}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  className={cn(
                    'mt-0.5 shrink-0 transition-transform active:scale-90',
                    done ? 'text-ok' : 'text-muted hover:text-fg'
                  )}
                  aria-label={done ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành'}
                  title="Bấm để đánh dấu hoàn thành"
                >
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 fill-ok/15" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        done ? 'text-muted line-through' : 'text-fg'
                      )}
                    >
                      Bước {step.stepNumber}: {step.title}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted bg-raised px-2 py-0.5 rounded-md border border-line">
                      <Clock className="w-3 h-3" />
                      ~{step.estimatedMinutes} phút
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="sm:shrink-0 pl-8 sm:pl-0">
                <Link
                  href={href}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border',
                    done
                      ? 'bg-panel border-line text-muted hover:text-fg hover:bg-raised'
                      : 'bg-primary hover:bg-primary-hover text-on-primary border-transparent shadow-2xs'
                  )}
                >
                  <span>{done ? 'Xem lại' : step.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
