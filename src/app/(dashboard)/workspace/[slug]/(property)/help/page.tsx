import Link from 'next/link'
import { ArrowLeft, Headphones, MessageCircle, Mail, LifeBuoy } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { PageContainer } from '@/components/layout'
import { prisma } from '@/lib/db/prisma'
import { routes } from '@/lib/utils/routes'
import { QuickstartVideo } from '@/components/help/quickstart-video'
import { OnboardingChecklist, type AutoOnboardingStatus } from '@/components/help/onboarding-checklist'
import { HelpArticles } from '@/components/help/help-articles'

export async function generateMetadata() {
  const t = await getTranslations('dash.help')
  return {
    title: t('metaTitle'),
  }
}

export default async function WorkspaceHelpPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const t = await getTranslations('dash.help')

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: { members: true },
      },
      properties: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          address: true,
          phone: true,
          _count: {
            select: {
              roomTypes: true,
              bookings: true,
              images: true,
            },
          },
          websiteSettings: {
            select: {
              isPublished: true,
            },
          },
        },
      },
    },
  })

  const firstProperty = workspace?.properties[0]

  const autoStatus: AutoOnboardingStatus = {
    hasPropertyInfo: Boolean(firstProperty?.address && firstProperty?.phone),
    hasRooms: (firstProperty?._count.roomTypes ?? 0) > 0,
    hasPublishedWebsite: Boolean(firstProperty?.websiteSettings?.isPublished),
    hasBookings: (firstProperty?._count.bookings ?? 0) > 0,
    hasInvitedMembers: (workspace?._count.members ?? 0) > 1,
  }

  return (
    <PageContainer className="space-y-8">
      {/* Top Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href={routes.workspace(slug)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('backTo', { name: workspace?.name ?? 'Workspace' })}</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-fg tracking-tight">
                {t('title')}
              </h1>
              <p className="text-xs sm:text-sm text-muted mt-0.5">
                {t('subtitle')}
              </p>
            </div>
          </div>
        </div>

        <a
          href="https://zalo.me"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-panel hover:bg-raised border border-line text-xs font-semibold text-fg shadow-2xs transition-colors shrink-0"
        >
          <MessageCircle className="w-4 h-4 text-primary" />
          <span>{t('liveChatZalo')}</span>
        </a>
      </div>

      {/* 1. Video ngắn 5 bước bắt đầu */}
      <QuickstartVideo />

      {/* 2. Interactive Checklist 5 bước bắt đầu */}
      <OnboardingChecklist
        workspaceSlug={slug}
        defaultPropertyId={firstProperty?.id ?? null}
        autoStatus={autoStatus}
      />

      {/* 3. Thư viện bài viết & Tìm kiếm tức thì */}
      <HelpArticles />

      {/* 4. Kênh hỗ trợ trực tiếp */}
      <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-acc-soft text-acc flex items-center justify-center shrink-0 border border-acc/20">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-fg">
                {t('directSupportTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl leading-relaxed">
                {t('directSupportSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="https://zalo.me"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold shadow-xs transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{t('supportZalo')}</span>
            </a>
            <a
              href="mailto:support@digistay.vn"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-raised hover:bg-panel border border-line text-fg text-xs font-semibold transition-colors"
            >
              <Mail className="w-4 h-4 text-muted" />
              <span>support@digistay.vn</span>
            </a>
          </div>
        </div>
      </section>
    </PageContainer>
  )
}
