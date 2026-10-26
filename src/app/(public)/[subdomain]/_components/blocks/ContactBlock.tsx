import { blockText } from '@/lib/i18n/content'
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
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
  const phone = cfgText(cfg, 'contactPhone') ?? property.phone
  const email = cfgText(cfg, 'contactEmail') ?? property.email
  const address = cfgText(cfg, 'contactAddress') ?? formatAddress(property)
  // Vietnamese phone numbers → zalo.me/<phone>
  const zaloLink = phone ? `https://zalo.me/${phone.replace(/[^0-9]/g, '')}` : null

  const rows = [
    phone && { icon: Phone, label: t('phone'), value: phone, href: `tel:${phone.replace(/[^\d+]/g, '')}` },
    email && { icon: Mail, label: 'Email', value: email, href: `mailto:${email}` },
    zaloLink && { icon: MessageCircle, label: 'Zalo', value: t('zaloMessage'), href: zaloLink, external: true },
    address && { icon: MapPin, label: t('address'), value: address },
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
