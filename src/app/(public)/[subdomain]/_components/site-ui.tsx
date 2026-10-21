import * as React from 'react'
import type { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/** The hotel site's translator (useTranslations('site') / getTranslations('site')). */
export type SiteT = ReturnType<typeof useTranslations<'site'>>

/**
 * Building blocks of a hotel's website (redesign 3a / 2c, direction A):
 * wide margins, near-square corners, serif headings in the hotel's font,
 * small uppercase eyebrows in its accent.
 */

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1280px] px-4 sm:px-8 lg:px-12', className)}>{children}</div>
}

export function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn('py-16 sm:py-24 scroll-mt-20', className)}>
      <Container>{children}</Container>
    </section>
  )
}

export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn('text-label uppercase text-acc mb-3', className)}>{children}</p>
}

export function SectionTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h2 className={cn('font-site text-[32px] leading-[40px] sm:text-h2 lg:text-[44px] lg:leading-[52px] text-fg', className)}>
      {children}
    </h2>
  )
}

/** Section heading row: eyebrow + title on the left, a short note on the right (3a). */
export function SectionHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow?: string
  title: string
  aside?: React.ReactNode
}) {
  return (
    <div className="mb-10 sm:mb-12 grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <SectionTitle>{title}</SectionTitle>
      </div>
      {aside && <div className="text-body text-muted lg:pb-1">{aside}</div>}
    </div>
  )
}

/** Where a photo would be: a calm tint with its caption, never a broken image. */
export function PhotoPlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('relative bg-fg/[0.06]', className)}>
      <span className="absolute bottom-3 left-3 bg-panel/90 px-2 py-0.5 font-mono text-[11px] text-muted">{label}</span>
    </div>
  )
}

const PROPERTY_TYPES: Record<string, string> = {
  HOTEL: 'Khách sạn',
  HOMESTAY: 'Homestay',
  RESORT: 'Resort',
  RESTAURANT: 'Nhà hàng',
  VILLA: 'Villa',
  MOTEL: 'Nhà nghỉ',
}

// Without `t` the labels stay Vietnamese, for callers not translated yet.
export function propertyTypeLabel(type: string, t?: SiteT): string {
  if (t) return type in PROPERTY_TYPES ? t(`propertyType.${type as 'HOTEL'}`) : t('propertyType.other')
  return PROPERTY_TYPES[type] ?? 'Cơ sở lưu trú'
}

const BED_LABELS: Record<string, string> = {
  SINGLE: '1 giường đơn',
  DOUBLE: '1 giường đôi',
  TWIN: '2 giường đơn',
  TRIPLE: '3 giường đơn',
  QUADRUPLE: '4 giường đơn',
  KING: '1 giường King',
  QUEEN: '1 giường Queen',
  SUITE: 'Suite',
  BUNK: 'Giường tầng',
}

export function bedLabel(bedType: string, t?: SiteT): string {
  if (t && bedType in BED_LABELS) return t(`bed.${bedType as 'DOUBLE'}`)
  return BED_LABELS[bedType] ?? bedType
}

/** "32 m² · 1 giường đôi · 2 người lớn + 1 trẻ em" */
export function roomMeta(room: { area: number | null; bedType: string; maxAdults: number; maxChildren: number }, t?: SiteT): string {
  if (t) {
    const guests =
      room.maxChildren > 0
        ? t('room.maxGuestsWithChildren', { adults: room.maxAdults, children: room.maxChildren })
        : t('room.maxGuests', { adults: room.maxAdults })
    return [room.area ? t('units.area', { area: room.area }) : null, bedLabel(room.bedType, t), guests].filter(Boolean).join(' · ')
  }
  const guests = room.maxChildren > 0 ? `${room.maxAdults} người lớn + ${room.maxChildren} trẻ em` : `${room.maxAdults} người lớn`
  return [room.area ? `${room.area} m²` : null, bedLabel(room.bedType), guests].filter(Boolean).join(' · ')
}

/** The builder saves `heroTitle`, `roomsTitle`...; older defaults used `title`. */
export function cfgText(cfg: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = cfg?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}
