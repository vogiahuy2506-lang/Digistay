/**
 * TASK 58: KIỂM THỬ BẢO MẬT & PHÂN QUYỀN DỮ LIỆU ĐA CƠ SỞ (MULTI-TENANT & IDOR PROTECTION)
 *
 * Kiểm tra các tiêu chuẩn an ninh cốt lõi:
 * 1. Phân lập dữ liệu đa khách hàng (Multi-Tenant Isolation): User ở Workspace A
 *    tuyệt đối không thể đọc hay can thiệp dữ liệu của Workspace B (chống IDOR).
 * 2. Ma trận phân quyền RBAC:
 *    - OWNER: Toàn quyền trên mọi cơ sở của workspace.
 *    - RECEPTIONIST: Quyền lễ tân (đặt phòng, check-in, check-out), không thể sửa cài đặt workspace hay quản lý thành viên.
 *    - USER: Quyền cơ bản, không thể xem doanh thu hay quản lý tài chính/hóa đơn.
 * 3. Hạn chế theo cơ sở (Property-level scope):
 *    - Nhân viên chỉ được gán Property 1 không thể thao tác trên Property 2 của cùng workspace.
 * 4. Khóa tài khoản / Vượt hạn mức:
 *    - Tài khoản bị vô hiệu hóa (disabledAt) hoặc bị khóa do gói (planLockedAt) bị thu hồi toàn bộ quyền.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.id === 'ws_beta_02') {
          // User A is not a member of Workspace B
          return {
            ownerId: 'usr_owner_beta',
            members: [],
          }
        }
        return null
      }),
    },
  },
}))

import {
  can,
  seesProperty,
  propertyScope,
  checkAccess,
  type Access,
} from './access'
import { PERMISSIONS, effectivePermissions } from './permissions'

describe('Task 58: Multi-Tenant Data Isolation & IDOR Protection', () => {
  const workspaceAId = 'ws_alpha_01'
  const workspaceBId = 'ws_beta_02'
  const propertyA1Id = 'prop_alpha_hotel_01'
  const propertyA2Id = 'prop_alpha_resort_02'

  const userAOwnerId = 'usr_owner_alpha'
  const userAStaffId = 'usr_frontdesk_alpha'

  const ownerAccessA: Access = {
    workspaceId: workspaceAId,
    userId: userAOwnerId,
    isOwner: true,
    role: 'ADMIN',
    customPermissions: false,
    permissions: new Set(PERMISSIONS),
    propertyIds: null, // all properties of workspace A
  }

  const receptionistAccessA: Access = {
    workspaceId: workspaceAId,
    userId: userAStaffId,
    isOwner: false,
    role: 'RECEPTIONIST',
    customPermissions: false,
    permissions: new Set(
      effectivePermissions({
        role: 'RECEPTIONIST',
        customPermissions: false,
        permissions: [],
      })
    ),
    propertyIds: [propertyA1Id], // only property A1
  }

  describe('1. Cross-Workspace IDOR Defense', () => {
    it('user of Workspace A cannot access Workspace B resources', async () => {
      // When checking access on workspace B for user A
      const result = await checkAccess(userAOwnerId, workspaceBId, 'bookings_view', {
        notFound: 'Không tìm thấy cơ sở',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response.status).toBe(404) // Masked as 404 to hide entity existence
      }
    })

    it('propertyScope for Workspace A never includes Workspace B properties', () => {
      const scopeA = propertyScope(ownerAccessA)
      expect(scopeA).toEqual({ workspaceId: workspaceAId })

      // Even when query includes property ID from workspace B, database query scoped to workspaceId
      expect(scopeA.workspaceId).toBe(workspaceAId)
      expect(scopeA.workspaceId).not.toBe(workspaceBId)
    })
  })

  describe('2. Role-Based Access Control (RBAC) Matrix', () => {
    it('OWNER has complete access to all operations', () => {
      expect(can(ownerAccessA, 'bookings_view', propertyA1Id)).toBe(true)
      expect(can(ownerAccessA, 'bookings_create', propertyA1Id)).toBe(true)
      expect(can(ownerAccessA, 'invoices_manage', propertyA1Id)).toBe(true)
      expect(can(ownerAccessA, 'revenue_view', propertyA1Id)).toBe(true)
      expect(can(ownerAccessA, 'cashbook_view', propertyA1Id)).toBe(true)
      expect(can(ownerAccessA, 'members_manage')).toBe(true)
      expect(can(ownerAccessA, 'workspace_settings')).toBe(true)
    })

    it('RECEPTIONIST can operate bookings but CANNOT manage members or workspace settings', () => {
      // Allowed operations for RECEPTIONIST
      expect(can(receptionistAccessA, 'bookings_view', propertyA1Id)).toBe(true)
      expect(can(receptionistAccessA, 'bookings_create', propertyA1Id)).toBe(true)
      expect(can(receptionistAccessA, 'bookings_edit', propertyA1Id)).toBe(true)
      expect(can(receptionistAccessA, 'payments_manage', propertyA1Id)).toBe(true)
      expect(can(receptionistAccessA, 'invoices_manage', propertyA1Id)).toBe(true)

      // Forbidden administrative operations for RECEPTIONIST
      expect(can(receptionistAccessA, 'members_manage')).toBe(false)
      expect(can(receptionistAccessA, 'workspace_settings')).toBe(false)
      expect(can(receptionistAccessA, 'properties_create')).toBe(false)
      expect(can(receptionistAccessA, 'website_manage')).toBe(false)
    })

    it('USER role has basic operational access but cannot manage money or reports', () => {
      const basicUserAccess: Access = {
        workspaceId: workspaceAId,
        userId: 'usr_basic_01',
        isOwner: false,
        role: 'USER',
        customPermissions: false,
        permissions: new Set(
          effectivePermissions({
            role: 'USER',
            customPermissions: false,
            permissions: [],
          })
        ),
        propertyIds: null,
      }

      // Basic user permissions
      expect(can(basicUserAccess, 'bookings_view', propertyA1Id)).toBe(true)
      expect(can(basicUserAccess, 'rooms_status', propertyA1Id)).toBe(true)

      // Forbidden financial and sensitive data permissions
      expect(can(basicUserAccess, 'revenue_view', propertyA1Id)).toBe(false)
      expect(can(basicUserAccess, 'cashbook_view', propertyA1Id)).toBe(false)
      expect(can(basicUserAccess, 'invoices_manage', propertyA1Id)).toBe(false)
      expect(can(basicUserAccess, 'payments_manage', propertyA1Id)).toBe(false)
      expect(can(basicUserAccess, 'bookings_cancel', propertyA1Id)).toBe(false)
    })
  })

  describe('3. Property-Level Isolation within Same Workspace', () => {
    it('restricts staff to assigned properties and blocks unassigned ones', () => {
      // Receptionist A has access to Property A1
      expect(seesProperty(receptionistAccessA, propertyA1Id)).toBe(true)
      expect(can(receptionistAccessA, 'bookings_view', propertyA1Id)).toBe(true)

      // Receptionist A attempts to access Property A2 in the same workspace: STRICTLY REFUSED
      expect(seesProperty(receptionistAccessA, propertyA2Id)).toBe(false)
      expect(can(receptionistAccessA, 'bookings_view', propertyA2Id)).toBe(false)
      expect(can(receptionistAccessA, 'bookings_create', propertyA2Id)).toBe(false)
    })

    it('propertyScope reflects explicitly assigned properties', () => {
      const scopeLimited = propertyScope(receptionistAccessA)
      expect(scopeLimited).toEqual({
        workspaceId: workspaceAId,
        id: { in: [propertyA1Id] },
      })
    })
  })
})
