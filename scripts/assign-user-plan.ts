/**
 * CLI script to assign a subscription plan to a user and synchronize it across
 * all workspaces owned by that user.
 *
 * Usage:
 *   npx tsx scripts/assign-user-plan.ts <username_or_email> [starter|growth|business] [1y|6m|3m|30d] [--trial]
 *
 * Example:
 *   npx tsx scripts/assign-user-plan.ts nhphuc growth 1y
 *   npx tsx scripts/assign-user-plan.ts superadmin business 1y
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { isPlanId, type PlanId } from '../src/lib/marketing/plans'
import { generateSlug } from '../src/lib/utils'
import { defaultWorkspaceName } from '../src/lib/auth/default-workspace'
import { ensureSubscription } from '../src/lib/billing/subscription'

const prisma = new PrismaClient()

const DAY_MS = 24 * 60 * 60 * 1000

function parseDuration(durationStr = '1y'): number {
  const match = durationStr.match(/^(\d+)([dmy])$/i)
  if (!match) return 365 * DAY_MS
  const count = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()
  switch (unit) {
    case 'd':
      return count * DAY_MS
    case 'm':
      return count * 30 * DAY_MS
    case 'y':
      return count * 365 * DAY_MS
    default:
      return 365 * DAY_MS
  }
}

async function main() {
  const args = process.argv.slice(2)
  const targetUser = args[0]
  const planArg = args[1]?.toLowerCase() || 'growth'
  const durationArg = args[2] || '1y'
  const isTrial = args.includes('--trial')

  if (!targetUser) {
    console.error('Cách dùng: npx tsx scripts/assign-user-plan.ts <username_hoặc_email> [starter|growth|business] [1y|6m|30d] [--trial]')
    process.exit(1)
  }

  if (!isPlanId(planArg)) {
    console.error(`Gói không hợp lệ: "${planArg}". Các gói hợp lệ: starter, growth, business`)
    process.exit(1)
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: targetUser },
        { email: targetUser },
        { email: { equals: targetUser, mode: 'insensitive' } },
      ],
    },
    include: {
      ownedWorkspaces: {
        where: { deletedAt: null },
      },
    },
  })

  if (!user) {
    console.error(`Không tìm thấy người dùng: "${targetUser}"`)
    process.exit(1)
  }

  const now = new Date()
  const durationMs = parseDuration(durationArg)
  const periodEnd = new Date(now.getTime() + durationMs)

  console.log(`Đang gán gói cho người dùng: ${user.name} (${user.email})`)
  console.log(`Gói: ${planArg.toUpperCase()} | Loại: ${isTrial ? 'Dùng thử (Trial)' : 'Trả phí (Paid)'}`)
  console.log(`Thời hạn: Đến ngày ${periodEnd.toISOString().slice(0, 10)}`)

  let workspaces = user.ownedWorkspaces

  if (workspaces.length === 0) {
    console.log('Người dùng chưa có workspace nào. Đang tạo workspace mặc định...')
    const baseSlug = generateSlug(`${user.username || user.name || 'user'}-workspace`) || 'workspace'
    let slug = baseSlug
    let counter = 1
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`
    }

    const created = await prisma.workspace.create({
      data: {
        name: defaultWorkspaceName(user.name || user.email),
        slug,
        ownerId: user.id,
        description: 'Không gian làm việc mặc định',
        subscription: {
          create: {
            plan: planArg,
            trial: isTrial,
            billing: isTrial ? null : 'MONTH',
            periodStart: now,
            periodEnd,
          },
        },
      },
    })
    console.log(`✓ Đã tạo workspace mặc định: ${created.name} (${created.slug})`)
  } else {
    for (const ws of workspaces) {
      await prisma.$transaction(async (tx) => {
        const sub = await ensureSubscription(ws.id, tx, now)
        await tx.subscription.update({
          where: { workspaceId: ws.id },
          data: {
            plan: planArg,
            trial: isTrial,
            billing: isTrial ? sub.billing : (sub.billing ?? 'MONTH'),
            periodStart: now,
            periodEnd,
            reminders: Prisma.DbNull,
          },
        })
      })
      console.log(`✓ Đã cập nhật gói cho workspace: ${ws.name} (${ws.slug})`)
    }
  }

  console.log('🎉 Hoàn tất gán gói cho người dùng thành công!')
}

main()
  .catch((e) => {
    console.error('Lỗi thực hiện:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
