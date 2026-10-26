import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { rootDomain } from '@/lib/subdomains'
import {
  checkOwnership,
  checkRouting,
  normalizeHostname,
  ownershipRecord,
  resolver,
} from '@/lib/custom-domain'
import { certificateRequest } from '@/lib/public-site/custom-domains'
import { lockedResponse } from '@/lib/billing/guard'

const bodySchema = z.object({
  propertyId: z.string().min(1),
  domain: z.string().min(1).max(300),
})

/**
 * POST /api/website/domain/verify
 * Attach the hotel's own domain to its property site, only once DNS proves
 * both that it points at this property and that this workspace controls it
 * (src/lib/custom-domain.ts). Nothing is written until both pass, so a
 * failed or flaky check never changes what the hotel already has.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = bodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId hoặc domain' }, { status: 400 })
    }

    const property = await prisma.property.findFirst({
      where: {
        id: body.data.propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
      select: {
        id: true,
        subdomain: true,
        workspaceId: true,
        websiteSettings: { select: { customDomain: true, domainVerificationStatus: true, sslEnabled: true } },
      },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở' }, { status: 404 })
    }

    // The domain decides where the hotel's brand traffic goes.
    const access = await requireWorkspaceRole(property.workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
    if (!access.ok) return access.response
    const locked = await lockedResponse(property.workspaceId)
    if (locked) return locked

    const root = rootDomain()
    const host = normalizeHostname(body.data.domain, root)
    if (!host) {
      return NextResponse.json({ success: false, error: 'Tên miền không hợp lệ' }, { status: 400 })
    }

    const target = `${property.subdomain}.${root}`
    const txt = ownershipRecord(property.workspaceId, host)
    const records = await expectedRecords(host, target, txt, root)

    // Held by another site: never moved automatically, even with valid DNS
    // (RUNBOOK "Tên miền riêng"). The records let support check the claim.
    const taken = await prisma.websiteSettings.findFirst({
      where: { customDomain: host, NOT: { propertyId: property.id } },
      select: { id: true },
    })
    if (taken) return domainTaken(records)

    const routing = await checkRouting(host, target, root)
    if (!routing.ok) return failed(routing.reason, records, routing.found)

    // This site's own verified domain is not asked for the TXT again.
    const current = property.websiteSettings
    const ownActive = current?.customDomain === host && current.domainVerificationStatus === 'verified'
    if (!ownActive) {
      const ownership = await checkOwnership(host, property.workspaceId)
      if (!ownership.ok) return failed(ownership.reason, records, ownership.found)
    }

    const domainChanged = current?.customDomain !== host
    const verified = {
      customDomain: host,
      domainVerificationStatus: 'verified',
      domainVerifiedAt: new Date(),
      // A certificate belongs to the old hostname.
      ...(domainChanged && { sslEnabled: false, sslVerifiedAt: null, sslCertificateId: null, sslProvider: null }),
      // Queue the HTTPS certificate (docker/certbot/custom-domains.sh, within a minute).
      ...((domainChanged || !current?.sslEnabled) && certificateRequest()),
    }
    let settings
    try {
      settings = await prisma.websiteSettings.upsert({
        where: { propertyId: property.id },
        update: verified,
        create: { propertyId: property.id, ...verified },
        select: { id: true },
      })
    } catch (error) {
      // Another site attached it between the check above and this write.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return domainTaken(records)
      throw error
    }

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: property.id,
        action: 'VERIFY_DOMAIN',
        entityType: 'WEBSITE_SETTINGS',
        entityId: settings.id,
        changes: { domain: host, via: routing.via, ownership: ownActive ? 'already-verified' : 'txt' },
      },
    })

    return NextResponse.json({
      success: true,
      data: { status: 'verified', domain: host, records },
      message: 'Tên miền đã được xác minh và gắn với website.',
    })
  } catch (error) {
    console.error('Domain verification error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xác minh domain' }, { status: 500 })
  }
}

type Records = Awaited<ReturnType<typeof expectedRecords>>

/**
 * What the hotel adds at its DNS provider: a CNAME to this site's own
 * <subdomain>.<root> (www.… and other subdomains), or A records to the root
 * domain's addresses (a root domain cannot have a CNAME), plus the TXT.
 * The CNAME is offered only once <subdomain>.<root> resolves: before the
 * wildcard DNS exists (RUNBOOK "Subdomain cho site khách sạn") it would pass
 * the check and lead nowhere.
 */
async function expectedRecords(host: string, target: string, txt: { name: string; value: string }, root: string) {
  const [addresses, targetAddresses] = await Promise.all([
    resolver.resolve4(root).catch(() => [] as string[]),
    resolver.resolve4(target).catch(() => [] as string[]),
  ])
  return {
    cname: { type: 'CNAME', name: host, value: target },
    cnameReady: targetAddresses.length > 0,
    a: addresses.map((ip) => ({ type: 'A', name: host, value: ip })),
    txt: { type: 'TXT', name: txt.name, value: txt.value },
  }
}

const MESSAGES: Record<string, string> = {
  not_found: 'Chưa thấy bản ghi DNS nào cho tên miền này. Thêm các bản ghi theo hướng dẫn bên dưới.',
  wrong_target:
    'Tên miền chưa trỏ đúng về website này: CNAME hoặc bản ghi A phải đúng giá trị bên dưới (xoá các bản ghi A, AAAA hoặc CNAME khác của tên này).',
  txt_missing: 'Tên miền đã trỏ đúng, nhưng chưa thấy bản ghi TXT xác minh chủ sở hữu. Thêm bản ghi TXT bên dưới.',
  txt_wrong: 'Tên miền đã trỏ đúng, nhưng bản ghi TXT xác minh chủ sở hữu có giá trị chưa đúng. Sửa theo giá trị bên dưới.',
  transient: 'Không kiểm tra được DNS lúc này. Vui lòng thử lại sau ít phút.',
}

function failed(reason: string, records: Records, found: string[]) {
  return NextResponse.json(
    { success: false, error: MESSAGES[reason] ?? MESSAGES.transient, data: { status: reason, records, found } },
    { status: reason === 'transient' ? 503 : 422 }
  )
}

function domainTaken(records: Records) {
  return NextResponse.json(
    {
      success: false,
      error:
        'Tên miền này đang được gắn với một website khác trên Digistay. Hãy gỡ nó ở website đó trước, ' +
        'hoặc thêm bản ghi TXT bên dưới rồi liên hệ hỗ trợ.',
      data: { status: 'taken', records },
    },
    { status: 409 }
  )
}
