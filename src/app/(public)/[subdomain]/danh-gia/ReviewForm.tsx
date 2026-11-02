'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Star, CheckCircle, BedDouble, Calendar, User, ArrowLeft, Send } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui'

interface ReviewFormProps {
  ticket: string
  subdomain: string
  hotelName: string
  hotelLogo?: string | null
  roomName: string
  guestName: string
  checkIn: string
  checkOut: string
  alreadyReviewed: boolean
  existingReview?: {
    rating: number
    title: string | null
    comment: string
    createdAt: string
  } | null
}

export function ReviewForm({
  ticket,
  subdomain,
  hotelName,
  roomName,
  guestName,
  checkIn,
  checkOut,
  alreadyReviewed: initialAlreadyReviewed,
  existingReview: initialExistingReview,
}: ReviewFormProps) {
  const t = useTranslations('site.reviewPage')

  const [rating, setRating] = React.useState<number>(5)
  const [hoverRating, setHoverRating] = React.useState<number | null>(null)
  const [title, setTitle] = React.useState('')
  const [comment, setComment] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const [submitted, setSubmitted] = React.useState(initialAlreadyReviewed)
  const [submittedReview, setSubmittedReview] = React.useState(initialExistingReview)

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    } catch {
      return dateStr
    }
  }

  const activeRating = hoverRating ?? rating

  const ratingLabels: Record<number, string> = {
    1: t('ratings.1'),
    2: t('ratings.2'),
    3: t('ratings.3'),
    4: t('ratings.4'),
    5: t('ratings.5'),
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim() || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: ticket,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim(),
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        toast.success(json.message || 'Cảm ơn bạn đã gửi đánh giá!')
        setSubmitted(true)
        setSubmittedReview({
          rating,
          title: title.trim() || null,
          comment: comment.trim(),
          createdAt: new Date().toISOString(),
        })
      } else {
        toast.error(json.error || 'Lỗi khi gửi đánh giá')
      }
    } catch {
      toast.error('Lỗi khi kết nối máy chủ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      {/* Hotel & Stay Summary Card */}
      <div className="rounded-2xl border border-line bg-card/70 backdrop-blur-md p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-bold text-fg mb-1">{t('title')}</h2>
        <p className="text-sm text-muted mb-4">{t('subtitle', { hotel: hotelName })}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-line text-xs">
          <div className="flex items-center gap-2 text-fg">
            <BedDouble className="w-4 h-4 text-acc shrink-0" />
            <span className="truncate">{roomName}</span>
          </div>

          <div className="flex items-center gap-2 text-muted">
            <Calendar className="w-4 h-4 text-acc shrink-0" />
            <span>
              {formatDate(checkIn)} → {formatDate(checkOut)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted col-span-full">
            <User className="w-4 h-4 text-acc shrink-0" />
            <span>{guestName}</span>
          </div>
        </div>
      </div>

      {/* If already submitted */}
      {submitted ? (
        <div className="rounded-2xl border border-line bg-card/70 backdrop-blur-md p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-fg mb-2">{t('alreadyReviewedTitle')}</h3>
          <p className="text-sm text-muted max-w-md mx-auto mb-6">{t('alreadyReviewedDesc')}</p>

          {submittedReview && (
            <div className="p-4 rounded-xl border border-line bg-bg-subtle/50 text-left max-w-md mx-auto mb-6">
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star
                    key={idx}
                    className={`w-4 h-4 ${
                      idx < submittedReview.rating
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-line fill-transparent'
                    }`}
                  />
                ))}
                <span className="text-xs font-semibold text-fg ml-1.5">
                  {ratingLabels[submittedReview.rating]}
                </span>
              </div>

              {submittedReview.title && (
                <p className="text-sm font-semibold text-fg mb-1">{submittedReview.title}</p>
              )}
              <p className="text-xs text-muted leading-relaxed italic">“{submittedReview.comment}”</p>
            </div>
          )}

          <Link
            href={`/`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-acc text-white text-sm font-medium hover:bg-acc/90 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('backToHome')}</span>
          </Link>
        </div>
      ) : (
        /* Review Form */
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line bg-card/70 backdrop-blur-md p-6 sm:p-8 shadow-sm space-y-6"
        >
          {/* Star selector */}
          <div>
            <label className="block text-sm font-semibold text-fg mb-3 text-center">
              {t('ratingLabel')}
            </label>

            <div className="flex items-center justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 rounded-lg hover:scale-110 active:scale-95 transition-transform focus:outline-none"
                  aria-label={`${star} sao`}
                >
                  <Star
                    className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors ${
                      star <= activeRating
                        ? 'text-amber-500 fill-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.25)]'
                        : 'text-line fill-transparent hover:text-amber-400/50'
                    }`}
                  />
                </button>
              ))}
            </div>

            <p className="text-center text-sm font-semibold text-amber-600 dark:text-amber-400 h-5">
              {ratingLabels[activeRating] || ''}
            </p>
          </div>

          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold text-fg mb-1.5">
              {t('titleLabel')}
            </label>
            <input
              type="text"
              maxLength={200}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-line bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-acc/30 placeholder:text-muted"
              placeholder={t('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Comment textarea */}
          <div>
            <label className="block text-xs font-semibold text-fg mb-1.5">
              {t('commentLabel')} <span className="text-destructive">*</span>
            </label>
            <textarea
              required
              rows={4}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-line bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-acc/30 placeholder:text-muted leading-relaxed"
              placeholder={t('commentPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={submitting || !comment.trim()}
              className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? t('submitting') : t('submit')}</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
