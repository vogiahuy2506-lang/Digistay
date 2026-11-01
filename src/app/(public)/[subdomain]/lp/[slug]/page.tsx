import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Script from 'next/script'
import { prisma } from '@/lib/db'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { canonicalSiteOrigin } from '@/lib/public-site/site-host'
import { LiveCountdown } from './_components/LiveCountdown'
import { CampaignLeadForm } from './_components/CampaignLeadForm'
import { StickyMobileBookingBar } from './_components/StickyMobileBookingBar'
import {
  Hotel,
  ShieldCheck,
  CheckCircle2,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  Star,
  Users,
  Maximize2,
  Calendar,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ subdomain: string; slug: string }>
}

export const dynamic = 'force-dynamic'

const loadLandingPageData = cache(async (subdomain: string, slug: string) => {
  const visible = await loadVisibleSite(subdomain)
  if (!visible) return null

  const property = await prisma.property.findFirst({
    where: { id: visible.propertyId, isActive: true },
    include: {
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 8 },
      roomTypes: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          amenities: { include: { amenity: true }, take: 4 },
        },
      },
      amenities: { include: { amenity: true }, take: 8 },
      websiteSettings: true,
      reviews: { where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 4 },
    },
  })

  if (!property) return null

  const landingPage = await prisma.landingPage.findFirst({
    where: {
      propertyId: property.id,
      slug,
      deletedAt: null,
    },
  })

  if (!landingPage) return null

  // Chỉ hiển thị cho khách nếu đã PUBLISHED, hoặc hiển thị nếu là preview của thành viên
  if (landingPage.status !== 'PUBLISHED' && !visible.preview) {
    return null
  }

  // Tăng lượt xem (không chặn rendering)
  prisma.landingPage
    .update({
      where: { id: landingPage.id },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => {})

  return { property, landingPage, preview: visible.preview }
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { subdomain, slug } = await params
  const data = await loadLandingPageData(subdomain, slug)
  if (!data) return {}

  const { property, landingPage } = data
  const title = landingPage.metaTitle || `${landingPage.title} · ${property.name}`
  const description =
    landingPage.metaDescription || property.description || 'Ưu đãi phòng nghỉ dưỡng hấp dẫn dành riêng cho bạn.'
  const image = landingPage.ogImage || property.coverImage || property.images[0]?.url

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: image ? [{ url: image }] : [],
    },
  }
}

