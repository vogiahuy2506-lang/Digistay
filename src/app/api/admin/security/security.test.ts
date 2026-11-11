import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/admin/guard', () => ({
  requirePlatformAdmin: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    ipBlacklist: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    reservedSubdomain: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}))

import { requirePlatformAdmin } from '@/lib/admin/guard'
import { prisma } from '@/lib/db'
import { GET as getBlacklist, POST as postBlacklist } from './ip-blacklist/route'
import { PATCH as patchBlacklist, DELETE as deleteBlacklist } from './ip-blacklist/[id]/route'
import { GET as getSubdomains, POST as postSubdomain } from './reserved-subdomains/route'
import { DELETE as deleteSubdomain } from './reserved-subdomains/[id]/route'

describe('Admin Security & Firewall APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      ok: true,
      admin: { id: 'admin-1', email: 'admin@digistay.vn', role: 'SUPER_ADMIN' } as any,
    })
  })

  describe('IP Blacklist', () => {
    it('GET returns list of blacklisted IPs', async () => {
      vi.mocked(prisma.ipBlacklist.findMany).mockResolvedValueOnce([
        {
          id: 'ip-1',
          ipAddress: '1.2.3.4',
          reason: 'DDoS attempt',
          attemptCount: 15,
          expiresAt: null,
          isActive: true,
          createdById: 'admin-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any)

      const res = await getBlacklist()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].ipAddress).toBe('1.2.3.4')
    })

    it('POST blocks an IP address', async () => {
      vi.mocked(prisma.ipBlacklist.upsert).mockResolvedValueOnce({
        id: 'ip-1',
        ipAddress: '1.2.3.4',
        reason: 'Bot scanning',
        attemptCount: 1,
        expiresAt: null,
        isActive: true,
        createdById: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const req = new NextRequest('http://localhost/api/admin/security/ip-blacklist', {
        method: 'POST',
        body: JSON.stringify({
          ipAddress: '1.2.3.4',
          reason: 'Bot scanning',
        }),
      })

      const res = await postBlacklist(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.ipAddress).toBe('1.2.3.4')
    })

    it('PATCH updates active status of blocked IP', async () => {
      vi.mocked(prisma.ipBlacklist.update).mockResolvedValueOnce({
        id: 'ip-1',
        ipAddress: '1.2.3.4',
        reason: 'Bot',
        attemptCount: 1,
        expiresAt: null,
        isActive: false,
        createdById: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const req = new NextRequest('http://localhost/api/admin/security/ip-blacklist/ip-1', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      })

      const res = await patchBlacklist(req, { params: Promise.resolve({ id: 'ip-1' }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.isActive).toBe(false)
    })

    it('DELETE removes IP from blacklist', async () => {
      vi.mocked(prisma.ipBlacklist.delete).mockResolvedValueOnce({
        id: 'ip-1',
        ipAddress: '1.2.3.4',
      } as any)

      const req = new NextRequest('http://localhost/api/admin/security/ip-blacklist/ip-1', {
        method: 'DELETE',
      })

      const res = await deleteBlacklist(req, { params: Promise.resolve({ id: 'ip-1' }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.message).toContain('1.2.3.4')
    })
  })

  describe('Reserved Subdomains', () => {
    it('GET returns static and custom reserved subdomains', async () => {
      vi.mocked(prisma.reservedSubdomain.findMany).mockResolvedValueOnce([
        {
          id: 'sub-1',
          subdomain: 'payment',
          reason: 'Payment gateway reservation',
          createdAt: new Date(),
        },
      ] as any)

      const res = await getSubdomains()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.staticReserved).toContain('admin')
      expect(json.data.customReserved).toHaveLength(1)
    })

    it('POST rejects reserved subdomain if in static list', async () => {
      const req = new NextRequest('http://localhost/api/admin/security/reserved-subdomains', {
        method: 'POST',
        body: JSON.stringify({
          subdomain: 'admin',
          reason: 'Test',
        }),
      })

      const res = await postSubdomain(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('mặc định')
    })

    it('POST adds new custom reserved subdomain', async () => {
      vi.mocked(prisma.reservedSubdomain.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.reservedSubdomain.create).mockResolvedValueOnce({
        id: 'sub-new',
        subdomain: 'supervip',
        reason: 'Hold for VIP hotels',
        createdAt: new Date(),
      } as any)

      const req = new NextRequest('http://localhost/api/admin/security/reserved-subdomains', {
        method: 'POST',
        body: JSON.stringify({
          subdomain: 'supervip',
          reason: 'Hold for VIP hotels',
        }),
      })

      const res = await postSubdomain(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.subdomain).toBe('supervip')
    })

    it('DELETE removes custom reserved subdomain', async () => {
      vi.mocked(prisma.reservedSubdomain.delete).mockResolvedValueOnce({
        id: 'sub-new',
        subdomain: 'supervip',
      } as any)

      const req = new NextRequest('http://localhost/api/admin/security/reserved-subdomains/sub-new', {
        method: 'DELETE',
      })

      const res = await deleteSubdomain(req, { params: Promise.resolve({ id: 'sub-new' }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.message).toContain('supervip')
    })
  })
})

