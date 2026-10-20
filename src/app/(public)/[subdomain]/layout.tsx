import { cache } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { siteBasePath } from '@/lib/public-site/paths'
import { hotelAccentVariables } from '@/lib/public-site/accent'
import { fontStack } from '@/lib/public-site/font-stack'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { SiteBaseProvider } from './_components/site-base'
import { siteFontVariables } from './fonts'

/** What the frame of every hotel page needs; shared by the layout and its metadata. */
const loadSiteFrame = cache((subdomain: string) =>
  prisma.property.findFirst({
    where: { subdomain, isActive: true },
    select: {
      name: true,
      description: true,
      websiteSettings: {
        select: { primaryColor: true, fontFamily: true, headingFont: true, metaTitle: true, metaDescription: true },
      },
    },
  })
)

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
  const { subdomain } = await params
  // An unpublished site is a 404: its title must not give the hotel away.
  if (!(await loadVisibleSite(subdomain))) return {}
  const site = await loadSiteFrame(subdomain)
  if (!site) return {}
  // Hotel pages used to carry Digistay's own title ("DigiStay - Nền Tảng No-Code...").
  return {
    title: site.websiteSettings?.metaTitle || site.name,
    description: site.websiteSettings?.metaDescription || site.description || undefined,
  }
}

/**
 * Every page of a hotel's site. Works out once whether links need the
 * "/<subdomain>" prefix, and sets the site's look: light only, near-square
 * corners (data-surface="site"), the hotel's accent and fonts.
 */
export default async function HotelSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const host = (await headers()).get('host')
  const settings = (await loadSiteFrame(subdomain))?.websiteSettings
  const preview = (await loadVisibleSite(subdomain))?.preview ?? false

  const style = {
    ...hotelAccentVariables(settings?.primaryColor),
    '--site-body': fontStack(settings?.fontFamily, 'body'),
    '--site-heading': fontStack(settings?.headingFont, 'heading'),
    // Older blocks and the search page still read these (raw hotel colors).
    '--brand-primary': settings?.primaryColor ?? '#A93119',
    '--brand-font-body': 'var(--site-body)',
    '--brand-font-heading': 'var(--site-heading)',
  } as React.CSSProperties

  return (
    <div
      data-theme="light"
      data-surface="site"
      className={`${siteFontVariables} min-h-screen bg-page text-fg font-site-body antialiased`}
      style={style}
    >
      {preview && (
        <p className="bg-ink px-4 py-2 text-center text-small text-on-ink">
          Bản xem trước: website chưa xuất bản, chỉ thành viên của khách sạn đang đăng nhập mới xem được.
        </p>
      )}
      <SiteBaseProvider base={siteBasePath(subdomain, host)}>{children}</SiteBaseProvider>
    </div>
  )
}
