import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = process.env.ADMIN_USERNAME || 'superadmin'
  const email = process.env.ADMIN_EMAIL || 'superadmin@digistay.vn'
  const password = process.env.ADMIN_PASSWORD || '123456aa'
  const hashedPassword = await bcrypt.hash(password, 12)

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  })

  let user
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        emailVerified: existing.emailVerified ?? new Date(),
        disabledAt: null,
        disabledReason: null,
      },
    })
  } else {
    user = await prisma.user.create({
      data: {
        name: 'Super Admin',
        username,
        email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        emailVerified: new Date(),
      },
    })
  }

  console.log(`✔ Tài khoản Superadmin đã sẵn sàng:`)
  console.log(`- Username: ${user.username}`)
  console.log(`- Email: ${user.email}`)
  console.log(`- Mật khẩu: ${password}`)
  console.log(`- Role: ${user.role}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

