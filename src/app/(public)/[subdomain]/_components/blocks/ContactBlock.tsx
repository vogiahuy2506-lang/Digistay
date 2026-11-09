import { blockText } from '@/lib/i18n/content'
import { Mail, MapPin, MessageCircle, Phone, Clock, Send, Share2 } from 'lucide-react'
import type { PublicBlock, PublicProperty } from '../PropertySite'
import { Eyebrow, Section, SectionTitle, cfgText } from '../site-ui'
import { useLocale, useTranslations } from 'next-intl'
import { formatAddress } from '@/lib/vn-admin/address'

interface Props {
  block: PublicBlock
  property: PublicProperty
}

export function ContactBlock({ block, property }: Props) {
  const locale = useLocale()
  const t = useTranslations('site.blocks.contact')
  const cfg = block.config || {}
  const title = blockText(cfg, locale, 'contactTitle', 'title') ?? t('title')
  const phone = cfgText(cfg, 'contactPhone') ?? property.hotline ?? property.phone
  const reception = property.receptionPhone
  const email = cfgText(cfg, 'contactEmail') ?? property.email
  const address = cfgText(cfg, 'contactAddress') ?? formatAddress(property)

  // Vietnamese phone numbers or custom Zalo link → zalo.me/<phone>
  const rawZalo = property.zalo || phone
  const zaloLink = rawZalo ? (rawZalo.startsWith('http') ? rawZalo : `https://zalo.me/${rawZalo.replace(/[^0-9]/g, '')}`) : null
  const whatsappLink = property.whatsapp ? (property.whatsapp.startsWith('http') ? property.whatsapp : `https://wa.me/${property.whatsapp.replace(/[^0-9]/g, '')}`) : null
  const telegramLink = property.telegram ? (property.telegram.startsWith('http') ? property.telegram : `https://t.me/${property.telegram.replace(/^@/, '')}`) : null
  const facebookLink = property.facebook

  const rows = [
    phone && { icon: Phone, label: property.hotline ? 'Hotline' : t('phone'), value: phone, href: `tel:${phone.replace(/[^\d+]/g, '')}` },
    reception && { icon: Phone, label: 'Lễ tân', value: reception, href: `tel:${reception.replace(/[^\d+]/g, '')}` },
    email && { icon: Mail, label: 'Email', value: email, href: `mailto:${email}` },
    zaloLink && { icon: MessageCircle, label: 'Zalo', value: 'Chat Zalo', href: zaloLink, external: true },
    whatsappLink && { icon: MessageCircle, label: 'WhatsApp', value: property.whatsapp || 'WhatsApp Chat', href: whatsappLink, external: true },
    telegramLink && { icon: Send, label: 'Telegram', value: property.telegram || 'Telegram Chat', href: telegramLink, external: true },
    facebookLink && { icon: Share2, label: 'Facebook', value: 'Fanpage', href: facebookLink, external: true },
    address && { icon: MapPin, label: t('address'), value: address, href: property.googleMapsUrl || undefined, external: Boolean(property.googleMapsUrl) },
    (property.checkInTime || property.checkOutTime) && {
      icon: Clock,
      label: 'Nhận / Trả phòng',
      value: `Check-in: ${property.checkInTime || '14:00'} · Check-out: ${property.checkOutTime || '12:00'}`,
    },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string; external?: boolean }[]

  return (
    <Section id="contact">
      <div className="grid gap-10 lg:grid-cols-[1fr_520px]">
        <div>
          <Eyebrow>{t('eyebrow')}</Eyebrow>
          <SectionTitle>{title}</SectionTitle>
          <p className="mt-4 max-w-md text-body text-muted">{t('intro')}</p>
        </div>
        <ul className="border-t border-line">
          {rows.map(({ icon: Icon, label, value, href, external }) => {
            const body = (
              <>
                <Icon className="h-4 w-4 shrink-0 text-acc" aria-hidden="true" />
                <span className="w-24 shrink-0 text-small text-muted">{label}</span>
                <span className="min-w-0 break-words text-body text-fg">{value}</span>
              </>
            )
            return (
              <li key={label} className="border-b border-line">
                {href ? (
                  <a
                    href={href}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="flex items-center gap-4 py-4 hover:text-acc"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="flex items-center gap-4 py-4">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Section>
  )
}
