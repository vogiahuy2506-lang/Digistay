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
import { SiteHeader } from '../_components/SiteHeader'
import { Container } from '../_components/site-ui'
import { SiteLink } from '../_components/site-base'
import { ArrowRight, Calendar, FileText, User } from 'lucide-react'

interface PageProps {
  params: Promise<{ subdomain: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { subdomain } = await params
  const visible = await loadVisibleSite(subdomain)
  if (!visible) return {}
  const frame = await loadSiteFrame(subdomain)
  if (!frame) return {}
  const locale: Locale = isLocale(await getLocale()) ? ((await getLocale()) as Locale) : 'vi'

  return hotelPageMetadata({
    origin: canonicalSiteOrigin(subdomain, frame.websiteSettings),
    locale,
    path: '/blog',
    siteName: frame.name,
    title: `Cẩm nang & Tin tức · ${frame.name}`,
    description: `Khám phá các bài viết cẩm nang du lịch, ẩm thực và tin tức mới nhất từ ${frame.name}.`,
    images: [],
  })
}

export default async function PublicBlogPage({ params }: PageProps) {
  const { subdomain } = await params
  const visible = await loadVisibleSite(subdomain)
  if (!visible) notFound()

  const frame = await loadSiteFrame(subdomain)
  if (!frame) notFound()

  const posts = await prisma.blogPost.findMany({
    where: {
      propertyId: visible.propertyId,
      isPublished: true,
      deletedAt: null,
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })

  return (
    <>
      <SiteHeader property={frame} sections={[]} onHome={false} />

      <main className="min-h-[70vh] py-12 sm:py-20">
        <Container>
          {/* Header */}
          <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-acc">
              Góc chia sẻ
            </span>
            <h1 className="mt-2 font-site text-[32px] sm:text-[44px] leading-tight text-fg text-balance">
              Cẩm nang & Tin tức
            </h1>
            <p className="mt-3 text-small sm:text-body text-muted text-balance">
              Khám phá văn hóa ẩm thực địa phương, kinh nghiệm tham quan và những câu chuyện thú vị cùng{' '}
              <span className="text-fg font-medium">{frame.name}</span>.
            </p>
          </div>

          {/* Posts Grid */}
          {posts.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-16 px-4 rounded-box border border-line bg-panel">
              <FileText className="mx-auto w-12 h-12 text-muted/60 mb-3" />
              <p className="text-body font-medium text-fg">Chưa có bài viết nào</p>
              <p className="mt-1 text-small text-muted">
                Các bài viết chia sẻ kinh nghiệm và cẩm nang du lịch sẽ sớm được cập nhật.
              </p>
              <SiteLink
                path="/"
                className="mt-6 inline-flex items-center gap-1.5 rounded-ctl bg-ink px-4 py-2 text-small font-medium text-on-ink hover:bg-ink/90 transition-colors"
              >
                Về trang chủ
              </SiteLink>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="group flex flex-col rounded-box border border-line bg-panel overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <SiteLink path={`/blog/${post.slug}`} className="block relative aspect-[16/10] overflow-hidden bg-page">
                    {post.coverImage ? (
                      <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted bg-fg/5">
                        <FileText className="w-10 h-10" />
                      </div>
                    )}
                  </SiteLink>

                  <div className="flex flex-col flex-1 p-5 sm:p-6">
                    <div className="flex items-center gap-3 text-xs text-muted mb-2.5">
                      {post.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(post.publishedAt).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                      {post.authorName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {post.authorName}
                        </span>
                      )}
                    </div>

                    <h2 className="font-site text-[20px] leading-snug text-fg group-hover:text-acc transition-colors line-clamp-2">
                      <SiteLink path={`/blog/${post.slug}`}>{post.title}</SiteLink>
                    </h2>

                    {post.summary && (
                      <p className="mt-2.5 text-small text-muted line-clamp-3 leading-relaxed flex-1">
                        {post.summary}
                      </p>
                    )}

                    <div className="mt-5 pt-4 border-t border-line">
                      <SiteLink
                        path={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1.5 text-small font-medium text-acc hover:underline"
                      >
                        Đọc tiếp
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </SiteLink>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Booking CTA Banner */}
          <div className="mt-16 sm:mt-24 rounded-box border border-line bg-panel p-8 sm:p-12 text-center max-w-3xl mx-auto">
            <h3 className="font-site text-[24px] sm:text-[30px] text-fg">
              Lên kế hoạch nghỉ dưỡng tại {frame.name}?
            </h3>
            <p className="mt-2 text-small sm:text-body text-muted">
              Đặt phòng trực tiếp trên website để nhận mức giá tốt nhất và các ưu đãi đặc quyền.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <SiteLink
                path="/search"
                className="inline-flex items-center gap-2 rounded-ctl bg-acc text-on-acc px-6 py-2.5 text-small font-semibold hover:opacity-90 transition-opacity"
              >
                Xem phòng & Đặt ngay
              </SiteLink>
            </div>
          </div>
        </Container>
      </main>
    </>
  )
}
