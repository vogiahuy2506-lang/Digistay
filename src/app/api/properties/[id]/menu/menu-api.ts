/**
 * Shared by the restaurant menu routes (route.ts, [itemId]/route.ts): who
 * may read or change a hotel's menu, and a dish's fields.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { translationsInput } from '@/lib/i18n/translations-input'
import { isMenuImageUrl } from '@/lib/menu/menu'
import { lockedResponse } from '@/lib/billing/guard'

/** A hotel's menu stays a menu, not a store: more than this is refused. */
export const MAX_MENU_ITEMS = 500

const fail = (status: number, error: string) => ({ ok: false as const, response: NextResponse.json({ success: false, error }, { status }) })

/**
 * Every member of the hotel's workspace reads the menu; the owner, ADMIN and
 * MANAGER change it (as the services they sit next to). Someone outside the
 * workspace gets 404: the hotel's id is not confirmed to exist. A change
 * while the workspace is locked gets 402 (src/lib/billing).
 */
export async function menuAccess(propertyId: string, userId: string, write: boolean) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  const role = property ? await getWorkspaceRole(property.workspaceId, userId) : null
  if (!property || !role) return fail(404, 'Không tìm thấy khách sạn')
  if (write && !(WorkspaceRoles.ADMINS_AND_MANAGERS as readonly string[]).includes(role)) {
    return fail(403, 'Bạn không có quyền thực hiện hành động này')
  }
  if (write) {
    const locked = await lockedResponse(property.workspaceId)
    if (locked) return { ok: false as const, response: locked }
  }
  return { ok: true as const }
}

/** Optional text: trimmed, and blank stored as null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null))

const fields = {
  name: z
    .string({ required_error: 'Nhập tên món', invalid_type_error: 'Nhập tên món' })
    .trim()
    .min(1, 'Nhập tên món')
    .max(120, 'Tên món tối đa 120 ký tự'),
  description: optionalText(1000, 'Mô tả món tối đa 1000 ký tự'),
  category: optionalText(60, 'Tên nhóm món tối đa 60 ký tự'),
  price: z
    .number({ required_error: 'Giá món không hợp lệ', invalid_type_error: 'Giá món không hợp lệ' })
    .finite('Giá món không hợp lệ')
    .min(0, 'Giá món không được âm')
    .max(1_000_000_000, 'Giá món không hợp lệ'),
  imageUrl: optionalText(2048, 'Ảnh món phải là liên kết http(s) hoặc ảnh đã tải lên').refine(
    (v) => v == null || isMenuImageUrl(v),
    'Ảnh món phải là liên kết http(s) hoặc ảnh đã tải lên'
  ),
  isAvailable: z.boolean().optional(),
  translations: translationsInput(['name', 'description', 'category'], 1000),
}

export const createMenuItemSchema = z.object(fields)
export const updateMenuItemSchema = z.object({ ...fields, name: fields.name.optional(), price: fields.price.optional() })
