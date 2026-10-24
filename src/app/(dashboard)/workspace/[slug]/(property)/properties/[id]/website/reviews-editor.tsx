'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from 'lucide-react'
import { Button, Input, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'

/** One guest review as the Reviews block reads it (config.reviews, ReviewsBlock.tsx). */
export interface ReviewEntry {
  name: string
  text: string
  rating: number
  /** Where it was written: "Google", "Booking.com", "Tại khách sạn"... */
  source?: string
}

export const MAX_REVIEWS = 12

/**
 * The hotel's real guest reviews, typed in by the hotel (copied from Google,
 * Booking.com, its guest book...). Only these are shown: the block never
 * invents any.
 */
export function ReviewsEditor({ value, onChange }: { value: ReviewEntry[]; onChange: (reviews: ReviewEntry[]) => void }) {
  const t = useTranslations('dash.website.config.reviews')
  const tc = useTranslations('dash.common')
  const set = (i: number, patch: Partial<ReviewEntry>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const move = (i: number, by: -1 | 1) => {
    const next = [...value]
    const [item] = next.splice(i, 1)
    next.splice(i + by, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-fg">{t('label')}</p>
        <p className="mt-0.5 text-xs text-muted">{t('hint')}</p>
      </div>
      {value.length === 0 && <p className="rounded-box border border-dashed border-line p-4 text-center text-sm text-muted">{t('empty')}</p>}
      {value.map((review, i) => (
        <div key={i} className="rounded-box border border-line bg-fg/[0.02] p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">{t('number', { n: i + 1 })}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('moveUp')} className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted hover:bg-fg/5 hover:text-fg disabled:opacity-30">
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={t('moveDown')} className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted hover:bg-fg/5 hover:text-fg disabled:opacity-30">
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={tc('actions.delete')} className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted hover:bg-err-soft hover:text-err">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('name')} value={review.name} maxLength={80} onChange={(e) => set(i, { name: e.target.value })} placeholder={t('namePlaceholder')} />
            <Input label={t('source')} value={review.source ?? ''} maxLength={40} onChange={(e) => set(i, { source: e.target.value })} placeholder={t('sourcePlaceholder')} />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-fg" id={`review-rating-${i}`}>{t('rating')}</p>
            <div role="radiogroup" aria-labelledby={`review-rating-${i}`} className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={review.rating === n}
                  aria-label={t('stars', { count: n })}
                  onClick={() => set(i, { rating: n })}
                  className="flex h-9 w-9 items-center justify-center rounded-ctl hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                >
                  <Star className={cn('h-5 w-5', n <= review.rating ? 'fill-current text-acc' : 'text-muted')} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <Textarea label={t('text')} value={review.text} maxLength={600} rows={3} onChange={(e) => set(i, { text: e.target.value })} placeholder={t('textPlaceholder')} />
        </div>
      ))}
      {value.length < MAX_REVIEWS && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { name: '', text: '', rating: 5 }])}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t('add')}
        </Button>
      )}
    </div>
  )
}
