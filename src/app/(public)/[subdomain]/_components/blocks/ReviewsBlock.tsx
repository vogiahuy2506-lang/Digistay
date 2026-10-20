import { Star } from 'lucide-react'
import type { PublicBlock } from '../PropertySite'
import { Section, SectionHeader, cfgText } from '../site-ui'

interface Props {
  block: PublicBlock
}

interface Review {
  name: string
  text: string
  rating: number
}

function reviewsFrom(config: Record<string, unknown>): Review[] {
  const raw = Array.isArray(config.reviews) ? config.reviews : []
  return raw
    .map((r) => {
      const item = (r ?? {}) as Record<string, unknown>
      const rating = Math.round(Number(item.rating))
      return {
        name: typeof item.name === 'string' ? item.name.trim() : '',
        text: typeof item.text === 'string' ? item.text.trim() : '',
        rating: Number.isFinite(rating) ? Math.min(5, Math.max(1, rating)) : 5,
      }
    })
    .filter((r) => r.name && r.text)
}

/**
 * Guest reviews. Only real reviews from the block's config are shown. This
 * block used to print three made-up 5-star quotes ("Khách hàng 1/2/3") on
 * every hotel's site; with no reviews it now renders nothing.
 */
export function ReviewsBlock({ block }: Props) {
  const cfg = block.config || {}
  const limit = Number(cfg.reviewsLimit) > 0 ? Number(cfg.reviewsLimit) : 6
  const reviews = reviewsFrom(cfg).slice(0, limit)
  if (reviews.length === 0) return null

  return (
    <Section id="reviews">
      <SectionHeader eyebrow="Đánh giá" title={cfgText(cfg, 'reviewsTitle', 'title') ?? 'Khách nói gì về chúng tôi'} />
      <ul className="grid gap-5 md:grid-cols-3">
        {reviews.map((review, i) => (
          <li key={i} className="border border-line bg-panel p-6">
            <p className="flex gap-0.5 text-acc" aria-label={`${review.rating} trên 5 sao`}>
              {Array.from({ length: review.rating }).map((_, j) => (
                <Star key={j} className="h-4 w-4 fill-current" aria-hidden="true" />
              ))}
            </p>
            <blockquote className="mt-4 text-body text-fg">“{review.text}”</blockquote>
            <p className="mt-4 text-small text-muted">{review.name}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
