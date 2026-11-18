import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkPropertyAccess, can } from '@/lib/auth/access'
import { generateFullWebsiteSiteWithAi } from '@/lib/ai/website-ai'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { recordSiteVersion } from '@/lib/public-site/versions'
import { BlockType } from '@prisma/client'

const schema = z.object({
  propertyId: z.string().min(1, 'Thiếu propertyId'),
  prompt: z.string().trim().optional(),
  stylePreset: z.string().trim().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ' }, { status: 400 })
    }

    const { propertyId, prompt, stylePreset } = parsed.data
    const granted = await checkPropertyAccess(session.user.id, propertyId, null)
    if (!granted.ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }
    if (!can(granted.access, 'website_manage', granted.property.id)) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    // Call AI Website Studio Engine
    const generated = await generateFullWebsiteSiteWithAi({
      propertyId,
      prompt,
      stylePreset,
    })

    // Update settings in database
    const settings = await prisma.websiteSettings.upsert({
      where: { propertyId },
      create: {
        propertyId,
        primaryColor: generated.theme.primaryColor,
        secondaryColor: generated.theme.secondaryColor,
        accentColor: generated.theme.accentColor,
        buttonColor: generated.theme.buttonColor,
        headingColor: generated.theme.headingColor,
        backgroundColor: generated.theme.backgroundColor,
        fontFamily: generated.theme.fontFamily,
        headingFont: generated.theme.headingFont,
        themePreset: generated.theme.themePreset,
        layout: generated.theme.layout,
        metaTitle: generated.seo.metaTitle,
        metaDescription: generated.seo.metaDescription,
        metaKeywords: generated.seo.metaKeywords,
        translations: generated.translations as any,
        lastAiPrompt: prompt || null,
      },
      update: {
        primaryColor: generated.theme.primaryColor,
        secondaryColor: generated.theme.secondaryColor,
        accentColor: generated.theme.accentColor,
        buttonColor: generated.theme.buttonColor,
        headingColor: generated.theme.headingColor,
        backgroundColor: generated.theme.backgroundColor,
        fontFamily: generated.theme.fontFamily,
        headingFont: generated.theme.headingFont,
        themePreset: generated.theme.themePreset,
        layout: generated.theme.layout,
        metaTitle: generated.seo.metaTitle,
        metaDescription: generated.seo.metaDescription,
        metaKeywords: generated.seo.metaKeywords,
        translations: generated.translations as any,
        lastAiPrompt: prompt || null,
      },
    })

    // Replace blocks transactionally and snapshot version
    await prisma.$transaction(async (tx) => {
      await tx.websiteBlock.deleteMany({ where: { propertyId } })
      for (const b of generated.blocks) {
        await tx.websiteBlock.create({
          data: {
            propertyId,
            type: b.type as BlockType,
            name: b.name,
            layoutVariant: b.layoutVariant || 'default',
            sortOrder: b.sortOrder,
            isEnabled: b.isEnabled,
            config: b.config,
          },
        })
      }
      await recordSiteVersion(tx, { propertyId, userId: session.user.id, kind: 'AUTO' })
    })

    const finalBlocks = await prisma.websiteBlock.findMany({
      where: { propertyId },
      orderBy: { sortOrder: 'asc' },
    })

    invalidatePublicSite(propertyId)

    return NextResponse.json({
      success: true,
      data: {
        settings,
        blocks: finalBlocks,
      },
    })
  } catch (error) {
    console.error('[API generate-site] Error:', error)
    return NextResponse.json({ success: false, error: 'Không thể tạo website bằng AI lúc này' }, { status: 500 })
  }
}
