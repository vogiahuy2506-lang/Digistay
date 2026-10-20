/**
 * Fresh data for every browser-test run: empties the e2e database, runs the
 * normal seed (demo workspace and hotel), then adds the test users and
 * bookings and writes their ids to e2e/.state/ids.json.
 *
 * Refuses any database whose name does not end in _e2e: this truncates
 * every table.
 */
import { execSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { E2E, type E2EIds } from './env'

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? ''
  const name = new URL(url).pathname.replace(/^\//, '')
  if (!name.endsWith('_e2e')) throw new Error(`e2e: DATABASE_URL must name a database ending in _e2e (got "${name}")`)

  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
    if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`)
    execSync('npx tsx prisma/seed.ts', { stdio: 'ignore', env: process.env })

    const password = await bcrypt.hash(E2E.password, 10)
    const verified = { emailVerified: new Date(), password }
    await prisma.user.update({ where: { email: E2E.users.admin.email }, data: { username: E2E.users.admin.username, ...verified } })
    await prisma.user.create({ data: { email: E2E.users.twoFactor.email, username: E2E.users.twoFactor.username, name: 'E2E Hai Lớp', ...verified } })
    const root = await prisma.user.create({
      data: { email: E2E.users.root.email, username: E2E.users.root.username, name: 'E2E Root', role: 'SUPER_ADMIN', ...verified },
    })

    const workspace = await prisma.workspace.findFirstOrThrow({ where: { slug: 'demo-workspace' } })
    const property = await prisma.property.findFirstOrThrow({ where: { subdomain: 'khach-san-demo' } })
    await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: root.id, role: 'ADMIN' } })

    const booking = (code: string, totalAmount: number, status: 'CONFIRMED' | 'CHECKED_OUT', extra = {}) =>
      prisma.booking.create({
        data: {
          bookingCode: code,
          propertyId: property.id,
          guestName: 'Trần Thị Bình',
          guestEmail: 'binh@example.com',
          guestPhone: '0900000001',
          checkInDate: new Date('2026-12-01T07:00:00Z'),
          checkOutDate: new Date('2026-12-03T05:00:00Z'),
          subtotal: totalAmount,
          totalAmount,
          status,
          ...extra,
        },
      })
    const ids: E2EIds = {
      ws: workspace.slug,
      prop: property.id,
      subdomain: property.subdomain,
      payosBooking: (await booking('DSE2EPAYOS', 1_000_000, 'CONFIRMED')).id,
      invoiceBooking: (await booking('DSE2EADJ', 2_160_000, 'CHECKED_OUT')).id,
      autoBooking: (
        await booking('DSE2EAUTO', 1_080_000, 'CONFIRMED', {
          vatCompany: 'Công ty CP Lữ Hành Mai',
          vatTaxCode: '0301112223',
          vatAddress: '5 Hai Bà Trưng, Hà Nội',
          vatEmail: 'hoadon@mai.vn',
        })
      ).id,
    }
    mkdirSync(dirname(E2E.idsFile), { recursive: true })
    writeFileSync(E2E.idsFile, JSON.stringify(ids, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}
