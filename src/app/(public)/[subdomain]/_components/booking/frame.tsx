import { prisma } from '@/lib/db'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { useTranslations } from 'next-intl'
import { SiteHeader, type SiteSection } from '../SiteHeader'
import { Container } from '../site-ui'
import { cn } from '@/lib/utils'

/**
 * The frame of the booking steps on a hotel's site (Claude Design "Digistay
 * Ket Qua Tim Phong" / "Dat Phong" / "Dat Coc PayOS" / "Xac Nhan"): the
 * site's header, the four steps, a slim footer.
 */

const SECTIONS: Record<string, SiteSection> = {
  ROOMS: { id: 'rooms' },
  AMENITIES: { id: 'amenities' },
  MAP: { id: 'map' },
  CONTACT: { id: 'contact' },
}

/**
 * The hotel's header and footer data. `guestLink`: a guest's own page (the
 * deposit and confirmation links in emails) still opens when the site has
 * been unpublished since; the steps before it do not.
 */
export async function loadBookingFrame(subdomain: string, { guestLink = false } = {}) {
  const site = guestLink ? null : await loadVisibleSite(subdomain)
  if (!guestLink && !site) return null
  const property = await prisma.property.findFirst({
    where: site ? { id: site.propertyId } : { subdomain, isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      phone: true,
      address: true,
      websiteBlocks: { where: { isEnabled: true }, select: { type: true } },
    },
  })
  if (!property) return null
  const blockTypes = new Set(property.websiteBlocks.map((b) => b.type))
  const sections = Object.entries(SECTIONS)
    .filter(([type]) => blockTypes.size === 0 || blockTypes.has(type as never))
    .map(([, s]) => s)
  return { property, sections }
}

export type BookingStep = 1 | 2 | 3 | 4

/** 01 Chọn phòng · 02 Thông tin đặt phòng · 03 Đặt cọc · 04 Xác nhận; done steps get a ✓. */
export function BookingSteps({ current }: { current: BookingStep }) {
  const t = useTranslations('site.booking.steps')
  const steps = [t('room'), t('details'), t('deposit'), t('done')]
  return (
    <Container className="pt-6 lg:pt-9">
      <ol aria-label={t('label')} className="flex flex-wrap gap-x-8 gap-y-2 border-b border-line text-[13.5px] lg:gap-x-10 lg:text-[14px]">
        {steps.map((label, i) => {
          const n = (i + 1) as BookingStep
          const done = n < current
          const now = n === current
          return (
            <li
              key={label}
              aria-current={now ? 'step' : undefined}
              className={cn(
                '-mb-px flex items-center gap-2.5 border-b pb-3.5',
                now ? 'border-fg font-medium text-fg' : 'border-transparent',
                done ? 'text-fg' : !now && 'text-muted',
                // Phones: only the current step and its number.
                !now && 'max-sm:hidden',
              )}
            >
              <span className={cn('font-mono text-[12px] font-medium', now && 'text-acc')}>{done ? '✓' : `0${n}`}</span>
              {label}
            </li>
          )
        })}
      </ol>
    </Container>
  )
}

export function BookingHeader({ frame }: { frame: NonNullable<Awaited<ReturnType<typeof loadBookingFrame>>> }) {
  return <SiteHeader property={frame.property} sections={frame.sections} onHome={false} />
}

/** "© 2026 hotel · address · phone" and "Vận hành bởi Digistay". */
export function BookingFooter({ property }: { property: { name: string; address: string | null; phone: string | null } }) {
  const t = useTranslations('site.blocks.footer')
  return (
    <footer className="mt-20 border-t border-line lg:mt-28">
      <Container className="flex flex-col gap-3 py-7 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{[`© ${new Date().getFullYear()} ${property.name}`, property.address, property.phone].filter(Boolean).join(' · ')}</p>
        <p className="flex items-center gap-2">
          {t('poweredBy')}
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" aria-hidden="true" />
            Digistay
          </span>
        </p>
      </Container>
    </footer>
  )
}
