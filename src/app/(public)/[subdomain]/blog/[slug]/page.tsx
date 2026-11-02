import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { prisma } from '@/lib/db'
import { loadSiteFrame } from '@/lib/public-site/site-frame'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { canonicalSiteOrigin } from '@/lib/public-site/site-host'
import { hotelPageMetadata } from '@/lib/seo/page-metadata'
import { getLocale, getTranslations } from 'next-intl/server'
import { isLocale, type Locale } from '@/i18n/locales'
import { SiteHeader } from '../../_components/SiteHeader'
import { Container } from '../../_components/site-ui'
import { SiteLink } from '../../_components/site-base'
import { ArrowRight, Calendar, ChevronLeft, Clock, Sparkles, User } from 'lucide-react'
import { BlogContent } from '@/components/blog/blog-content'
import { BlogShareBar } from '@/components/blog/blog-share-bar'
import { readingTimeMinutes } from '@/lib/marketing/blog'

interface PageProps {
  params: Promise<{ subdomain: string; slug: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { subdomain, slug } = await params
  const visible = await loadVisibleSite(subdomain)
  if (!visible) return {}
  const frame = await loadSiteFrame(subdomain)
  if (!frame) return {}

  const post = await prisma.blogPost.findFirst({
    where: {
      propertyId: visible.propertyId,
      slug,
      isPublished: true,
      deletedAt: null,
    },
  })
  if (!post) return {}

  const locale: Locale = isLocale(await getLocale()) ? ((await getLocale()) as Locale) : 'vi'
  const title = post.metaTitle || post.title
  const description = post.metaDescription || post.summary || post.title
  const images = post.coverImage ? [post.coverImage] : []

  return hotelPageMetadata({
    origin: canonicalSiteOrigin(subdomain, frame.websiteSettings),
    locale,
    path: `/blog/${slug}`,
    siteName: frame.name,
    title: `${title} · ${frame.name}`,
    description,
    images,
    type: 'article',
    publishedTime: post.publishedAt?.toISOString(),
    authors: post.authorName ? [post.authorName] : undefined,
  })
}

export default async function BlogPostDetailPage({ params }: PageProps) {
  const { subdomain, slug } = await params
  const visible = await loadVisibleSite(subdomain)
  if (!visible) notFound()

  const frame = await loadSiteFrame(subdomain)
  if (!frame) notFound()

  const rawLocale = await getLocale()
  const locale = isLocale(rawLocale) ? rawLocale : 'vi'
  const t = await getTranslations({ locale, namespace: 'site.blog' })

  const post = await prisma.blogPost.findFirst({
    where: {
      propertyId: visible.propertyId,
      slug,
      isPublished: true,
      deletedAt: null,
    },
  })
  if (!post) notFound()

  // Fetch up to 3 related posts from the same property
  const relatedPosts = await prisma.blogPost.findMany({
    where: {
      propertyId: visible.propertyId,
      isPublished: true,
      deletedAt: null,
      id: { not: post.id },
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      coverImage: true,
      publishedAt: true,
      content: true,
    },
  })

  const shareUrl = `${canonicalSiteOrigin(subdomain, frame.websiteSettings)}/blog/${slug}`

  return (
    <>
      <SiteHeader property={frame} sections={[]} onHome={false} />

      <main className="min-h-[70vh] py-10 sm:py-16">
        <Container className="max-w-4xl">
          {/* Breadcrumb / Back button */}
          <div className="mb-8">
            <SiteLink
              path="/blog"
              className="inline-flex items-center gap-1.5 text-small text-muted hover:text-fg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('allPosts')}
            </SiteLink>
          </div>

          <article>
            {/* Post Header */}
            <header className="mb-8 sm:mb-12">
              <h1 className="font-site text-[30px] sm:text-[44px] leading-tight text-fg text-balance">
                {post.title}
              </h1>

              <div className="mt-5 flex items-center justify-between gap-4 flex-wrap border-b border-line pb-6 text-small text-muted">
                <div className="flex items-center gap-4 flex-wrap">
                  {post.authorName && (
                    <span className="flex items-center gap-1.5 font-medium text-fg">
                      <User className="w-4 h-4 text-acc" />
                      {post.authorName}
                    </span>
                  )}
                  {post.publishedAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {new Date(post.publishedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {t('readingTime', { minutes: readingTimeMinutes(post.content) })}
                  </span>
                </div>

                <BlogShareBar
                  url={shareUrl}
                  title={post.title}
                  labels={{
                    share: t('share'),
                    copyLink: t('copyLink'),
                    linkCopied: t('linkCopied'),
                    shareFb: t('shareFb'),
                    shareZalo: t('shareZalo'),
                  }}
                />
              </div>
            </header>

            {/* Featured Image */}
            {post.coverImage && (
              <div className="relative aspect-[16/9] w-full rounded-box overflow-hidden mb-10 border border-line bg-page shadow-sm">
                <Image src={post.coverImage} alt={post.title} fill priority className="object-cover" />
              </div>
            )}

            {/* Summary callout */}
            {post.summary && (
              <div className="p-5 sm:p-6 mb-10 rounded-ctl border-l-4 border-acc bg-panel text-body italic text-muted leading-relaxed">
                &ldquo;{post.summary}&rdquo;
              </div>
            )}

            {/* Rich Post Content */}
            <BlogContent content={post.content} />
          </article>

          {/* Related Posts Section */}
          {relatedPosts.length > 0 && (
            <section className="mt-16 sm:mt-24 pt-12 border-t border-line">
              <div className="mb-8">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-acc">
                  {t('relatedEyebrow')}
                </span>
                <h3 className="font-site text-2xl sm:text-3xl text-fg mt-1">
                  {t('relatedTitle')}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map((item) => (
                  <article
                    key={item.id}
                    className="group flex flex-col rounded-box border border-line bg-panel overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <SiteLink path={`/blog/${item.slug}`} className="block relative aspect-[16/10] overflow-hidden bg-page">
                      {item.coverImage ? (
                        <Image
                          src={item.coverImage}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted bg-fg/5 text-xs">
                          {frame.name}
                        </div>
                      )}
                    </SiteLink>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 text-xs text-muted mb-2">
                        <Clock className="w-3 h-3" />
                        <span>{t('readingTime', { minutes: readingTimeMinutes(item.content) })}</span>
                      </div>
                      <h4 className="font-site text-[17px] leading-snug text-fg group-hover:text-acc transition-colors line-clamp-2 mb-2">
                        <SiteLink path={`/blog/${item.slug}`}>{item.title}</SiteLink>
                      </h4>
                      {item.summary && (
                        <p className="text-small text-muted line-clamp-2 leading-relaxed flex-1">
                          {item.summary}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Upgraded Hotel Booking CTA Card */}
          <div className="mt-14 sm:mt-16 rounded-box border border-line bg-gradient-to-br from-panel via-panel to-acc/5 p-6 sm:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-8 shadow-sm">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-acc uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                {t('stayEyebrow')}
              </span>
              <h4 className="font-site text-[24px] sm:text-[28px] text-fg leading-snug">
                {t('ctaTitle', { hotel: frame.name })}
              </h4>
              <p className="mt-2 text-small text-muted leading-relaxed">
                {t('ctaDesc')}
              </p>
              <p className="mt-3 text-xs text-muted/80">
                {t('address', {
                  address: [frame.address, frame.ward, frame.district, frame.city].filter(Boolean).join(', '),
                })}
              </p>
            </div>
            <SiteLink
              path="/search"
              className="inline-flex items-center justify-center rounded-ctl bg-ink text-on-ink px-6 py-3.5 text-small font-semibold hover:bg-ink/90 transition-all shrink-0 hover:scale-[1.02] shadow-sm"
            >
              {t('bookNow')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </SiteLink>
          </div>
        </Container>
      </main>
    </>
  )
}
