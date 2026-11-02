import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from '@/app/api/pembayaran/[id]/route'
import prisma from '@/lib/prisma'
import { validateRequest } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import type { User, Session } from 'lucia'
import type { User as PrismaUser, Pembayaran } from '@prisma/client'
import type { MockAuthUser, MockSession, MockPrismaUser, MockPembayaran } from './mocks'

function payReq(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    nextUrl: { pathname: "/api/pembayaran/1" } as NextRequest["nextUrl"],
  } as unknown as NextRequest;
}

const payTest = vi.hoisted(() => ({
  getPembayaranInScope: vi.fn(),
  pembayaranUpdate: vi.fn(),
  logBayarCreate: vi.fn(),
}))

// Mock dependencies
vi.mock('@/lib/authz', () => ({
  getPembayaranInScope: payTest.getPembayaranInScope,
  getBankForUser: vi.fn().mockResolvedValue({ id: 5 }),
}))

vi.mock('@/lib/rbac', () => ({
  canStaffPayViaBank: vi.fn(() => true),
}))

vi.mock('@/lib/auto-isolir/run', () => ({
  tryRestoreIsolirOnPayment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/staff-menu-api', () => ({
  staffMenuApiForbidden: vi.fn(() => null),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
    },
    pembayaran: {
      update: payTest.pembayaranUpdate,
    },
    logBayar: {
      create: payTest.logBayarCreate,
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        pembayaran: { update: payTest.pembayaranUpdate },
        logBayar: { create: payTest.logBayarCreate },
      }),
  },
}))

vi.mock('@/lib/auth', () => ({
  validateRequest: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
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

describe('Payment API (PATCH /api/pembayaran/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    payTest.getPembayaranInScope.mockResolvedValue({
      id: 1,
      total: 100000,
    } as never)
  })

  const mockParams = { params: Promise.resolve({ id: '1' }) }

  it('should return 401 if user is not logged in', async () => {
    vi.mocked(validateRequest).mockResolvedValue({ user: null, session: null })

    const response = await PATCH(payReq({}), mockParams)
    
    expect(response.status).toBe(401)
  })

  it('should return 400 if params.id is missing', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Admin', user: 'admin1' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })

    const response = await PATCH(payReq({}), { params: Promise.resolve({ id: '' }) })
    
    expect(NextResponse.json).toHaveBeenCalledWith("Bad request", { status: 400 })
  })

  it('should return 400 if data is invalid (validation error)', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Admin', user: 'admin1' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })

    const invalidData = {
      metode: 'InvalidMethod',
    }

    const response = await PATCH(payReq(invalidData), mockParams)

    expect(NextResponse.json).toHaveBeenCalledWith("Data is not valid", { status: 400 })
  })

  it('should return 403 if pembayaran is out of scope', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Admin', user: 'admin1' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
    payTest.getPembayaranInScope.mockResolvedValue(null)

    const data = {
      metode: 'Cash',
      total: 100000,
      status: 'Terbayar',
    }

    await PATCH(payReq(data), mockParams)

    expect(NextResponse.json).toHaveBeenCalledWith(
      "Pembayaran not found or access denied",
      { status: 403 }
    )
  })

  it('should process payment successfully (Cash)', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Admin', user: 'admin1' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })

    const mockUpdatedPayment: MockPembayaran = {
      id: 1,
      total: 100000,
      status: 'Terbayar',
      metode: 'Cash',
      pelangganId: 10,
    }
    payTest.pembayaranUpdate.mockResolvedValue(mockUpdatedPayment as Pembayaran)

    const data = {
      metode: 'Cash',
      total: 100000,
      status: 'Belum',
    }

    const response = await PATCH(payReq(data), mockParams)
    
    expect(payTest.pembayaranUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'Terbayar',
        bankId: null,
        metode: 'Cash',
        inputterId: 1,
      },
    })
    
    expect(payTest.logBayarCreate).toHaveBeenCalledWith({
      data: {
        pembayaranId: 1,
        inputterId: 1,
        status: 'Terbayar',
        metode: 'Cash',
        total: 100000,
      },
    })
    
    expect(NextResponse.json).toHaveBeenCalledWith({
      data: mockUpdatedPayment,
      message: 'Pembayaran telah berhasil',
    })
  })

  it('should process payment successfully (Transfer)', async () => {
    const mockUser: MockAuthUser = { id: 1, role: 'Admin', user: 'admin1' };
    const mockSession: MockSession = { id: 'session' };
    vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })

    const mockUpdatedPayment: MockPembayaran = {
      id: 1,
      total: 100000,
      status: 'Terbayar',
      metode: 'Transfer',
      bankId: 5,
      pelangganId: 10,
    }
    payTest.pembayaranUpdate.mockResolvedValue(mockUpdatedPayment as Pembayaran)

    const data = {
      metode: 'Transfer',
      bankId: 5,
      total: 100000,
      status: 'Belum',
    }

    const response = await PATCH(payReq(data), mockParams)
    
    expect(payTest.pembayaranUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'Terbayar',
        bankId: 5,
        metode: 'Transfer',
        inputterId: 1,
      },
    })
    
    expect(NextResponse.json).toHaveBeenCalledWith({
      data: mockUpdatedPayment,
      message: 'Pembayaran telah berhasil',
    })
  })
})
