/**
 * CLI script to safely inspect and clean up test workspaces (e.g. QA B, QA Test, "ád"...).
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-workspaces.ts           # Dry-run: lists test workspaces found
 *   npx tsx scripts/cleanup-test-workspaces.ts --confirm # Actually deletes identified test workspaces
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEST_NAME_PATTERNS = [
  /^(qa\s*|test\s*|ád|asdf|demo\s*test|hotel\s*test)/i,
  /\b(test|testing|thử nghiệm)\b/i,
  /^(ád|asd|test\d+|demo\d+)$/i,
]

async function main() {
  const args = process.argv.slice(2)
  const isConfirmed = args.includes('--confirm')

  console.log('='.repeat(60))
  console.log('  DIGISTAY: Dọn dẹp Workspace thử nghiệm / rác (Task 50)')
  console.log('='.repeat(60))

  const workspaces = await prisma.workspace.findMany({
    where: { deletedAt: null },
    include: {
      owner: { select: { email: true, name: true } },
      properties: { select: { id: true, name: true } },
      subscription: true,
      subscriptionPayments: {
        where: { status: 'PAID' },
        select: { id: true, orderCode: true, amount: true },
      },
      _count: {
        select: { properties: true, members: true },
      },
    },
  })

  const candidates: typeof workspaces = []

  for (const ws of workspaces) {
    // Check if name or slug matches test patterns
    const nameMatches = TEST_NAME_PATTERNS.some((p) => p.test(ws.name.trim()))
    const slugMatches = TEST_NAME_PATTERNS.some((p) => p.test(ws.slug.trim()))

    if (nameMatches || slugMatches) {
      // SAFEGUARD 1: Do not touch workspaces that have real paid subscription payments
      if (ws.subscriptionPayments.length > 0) {
        console.log(`[BỎ QUA - AN TOÀN] Workspace "${ws.name}" (${ws.slug}) đã có ${ws.subscriptionPayments.length} thanh toán thực tế!`)
        continue
      }

      // SAFEGUARD 2: Do not touch primary system accounts (nhphuc@digiso.vn, superadmin)
      if (ws.owner.email.includes('digiso.vn') && !ws.name.toLowerCase().includes('qa') && !ws.name.toLowerCase().includes('test')) {
        continue
      }

      candidates.push(ws)
    }
  }

  console.log(`\nTìm thấy ${candidates.length} workspace thử nghiệm ứng viên:\n`)

  for (const c of candidates) {
    console.log(`- ID: ${c.id}`)
    console.log(`  Tên: "${c.name}" | Slug: "${c.slug}"`)
    console.log(`  Chủ sở hữu: ${c.owner.name || '—'} (${c.owner.email})`)
    console.log(`  Số cơ sở: ${c._count.properties} | Số nhân viên: ${c._count.members}`)
    console.log(`  Gói: ${c.subscription?.plan || 'trial'} | Thanh toán thật: 0`)
    console.log('-'.repeat(40))
  }

  if (candidates.length === 0) {
    console.log('Hệ thống sạch, không có workspace rác nào cần dọn dẹp.')
    return
  }

  if (!isConfirmed) {
    console.log('\n⚠️  ĐANG Ở CHẾ ĐỘ XEM TRƯỚC (DRY-RUN). Chưa có dữ liệu nào bị xóa.')
    console.log('Để thực hiện xóa mềm các workspace này, chạy lại lệnh với cờ --confirm:')
    console.log('   npx tsx scripts/cleanup-test-workspaces.ts --confirm\n')
    return
  }

  console.log('\n⏳ Đang tiến hành xóa mềm các workspace thử nghiệm...')

  const now = new Date()
  let deletedCount = 0

  for (const c of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        // Soft delete properties
        await tx.property.updateMany({
          where: { workspaceId: c.id, deletedAt: null },
          data: { deletedAt: now },
        })

        // Soft delete workspace
        await tx.workspace.update({
          where: { id: c.id },
          data: { deletedAt: now },
        })
      })

      deletedCount++
      console.log(`  ✓ Đã xóa workspace: "${c.name}" (${c.slug})`)
    } catch (err) {
      console.error(`  ✗ Lỗi khi xóa "${c.name}":`, (err as Error).message)
    }
  }

  console.log(`\nHoàn tất! Đã dọn dẹp ${deletedCount}/${candidates.length} workspace thử nghiệm.`)
}

main()
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

