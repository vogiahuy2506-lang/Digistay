/**
 * What Digistay's operators do to an account (/admin/customers): find it,
 * lock or unlock it, and turn off its two-factor sign-in when the owner lost
 * both the phone and the recovery codes (docs/RUNBOOK.md, "Đặt lại xác thực
 * hai lớp": the person is verified first, by a call to a number known
 * beforehand or a video call; a staff member through their workspace owner).
 *
 * Each is logged like the operator SQL scripts were: ActivityLog with
 * userId = the operator, entityType USER, metadata.by = their email.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { revokeSessions } from '@/lib/auth/session-revocation'
import type { PlatformAdmin } from './guard'

export const VERIFIED_VIA = ['phone', 'video', 'owner'] as const
export type VerifiedVia = (typeof VERIFIED_VIA)[number]

export class AdminActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'AdminActionError'
  }
}

export const USER_NOT_FOUND = 'Không tìm thấy tài khoản người dùng'
export const NOT_AN_OPERATOR_TARGET = 'Không thao tác được trên tài khoản quản trị Digistay'
export const ALREADY_LOCKED = 'Tài khoản đã bị khoá'
export const NOT_LOCKED = 'Tài khoản không bị khoá'
export const NO_TWO_FACTOR = 'Tài khoản này không bật xác thực hai lớp'

const PAGE_SIZE = 25

/** An account as the operator pages list it. */
export const USER_ROW = {
  id: true,
  name: true,
  email: true,
  username: true,
  phone: true,
  role: true,
  emailVerified: true,
  disabledAt: true,
  disabledReason: true,
  createdAt: true,
  twoFactor: { select: { enabledAt: true } },
  _count: { select: { ownedWorkspaces: true, workspaceMembers: true } },
} satisfies Prisma.UserSelect

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_ROW }>

export function userView(user: UserRow) {
  const { twoFactor, _count, ...rest } = user
  return {
    ...rest,
    twoFactor: !!twoFactor?.enabledAt,
    ownedWorkspaces: _count.ownedWorkspaces,
    memberships: _count.workspaceMembers,
  }
}

/** Accounts by email, name, username or phone, newest first; `locked` only the locked ones. */
export async function searchUsers({ q, locked, page = 1, size = PAGE_SIZE }: { q?: string; locked?: boolean; page?: number; size?: number }) {
  const text = q?.trim()
  const where: Prisma.UserWhereInput = {
    ...(locked && { disabledAt: { not: null } }),
    ...(text && {
      OR: [
        { email: { contains: text, mode: 'insensitive' } },
        { name: { contains: text, mode: 'insensitive' } },
        { username: { contains: text, mode: 'insensitive' } },
        { phone: { contains: text } },
      ],
    }),
  }
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, select: USER_ROW, orderBy: { createdAt: 'desc' }, skip: (page - 1) * size, take: size }),
    prisma.user.count({ where }),
  ])
  return { rows: rows.map(userView), total, page, size }
}

/** The account an operator may act on: it exists and is not an operator itself (nor them). */
async function target(admin: PlatformAdmin, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, disabledAt: true, twoFactor: { select: { enabledAt: true } } },
  })
  if (!user) throw new AdminActionError(USER_NOT_FOUND, 404)
  // Operators are managed with SQL (RUNBOOK): one cannot lock another out from here.
  if (user.role === 'SUPER_ADMIN' || user.id === admin.id) throw new AdminActionError(NOT_AN_OPERATOR_TARGET, 403)
  return user
}

const log = (tx: Prisma.TransactionClient, admin: PlatformAdmin, userId: string, action: string, metadata: Prisma.InputJsonObject) =>
  tx.activityLog.create({
    data: { userId: admin.id, action, entityType: 'USER', entityId: userId, metadata: { by: admin.email, ...metadata } },
  })

/**
 * Locks an account: no sign-in of any kind (password, two-factor, Google:
 * src/lib/auth), and its sessions end (session-revocation.ts). The
 * workspaces it owns go on for their staff.
 */
export async function lockUser(admin: PlatformAdmin, userId: string, reason: string, now = new Date()) {
  const user = await target(admin, userId)
  if (user.disabledAt) throw new AdminActionError(ALREADY_LOCKED, 409)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { disabledAt: now, disabledReason: reason } })
    await log(tx, admin, userId, 'USER_LOCKED', { email: user.email, reason })
  })
  await revokeSessions(userId, now.getTime())
}

export async function unlockUser(admin: PlatformAdmin, userId: string, note: string) {
  const user = await target(admin, userId)
  if (!user.disabledAt) throw new AdminActionError(NOT_LOCKED, 409)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { disabledAt: null, disabledReason: null } })
    await log(tx, admin, userId, 'USER_UNLOCKED', { email: user.email, note })
  })
}

/**
 * Turns two-factor sign-in off (docker/sql/reset-two-factor.sql did this by
 * hand): the person signs in with the password alone and may turn it on
 * again. Logged as TWO_FACTOR_RESET_BY_OPERATOR with how they were verified.
 */
export async function resetTwoFactor(admin: PlatformAdmin, userId: string, verifiedVia: VerifiedVia, note: string) {
  const user = await target(admin, userId)
  // A setup never confirmed (enabledAt null) asks for no code: nothing to reset.
  if (!user.twoFactor?.enabledAt) throw new AdminActionError(NO_TWO_FACTOR, 409)
  await prisma.$transaction(async (tx) => {
    await tx.userTwoFactor.deleteMany({ where: { userId } })
    await log(tx, admin, userId, 'TWO_FACTOR_RESET_BY_OPERATOR', { email: user.email, verifiedVia, note })
  })
}
