import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { normalizeHostname } from '@/lib/custom-domain'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { keepSiteBaseline, recordSiteVersion } from '@/lib/public-site/versions'
import { NO_PERMISSION, accessibleProperties, can, checkPropertyAccess } from '@/lib/auth/access'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'
import { lockedResponseForProperty } from '@/lib/billing/guard'

// propertyId must be a string: undefined or a filter object reaching
// Prisma would match the wrong property.
const putSchema = z.object({
  propertyId: z.string().min(1),
  settings: z.record(z.any()),
})

/** A #rrggbb color, or null (empty, missing or anything else: the default). */
function hexColorOrNull(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : null
}

/** The SEO texts in English (settings.translations). */
const seoTranslations = translationsInput(['metaTitle', 'metaDescription'], 500)

/**
 * GET /api/website/settings?propertyId=xxx
 * Lấy website settings cho một property
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    // Check property access
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ...accessibleProperties(session.user.id) },
      select: { id: true },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    // Get or create settings
    let settings = await prisma.websiteSettings.findUnique({
      where: { propertyId },
    })

    if (!settings) {
      settings = await prisma.websiteSettings.create({
        data: { propertyId },
      })
      invalidatePublicSite(propertyId)
    }

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Get website settings error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy cài đặt website' }, { status: 500 })
  }
}

/**
 * PUT /api/website/settings
 * Cập nhật website settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = putSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) {
      return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 })
    }
    const { settings } = body.data
    const translations = seoTranslations.safeParse(settings.translations ?? undefined)
    if (!translations.success) {
      return NextResponse.json({ success: false, error: 'Bản tiếng Anh không hợp lệ' }, { status: 400 })
    }

    // Check property access
    const granted = await checkPropertyAccess(session.user.id, body.data.propertyId, null)
    if (!granted.ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa' }, { status: 403 })
    }
    // Who has website_manage edits the site, like the custom domain and SSL
    // routes and the sidebar. Publishing decides whether guests see the site
    // and can book.
    const propertyId = granted.property.id
    if (!can(granted.access, 'website_manage', propertyId)) {
      return NextResponse.json({ success: false, error: NO_PERMISSION }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(propertyId)
    if (locked) return locked

    // The form sends the domain back unchanged, or empty to remove it. A new
    // domain is attached only by /api/website/domain/verify, after the DNS
    // proves this workspace owns it (saving it here once kept "verified"
    // on any domain typed in).
    const current = await prisma.websiteSettings.findUnique({
      where: { propertyId },
      select: { customDomain: true, translations: true },
    })
    const requested = settings.customDomain
    const removeDomain = (requested === null || requested === '') && current?.customDomain != null
    const unchanged = requested === current?.customDomain || normalizeHostname(requested) === current?.customDomain
    if (typeof requested === 'string' && requested !== '' && !unchanged) {
      return NextResponse.json(
        { success: false, error: 'Gắn tên miền riêng bằng nút "Xác minh tên miền" (cần thêm bản ghi DNS).' },
        { status: 400 }
      )
    }
    const domainFields = removeDomain
      ? {
          customDomain: null,
          domainVerificationStatus: null,
          domainVerifiedAt: null,
          sslEnabled: false,
          sslVerifiedAt: null,
          sslCertificateId: null,
          sslProvider: null,
          sslRequestedAt: null,
          sslCheckedAt: null,
          sslError: null,
        }
      : {}

    // Update or create settings, and keep the site as saved as a version
    // (src/lib/public-site/versions.ts; publishing alone adds none).
    const userId = session.user.id
    const updatedSettings = await prisma.$transaction(async (tx) => {
      await keepSiteBaseline(tx, propertyId)
      const saved = await tx.websiteSettings.upsert({
        where: { propertyId },
        update: {
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
          ...(settings.buttonColor !== undefined && { buttonColor: hexColorOrNull(settings.buttonColor) }),
          ...(settings.headingColor !== undefined && { headingColor: hexColorOrNull(settings.headingColor) }),
          accentColor: settings.accentColor,
          fontFamily: settings.fontFamily,
          headingFont: settings.headingFont,
          layout: settings.layout,
          metaTitle: settings.metaTitle,
          metaDescription: settings.metaDescription,
          translations: mergeTranslations(current?.translations, translations.data),
          ...domainFields,
          isPublished: settings.isPublished,
          publishedAt: settings.isPublished ? new Date() : null,
        },
        create: {
          propertyId,
          primaryColor: settings.primaryColor || '#3B82F6',
          secondaryColor: settings.secondaryColor || '#10B981',
          buttonColor: hexColorOrNull(settings.buttonColor),
          headingColor: hexColorOrNull(settings.headingColor),
          accentColor: settings.accentColor || '#F59E0B',
          fontFamily: settings.fontFamily || 'Inter',
          headingFont: settings.headingFont || 'Playfair Display',
          layout: settings.layout || 'modern',
          metaTitle: settings.metaTitle,
          metaDescription: settings.metaDescription,
          translations: mergeTranslations(null, translations.data),
          isPublished: settings.isPublished || false,
        },
      })
      await recordSiteVersion(tx, { propertyId, userId })
      return saved
    })

    // Log activity
    invalidatePublicSite(propertyId)

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId,
        action: settings.isPublished ? 'PUBLISH' : 'UPDATE',
        entityType: 'WEBSITE_SETTINGS',
        entityId: updatedSettings.id,
        changes: { isPublished: settings.isPublished },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: settings.isPublished ? 'Website đã được xuất bản' : 'Cập nhật cài đặt thành công',
    })
  } catch (error) {
    console.error('Update website settings error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật cài đặt' }, { status: 500 })
  }
}