export default async function PublicLandingPage({ params }: PageProps) {
  const { subdomain, slug } = await params
  const data = await loadLandingPageData(subdomain, slug)
  if (!data) notFound()

  const { property, landingPage, preview } = data
  const theme = (landingPage.themeConfig as any) || {}
  const primaryColor = theme.primaryColor || '#3B82F6'
  const blocks = (landingPage.blocks as any[]) || []
  const pixels = (landingPage.trackingPixels as any) || {}

  // Định dạng giá phòng bắt đầu
  const minPrice = property.roomTypes.reduce<number | null>((acc, r) => {
    const p = (r as any).fromPrice
    if (typeof p === 'number' && p > 0) {
      return acc === null ? p : Math.min(acc, p)
    }
    return acc
  }, null)
  const startingPriceFormatted = minPrice ? `${minPrice.toLocaleString('vi-VN')}₫` : null

  return (
    <div
      className="min-h-screen bg-background text-fg flex flex-col selection:bg-primary/20"
      style={{ fontFamily: theme.fontFamily || 'Inter, sans-serif' }}
    >
      {/* Tracking Pixels Injection */}
      {pixels.fbPixelId && (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixels.fbPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {pixels.ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${pixels.ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${pixels.ga4Id}');
            `}
          </Script>
        </>
      )}

      {/* Preview Banner */}
      {preview && landingPage.status !== 'PUBLISHED' && (
        <div className="bg-amber-500 text-white text-xs font-semibold py-1.5 px-4 text-center sticky top-0 z-50">
          Chế độ xem trước (Bản nháp) — Chỉ thành viên của cơ sở mới nhìn thấy trang này.
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-40 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href={`/${subdomain}`} className="flex items-center gap-3 group">
            {property.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={property.logo} alt={property.name} className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div
                className="w-9 h-9 rounded-lg text-white font-bold flex items-center justify-center shadow-xs"
                style={{ backgroundColor: primaryColor }}
              >
                {property.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="font-bold text-sm sm:text-base text-fg block truncate group-hover:text-primary transition-colors">
                {property.name}
              </span>
              <span className="text-[11px] text-muted block -mt-0.5">{property.city}</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {property.phone && (
              <a
                href={`tel:${property.phone.replace(/[^\d+]/g, '')}`}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-fg"
              >
                <Phone className="w-3.5 h-3.5 text-primary" />
                {property.phone}
              </a>
            )}
            <a
              href="#rooms"
              className="px-4 py-2 rounded-full text-white text-xs font-semibold shadow hover:opacity-95 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              Đặt phòng ngay
            </a>
          </div>
        </div>
      </header>

      {/* Main Blocks Content */}
      <main className="flex-1 space-y-16 sm:space-y-24 py-8 sm:py-12">
        {blocks.map((block) => {
          const cfg = block.config || {}
          return (
            <section key={block.id} id={block.type === 'ROOMS' ? 'rooms' : undefined} className="max-w-6xl mx-auto px-4 sm:px-6">
              {/* HERO BLOCK */}
              {block.type === 'HERO' && (
                <div className="text-center py-8 sm:py-16 space-y-5 max-w-3xl mx-auto">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    Ưu Đãi Đặc Quyền · {property.city}
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-extrabold text-fg tracking-tight leading-tight">
                    {cfg.title || landingPage.title}
                  </h1>

                  <p className="text-base sm:text-lg text-muted leading-relaxed">
                    {cfg.subtitle || property.description}
                  </p>

                  <div className="pt-4 flex flex-wrap justify-center gap-3">
                    <a
                      href="#rooms"
                      className="px-8 py-3.5 rounded-full text-white font-semibold text-sm shadow-md hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {cfg.ctaText || 'Khám phá các hạng phòng'}
                    </a>
                    {property.phone && (
                      <a
                        href={`tel:${property.phone.replace(/[^\d+]/g, '')}`}
                        className="px-6 py-3.5 rounded-full border bg-card font-semibold text-sm text-fg hover:bg-muted/50 transition-colors flex items-center gap-2"
                      >
                        <Phone className="w-4 h-4 text-primary" />
                        Gọi tư vấn
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* FLASH SALE / COUNTDOWN BLOCK */}
              {block.type === 'CTA' && (
                <LiveCountdown
                  title={cfg.title || 'Ưu Đãi Flash Sale'}
                  subtitle={cfg.subtitle}
                  buttonText={cfg.buttonText || 'Giữ phòng ngay'}
                  buttonLink="#rooms"
                  primaryColor={primaryColor}
                  endDate={cfg.endDate}
                />
              )}

              {/* ROOMS BLOCK */}
              {block.type === 'ROOMS' && (
                <div className="space-y-8">
                  <div className="text-center max-w-xl mx-auto space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-bold text-fg">{cfg.title || 'Các Hạng Phòng Ưu Đãi'}</h2>
                    {cfg.subtitle && <p className="text-sm text-muted">{cfg.subtitle}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {property.roomTypes.slice(0, cfg.limit || 6).map((room) => {
                      const photo = room.images[0]?.url || property.coverImage || property.images[0]?.url
                      return (
                        <div
                          key={room.id}
                          className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between"
                        >
                          <div>
                            {photo ? (
                              <div className="relative h-48 sm:h-52 w-full bg-muted overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo} alt={room.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="h-48 bg-muted flex items-center justify-center text-muted">
                                <Hotel className="w-8 h-8 opacity-40" />
                              </div>
                            )}

                            <div className="p-5 space-y-3">
                              <h3 className="font-bold text-lg text-fg line-clamp-1">{room.name}</h3>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                                {room.area && (
                                  <span className="flex items-center gap-1">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    {room.area} m²
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" />
                                  Tối đa {room.maxAdults} người lớn
                                </span>
                              </div>

                              {room.amenities.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {room.amenities.map((a) => (
                                    <span key={a.amenityId} className="text-[11px] bg-muted/60 px-2 py-0.5 rounded text-muted-fg">
                                      {a.amenity.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-5 pt-0 border-t mt-4 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-muted">Giá chỉ từ</div>
                              <div className="text-base font-bold text-emerald-600">
                                {(room as any).fromPrice
                                  ? `${Number((room as any).fromPrice).toLocaleString('vi-VN')}₫`
                                  : 'Liên hệ'}
                              </div>
                            </div>
                            <Link
                              href={`/${subdomain}/rooms/${room.id}`}
                              className="px-4 py-2 rounded-full text-white text-xs font-semibold shadow hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: primaryColor }}
                            >
                              Đặt phòng
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ABOUT / DIRECT BOOKING PERKS BLOCK */}
              {block.type === 'ABOUT' && (
                <div className="rounded-2xl border p-6 sm:p-10 bg-card/60 space-y-6">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider mb-2">
                      <ShieldCheck className="w-4 h-4" />
                      Cam Kết Giá Tốt Nhất
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-fg">
                      {cfg.title || 'Tại Sao Nên Đặt Trực Tiếp Tại Website?'}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-card border space-y-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                        1
                      </div>
                      <div className="font-semibold text-sm text-fg">Giá Rẻ Hơn 10% So Với OTA</div>
                      <p className="text-xs text-muted">Tiết kiệm chi phí hoa hồng trung gian trực tiếp vào giá phòng của bạn.</p>
                    </div>

                    <div className="p-4 rounded-xl bg-card border space-y-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                        2
                      </div>
                      <div className="font-semibold text-sm text-fg">Miễn Phí Check-in Sớm</div>
                      <p className="text-xs text-muted">Ưu tiên sắp xếp nhận phòng sớm linh hoạt theo tình trạng phòng trống.</p>
                    </div>

                    <div className="p-4 rounded-xl bg-card border space-y-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                        3
                      </div>
                      <div className="font-semibold text-sm text-fg">Tư Vấn & Hỗ Trợ 24/7</div>
                      <p className="text-xs text-muted">Liên hệ trực tiếp lễ tân không qua tổng đài hỗ trợ phức tạp.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* AMENITIES BLOCK */}
              {block.type === 'AMENITIES' && (
                <div className="space-y-6">
                  <div className="text-center max-w-xl mx-auto">
                    <h2 className="text-2xl font-bold text-fg">{cfg.title || 'Tiện Ích Nổi Bật'}</h2>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {property.amenities.map((item) => (
                      <div key={item.amenityId} className="p-4 rounded-xl border bg-card text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div className="font-medium text-xs text-fg">{item.amenity.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REVIEWS BLOCK */}
              {block.type === 'REVIEWS' && property.reviews.length > 0 && (
                <div className="space-y-6">
                  <div className="text-center max-w-xl mx-auto">
                    <h2 className="text-2xl font-bold text-fg">{cfg.title || 'Đánh Giá Từ Du Khách'}</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {property.reviews.map((rev) => (
                      <div key={rev.id} className="p-5 rounded-xl border bg-card space-y-2">
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-amber-400" />
                          ))}
                        </div>
                        <p className="text-xs text-fg italic leading-relaxed">&ldquo;{rev.comment}&rdquo;</p>
                        <div className="text-xs font-semibold text-muted pt-1">— {rev.guestName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONTACT / LEAD FORM BLOCK */}
              {block.type === 'CONTACT' && (
                <CampaignLeadForm
                  propertyId={property.id}
                  landingPageId={landingPage.id}
                  title={cfg.title || 'Để Lại Thông Tin Nhận Ưu Đãi'}
                  subtitle={cfg.subtitle || 'Chúng tôi sẽ gửi mã giảm giá và báo giá chi tiết qua email/tin nhắn cho bạn.'}
                  primaryColor={primaryColor}
                />
              )}
            </section>
          )
        })}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-10 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div>
            <div className="font-semibold text-fg text-sm">{property.name}</div>
            <p className="mt-0.5">
              {property.address}, {property.city}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/${subdomain}`} className="hover:text-fg underline">
              Về website chính
            </Link>
            {property.phone && (
              <a href={`tel:${property.phone.replace(/[^\d+]/g, '')}`} className="hover:text-fg font-medium">
                Hotline: {property.phone}
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* Sticky Mobile Booking Bar */}
      <StickyMobileBookingBar
        phone={property.phone}
        bookingLink="#rooms"
        primaryColor={primaryColor}
        startingPrice={startingPriceFormatted}
      />
    </div>
  )
}

