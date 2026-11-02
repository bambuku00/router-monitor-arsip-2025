import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT } from '@/app/api/user/[id]/route'
import prisma from '@/lib/prisma'
import { validateRequest } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { hasRole, canManageUserAccount } from "@/lib/rbac";
import type { User, Session } from 'lucia'
import type { User as PrismaUser } from '@prisma/client'
import type { MockAuthUser, MockSession, MockPrismaUser, MockNextRequest } from './mocks'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    router: {
      findUnique: vi.fn(),
    },
    portalBersama: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    portalBersamaMitra: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('argon2', () => ({
  hash: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  validateRequest: vi.fn(),
  lucia: {
    invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue({ id: 'new-session' }),
    createSessionCookie: vi.fn().mockReturnValue({
      name: 'session',
      value: 'cookie',
      attributes: {},
    }),
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
  })),
}))

vi.mock('@/lib/rbac', () => ({
  hasRole: vi.fn(),
  canManageUserAccount: vi.fn().mockResolvedValue(true),
  canAdminDeleteOwnStaff: vi.fn(),
}))

vi.mock('@/lib/staff-menu-api', () => ({
  staffMenuApiForbidden: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/server-actions/api', () => ({
  errorApiResponse: vi.fn((err) => ({
    status: 500,
    json: () => Promise.resolve({ error: err.message }),
  })),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200,
    })),
  },
}))

describe('User Edit API (PUT /api/user/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(canManageUserAccount).mockResolvedValue(true)
  })

  const mockParams = { params: Promise.resolve({ id: '2' }) }

  it('should update omset to 0 successfully', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Superadmin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(true)

    const mockDbUser: MockPrismaUser = { id: 2, user: 'target_user' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as PrismaUser)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const requestData = {
      nama: 'Target User',
      user: 'target_user',
      omset: 0,
      role: 'Admin',
      parentId: null
    }

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue(requestData),
    }

    await PUT(request as NextRequest, mockParams)

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 2 },
      data: expect.objectContaining({
        omset: 0
      })
    }))
  })

  it('should update omset to 10 successfully', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Superadmin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(true)
    const mockDbUser: MockPrismaUser = { id: 2, user: 'target_user' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as PrismaUser)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const requestData = {
      nama: 'Target User',
      user: 'target_user',
      omset: 10,
      role: 'Admin',
      parentId: null
    }

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue(requestData),
    }

    await PUT(request as NextRequest, mockParams)

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 2 },
      data: expect.objectContaining({
        omset: 10
      })
    }))
  })

  it('should update ppn successfully', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Superadmin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(true)
    const mockDbUser: MockPrismaUser = { id: 2, user: 'target_user' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as PrismaUser)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const requestData = {
      nama: 'Target User',
      user: 'target_user',
      ppn: 12.5,
      role: 'Admin',
      parentId: null
    }

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue(requestData),
    }

    await PUT(request as NextRequest, mockParams)
    
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 2 },
      data: expect.objectContaining({
        ppn: 12.5
      })
    }))
  })

  it('C3 regression: returns 403 and never touches DB when canManageUserAccount denies (e.g. staff -> parent)', async () => {
    const mockUser: MockAuthUser = { id: 5, role: 'Teknisi' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(canManageUserAccount).mockResolvedValue(false)

    const requestData = {
      nama: 'Parent Admin',
      user: 'parent_admin',
      password: 'newpassword123',
    }

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue(requestData),
    }

    const res = await PUT(request as NextRequest, mockParams)

    expect(canManageUserAccount).toHaveBeenCalledWith(mockUser, 2)
    expect(res.status).toBe(403)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('returns 403 when Admin tries to set pppAutoFillEnabled', async () => {
    const mockUser: MockAuthUser = { id: 10, role: 'Admin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(false)

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: 'Mitra',
        user: 'mitra',
        pppAutoFillEnabled: true,
      }),
    }

    const res = await PUT(request as NextRequest, mockParams)

    expect(res.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('allows Superadmin to set pppAutoFillEnabled on Admin mitra', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Superadmin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(true)

    const mockDbUser: MockPrismaUser = { id: 2, user: 'mitra', role: 'Admin' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as PrismaUser)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...mockDbUser,
      pppAutoFillEnabled: true,
    } as PrismaUser)

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: 'Mitra',
        user: 'mitra',
        role: 'Admin',
        pppAutoFillEnabled: true,
      }),
    }

    await PUT(request as NextRequest, mockParams)

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 2 },
      data: expect.objectContaining({
        pppAutoFillEnabled: true,
      }),
    }))
  })

  it('returns 403 when Admin tries to set portalPelangganEnabled', async () => {
    const mockUser: MockAuthUser = { id: 10, role: 'Admin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(false)

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: 'Mitra',
        user: 'mitra',
        portalPelangganEnabled: true,
      }),
    }

    const res = await PUT(request as NextRequest, mockParams)

    expect(res.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('allows Superadmin to set portalPelangganEnabled on Admin mitra', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Superadmin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(true)

    const mockDbUser: MockPrismaUser = { id: 2, user: 'mitra', role: 'Admin' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as PrismaUser)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...mockDbUser,
      portalPelangganEnabled: true,
    } as PrismaUser)

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: 'Mitra',
        user: 'mitra',
        role: 'Admin',
        portalPelangganEnabled: true,
        portalSlug: 'mitra-demo',
      }),
    }

    await PUT(request as NextRequest, mockParams)

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 2 },
      data: expect.objectContaining({
        portalPelangganEnabled: true,
        portalSlug: 'mitra-demo',
      }),
    }))
  })

  it('allows Admin to set their own portal link', async () => {
    const mockUser: MockAuthUser = { id: 2, role: 'Admin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(false)

    const mockDbUser: MockPrismaUser = { id: 2, user: 'mitra', role: 'Admin' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as PrismaUser)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...mockDbUser,
      portalPelangganEnabled: true,
      portalSlug: 'milik-saya',
    } as PrismaUser)

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: 'Mitra',
        user: 'mitra',
        role: 'Admin',
        portalPelangganEnabled: true,
        portalSlug: 'Milik-Saya',
      }),
    }

    const res = await PUT(request as NextRequest, mockParams)

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 2 },
      data: expect.objectContaining({
        portalPelangganEnabled: true,
        portalSlug: 'milik-saya',
      }),
    }))
  })

  it('blocks Admin portal changes while a combined link is enabled', async () => {
    const mockUser: MockAuthUser = { id: 2, role: 'Admin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(false)

    const mockDbUser: MockPrismaUser = { id: 2, user: 'mitra', role: 'Admin' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as PrismaUser)
    vi.mocked(prisma.portalBersamaMitra.findMany).mockResolvedValue([
      { portal: { nama: 'Bersama', slug: 'gabung' } },
    ] as never)

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: 'Mitra',
        user: 'mitra',
        role: 'Admin',
        portalPelangganEnabled: true,
        portalSlug: 'milik-saya',
      }),
    }

    const res = await PUT(request as NextRequest, mockParams)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/link bersama/)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('does not apply pppAutoFillEnabled when Superadmin edits non-Admin user', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Superadmin' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    vi.mocked(hasRole).mockReturnValue(true)

    const mockDbUser: MockPrismaUser = { id: 2, user: 'teknisi', role: 'Teknisi' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as PrismaUser)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: 'Teknisi',
        user: 'teknisi',
        role: 'Teknisi',
        pppAutoFillEnabled: true,
      }),
    }

    await PUT(request as NextRequest, mockParams)

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 2 },
      data: expect.not.objectContaining({
        pppAutoFillEnabled: true,
      }),
    }))
  })
})
