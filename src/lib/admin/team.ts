import { prisma } from '@/lib/db'
import { revokeSessions } from '@/lib/auth/session-revocation'
import type { PlatformAdmin } from './guard'
import { UserRole } from '@prisma/client'

export class AdminTeamError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'AdminTeamError'
  }
}

export interface AdminMemberView {
  id: string
  name: string | null
  email: string
  role: UserRole
  avatar: string | null
  image: string | null
  hasTwoFactor: boolean
  twoFactorEnabledAt: Date | null
  isDisabled: boolean
  disabledAt: Date | null
  disabledReason: string | null
  createdAt: Date
}

export async function listAdminTeam() {
  const members = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      image: true,
      disabledAt: true,
      disabledReason: true,
      createdAt: true,
      twoFactor: {
        select: {
          enabledAt: true,
        },
      },
    },
    orderBy: [
      { role: 'asc' }, // SUPER_ADMIN first
      { createdAt: 'asc' },
    ],
  })

  const formatted: AdminMemberView[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    avatar: m.avatar,
    image: m.image,
    hasTwoFactor: Boolean(m.twoFactor?.enabledAt),
    twoFactorEnabledAt: m.twoFactor?.enabledAt || null,
    isDisabled: Boolean(m.disabledAt),
    disabledAt: m.disabledAt,
    disabledReason: m.disabledReason,
    createdAt: m.createdAt,
  }))

  const totalMembers = formatted.length
  const superAdminCount = formatted.filter((m) => m.role === UserRole.SUPER_ADMIN).length
  const adminCount = formatted.filter((m) => m.role === UserRole.ADMIN).length
  const twoFactorCount = formatted.filter((m) => m.hasTwoFactor).length
  const disabledCount = formatted.filter((m) => m.isDisabled).length

  return {
    members: formatted,
    stats: {
      total: totalMembers,
      superAdmins: superAdminCount,
      admins: adminCount,
      twoFactorRate: totalMembers > 0 ? Math.round((twoFactorCount / totalMembers) * 100) : 0,
      twoFactorCount,
      disabledCount,
    },
  }
}

export async function assignAdminRole(
  operator: PlatformAdmin,
  targetEmail: string,
  newRole: 'SUPER_ADMIN' | 'ADMIN'
) {
  const normalizedEmail = targetEmail.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, role: true },
  })

  if (!user) {
    throw new AdminTeamError(
      'Không tìm thấy người dùng với email này. Người dùng cần đăng ký tài khoản trước khi được phân quyền.',
      404
    )
  }

  if (user.role === newRole) {
    throw new AdminTeamError(`Người dùng này đã có vai trò ${newRole}`, 400)
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: newRole as UserRole },
  })

  try {
    await prisma.activityLog.create({
      data: {
        userId: operator.id,
        action: 'ASSIGN_ADMIN_ROLE',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          by: operator.email,
          targetEmail: user.email,
          previousRole: user.role,
          newRole,
        },
      },
    })
  } catch {
    // Non-fatal
  }

  return updated
}

export async function updateAdminRole(
  operator: PlatformAdmin,
  userId: string,
  newRole: 'SUPER_ADMIN' | 'ADMIN'
) {
  if (operator.id === userId) {
    throw new AdminTeamError('Không thể tự thay đổi vai trò của chính mình', 400)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  })

  if (!user) {
    throw new AdminTeamError('Không tìm thấy tài khoản quản trị viên', 404)
  }

  // Prevent demoting last SUPER_ADMIN
  if (user.role === UserRole.SUPER_ADMIN && newRole !== 'SUPER_ADMIN') {
    const activeSuperAdmins = await prisma.user.count({
      where: { role: UserRole.SUPER_ADMIN, disabledAt: null },
    })
    if (activeSuperAdmins <= 1) {
      throw new AdminTeamError('Không thể hạ quyền Super Admin duy nhất của hệ thống', 400)
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole as UserRole },
  })

  try {
    await prisma.activityLog.create({
      data: {
        userId: operator.id,
        action: 'UPDATE_ADMIN_ROLE',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          by: operator.email,
          targetEmail: user.email,
          previousRole: user.role,
          newRole,
        },
      },
    })
  } catch {
    // Non-fatal
  }

  return updated
}

export async function toggleAdminDisabled(
  operator: PlatformAdmin,
  userId: string,
  disabled: boolean,
  reason?: string
) {
  if (operator.id === userId) {
    throw new AdminTeamError('Không thể tự khóa tài khoản của chính mình', 400)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, disabledAt: true },
  })

  if (!user) {
    throw new AdminTeamError('Không tìm thấy tài khoản quản trị viên', 404)
  }

  if (disabled && user.role === UserRole.SUPER_ADMIN) {
    const activeSuperAdmins = await prisma.user.count({
      where: { role: UserRole.SUPER_ADMIN, disabledAt: null, id: { not: userId } },
    })
    if (activeSuperAdmins === 0) {
      throw new AdminTeamError('Không thể khóa Super Admin duy nhất còn hoạt động', 400)
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      disabledAt: disabled ? new Date() : null,
      disabledReason: disabled ? reason || 'Khóa bởi Super Admin' : null,
    },
  })

  if (disabled) {
    await revokeSessions(userId, Date.now()).catch(() => {})
  }

  try {
    await prisma.activityLog.create({
      data: {
        userId: operator.id,
        action: disabled ? 'DISABLE_ADMIN' : 'ENABLE_ADMIN',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          by: operator.email,
          targetEmail: user.email,
          reason,
        },
      },
    })
  } catch {
    // Non-fatal
  }

  return updated
}

export async function revokeAdminRole(operator: PlatformAdmin, userId: string) {
  if (operator.id === userId) {
    throw new AdminTeamError('Không thể tự thu hồi quyền của chính mình', 400)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  })

  if (!user) {
    throw new AdminTeamError('Không tìm thấy tài khoản quản trị viên', 404)
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    const activeSuperAdmins = await prisma.user.count({
      where: { role: UserRole.SUPER_ADMIN, disabledAt: null, id: { not: userId } },
    })
    if (activeSuperAdmins === 0) {
      throw new AdminTeamError('Không thể thu hồi quyền Super Admin duy nhất của hệ thống', 400)
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: UserRole.USER },
  })

  await revokeSessions(userId, Date.now()).catch(() => {})

  try {
    await prisma.activityLog.create({
      data: {
        userId: operator.id,
        action: 'REVOKE_ADMIN_ROLE',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          by: operator.email,
          targetEmail: user.email,
          previousRole: user.role,
        },
      },
    })
  } catch {
    // Non-fatal
  }

  return updated
}

export async function resetAdminTwoFactor(
  operator: PlatformAdmin,
  userId: string,
  reason: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      twoFactor: { select: { enabledAt: true } },
    },
  })

  if (!user) {
    throw new AdminTeamError('Không tìm thấy tài khoản', 404)
  }

  if (!user.twoFactor?.enabledAt) {
    throw new AdminTeamError('Tài khoản này chưa kích hoạt 2FA', 400)
  }

  await prisma.userTwoFactor.deleteMany({
    where: { userId },
  })

  try {
    await prisma.activityLog.create({
      data: {
        userId: operator.id,
        action: 'RESET_ADMIN_2FA',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          by: operator.email,
          targetEmail: user.email,
          reason,
        },
      },
    })
  } catch {
    // Non-fatal
  }
}

