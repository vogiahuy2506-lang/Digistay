import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { prisma } from '@/lib/db'
import { loadSiteFrame } from '@/lib/public-site/site-frame'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { canonicalSiteOrigin } from '@/lib/public-site/site-host'
import { hotelPageMetadata } from '@/lib/seo/page-metadata'
import { getLocale } from 'next-intl/server'
import { isLocale, type Locale } from '@/i18n/locales'
import { SiteHeader } from '../../_components/SiteHeader'
import { Container } from '../../_components/site-ui'
import { SiteLink } from '../../_components/site-base'
import { Calendar, ChevronLeft, Share2, User } from 'lucide-react'

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

  const metadata = hotelPageMetadata({
    origin: canonicalSiteOrigin(subdomain, frame.websiteSettings),
    locale,
    path: `/blog/${slug}`,
    siteName: frame.name,
    title: `${title} · ${frame.name}`,
    description,
    images,
  })

  // Thêm Open Graph kiểu bài viết (article)
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      authors: post.authorName ? [post.authorName] : undefined,
    },
  }
}

export default async function BlogPostDetailPage({ params }: PageProps) {
  const { subdomain, slug } = await params
  const visible = await loadVisibleSite(subdomain)
  if (!visible) notFound()

  const frame = await loadSiteFrame(subdomain)
  if (!frame) notFound()

  const post = await prisma.blogPost.findFirst({
    where: {
      propertyId: visible.propertyId,
      slug,
      isPublished: true,
      deletedAt: null,
    },
  })
  if (!post) notFound()

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
              Tất cả bài viết
            </SiteLink>
          </div>

          <article>
            {/* Post Header */}
            <header className="mb-8 sm:mb-12">
              <h1 className="font-site text-[30px] sm:text-[44px] leading-tight text-fg text-balance">
                {post.title}
              </h1>

              <div className="mt-4 flex items-center justify-between gap-4 flex-wrap border-b border-line pb-6 text-small text-muted">
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
                      {new Date(post.publishedAt).toLocaleDateString('vi-VN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted">Chia sẻ:</span>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                      `${canonicalSiteOrigin(subdomain, frame.websiteSettings)}/blog/${slug}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-line bg-panel hover:bg-fg/5 text-fg text-xs"
                    title="Chia sẻ lên Facebook"
                  >
                    FB
                  </a>
                </div>
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

            {/* Post Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none text-body sm:text-[17px] leading-[1.8] text-fg/90 space-y-6">
              {post.content.split('\n\n').map((paragraph, idx) => {
                const trimmed = paragraph.trim()
                if (!trimmed) return null
                return (
                  <p key={idx} className="whitespace-pre-line">
                    {trimmed}
                  </p>
                )
              })}
            </div>
          </article>

          {/* Hotel Footer Card */}
          <div className="mt-16 sm:mt-20 pt-10 border-t border-line">
            <div className="rounded-box border border-line bg-panel p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-semibold text-acc uppercase tracking-wider">Lưu trú & Nghỉ dưỡng</span>
                <h4 className="mt-1 font-site text-[22px] text-fg">{frame.name}</h4>
                <p className="mt-1 text-small text-muted">
                  Địa chỉ: {[frame.address, frame.ward, frame.district, frame.city].filter(Boolean).join(', ')}
                </p>
              </div>
              <SiteLink
                path="/search"
                className="inline-flex items-center justify-center rounded-ctl bg-ink text-on-ink px-5 py-2.5 text-small font-semibold hover:bg-ink/90 transition-colors shrink-0"
              >
                Đặt phòng ngay
              </SiteLink>
            </div>
          </div>
        </Container>
      </main>
    </>
  )
}
