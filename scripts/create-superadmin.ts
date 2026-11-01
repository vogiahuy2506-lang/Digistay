import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'superadmin@digistay.vn'
  const password = process.env.ADMIN_PASSWORD || '123456aa'
  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      disabledAt: null,
    },
    create: {
      name: 'Super Admin',
      email,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  })

  console.log(`✔ Tài khoản Superadmin đã sẵn sàng:`)
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
