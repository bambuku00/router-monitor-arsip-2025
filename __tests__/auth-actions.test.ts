import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login, registerPageAction } from '@/lib/server-actions/auth-actions'
import prisma from '@/lib/prisma'
import { verify, hash } from 'argon2'
import { validateRequest } from '@/lib/auth'
import type { User, Session } from 'lucia'
import type { User as PrismaUser } from '@prisma/client'
import type { UserOptionalDefaults } from '@/prisma/generated/zod'
import type { MockAuthUser, MockSession, MockPrismaUser, MockRegisterPayload } from './mocks'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('argon2', () => ({
  verify: vi.fn(),
  hash: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
  })),
  headers: vi.fn(async () => ({
    get: vi.fn((name: string) => {
      if (name === 'user-agent') return 'vitest-agent'
      if (name === 'x-forwarded-for') return '127.0.0.1'
      return null
    }),
  })),
}))

vi.mock('@/lib/ratelimit', () => ({
  rateLimit: vi.fn(() => false),
}))

vi.mock('@/lib/security-audit-log', () => ({
  logSecurityEvent: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  lucia: {
    createSession: vi.fn(() => ({ id: 'session-id' })),
    createSessionCookie: vi.fn(() => ({
      name: 'session-cookie',
      value: 'cookie-value',
      attributes: {},
    })),
  },
  validateRequest: vi.fn(),
}))

describe('Auth Actions', () => {
  describe('login', () => {
    // ... existing login tests ...
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should return error for invalid username format (too short)', async () => {
      const result = await login({ user: 'ab', password: 'password123' })
      expect(result.error).toBe('Username atau password salah')
      expect(result.user).toBeNull()
    })

    it('should return error for invalid username format (invalid chars)', async () => {
      const result = await login({ user: 'user@name', password: 'password123' })
      expect(result.error).toBe('Username atau password salah')
      expect(result.user).toBeNull()
    })

    it('should return error when user not found', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

      const result = await login({ user: 'nonexistent', password: 'password123' })
      
      expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { user: 'nonexistent' } })
      expect(result.error).toBe('Username atau password salah')
      expect(result.user).toBeNull()
    })

    it('should return error when password verification fails', async () => {
      const mockDbUser: MockPrismaUser = {
        id: 1,
        user: 'existinguser',
        password: 'hashedpassword',
      };
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockDbUser, verified: true } as PrismaUser)
      vi.mocked(verify).mockResolvedValue(false)

      const result = await login({ user: 'existinguser', password: 'wrongpassword' })

      expect(verify).toHaveBeenCalledWith('hashedpassword', 'wrongpassword')
      expect(result.error).toBe('Username atau password salah')
      expect(result.user).toBeNull()
    })

    it('should return error when user is not verified', async () => {
      const mockDbUser: MockPrismaUser = {
        id: 1,
        user: 'existinguser',
        password: 'hashedpassword',
      };
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockDbUser, verified: false } as PrismaUser)
      vi.mocked(verify).mockResolvedValue(true)

      const result = await login({ user: 'existinguser', password: 'password123' })

      expect(result.error).toBe('User belum diverifikasi harap hubungi admin')
      expect(result.user).toBeNull()
    })

    it('should return user when login is successful', async () => {
      const mockDbUser: MockPrismaUser = {
        id: 1,
        user: 'existinguser',
        password: 'hashedpassword',
      };
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockDbUser, verified: true } as PrismaUser)
      vi.mocked(verify).mockResolvedValue(true)

      const result = await login({ user: 'existinguser', password: 'password123' })

      expect(result.error).toBeUndefined()
      expect(result.user).toEqual(expect.objectContaining({ id: 1, user: 'existinguser' }))
    })
  })

  describe('registerPageAction', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should return unauthorized if user is not logged in', async () => {
      vi.mocked(validateRequest).mockResolvedValue({ user: null, session: null })

      const payload: MockRegisterPayload = {
        nama: 'New User',
        user: 'newuser',
        password: 'password123',
        role: 'Teknisi',
      };
      const result = await registerPageAction(payload as UserOptionalDefaults)

      expect(result).toHaveProperty('error', 'Tidak diizinkan')
      expect(result).toHaveProperty('status', 401)
    })

    it('should return unauthorized if user is not Admin/Superadmin', async () => {
      const mockUser: MockAuthUser = { id: 0, role: 'Teknisi' };
      const mockSession: MockSession = { id: 's' };
      vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })

      const payload: MockRegisterPayload = {
        nama: 'New User',
        user: 'newuser',
        password: 'password123',
        role: 'Teknisi',
      };
      const result = await registerPageAction(payload as UserOptionalDefaults);

      expect(result).toHaveProperty('error', 'Tidak diizinkan')
      expect(result).toHaveProperty('status', 403)
    })

    it('should return error if username is taken', async () => {
      const mockUser: MockAuthUser = { id: 1, role: 'Admin' };
      const mockSession: MockSession = { id: 's' };
      vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
      const mockDbUser: MockPrismaUser = { id: 1 };
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockDbUser as PrismaUser)

      const payload: MockRegisterPayload = {
        nama: 'New User',
        user: 'existinguser',
        password: 'password123',
        role: 'Teknisi',
      };
      const result = await registerPageAction(payload as UserOptionalDefaults)

      expect(result).toHaveProperty('error', 'Username sudah digunakan')
    })

    it('should return error if password is too short', async () => {
      const mockUser: MockAuthUser = { id: 1, role: 'Admin' };
      const mockSession: MockSession = { id: 's' };
      vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

      const payload: MockRegisterPayload = {
        nama: 'New User',
        user: 'newuser',
        password: 'short',
        role: 'Teknisi',
      };
      const result = await registerPageAction(payload as UserOptionalDefaults)

      expect(result).toHaveProperty('error', 'Password tidak valid (minimal 8 karakter)')
    })

    it('should create user if validation passes', async () => {
      const mockUser: MockAuthUser = { id: 1, role: 'Admin' };
      const mockSession: MockSession = { id: 's' };
      vi.mocked(validateRequest).mockResolvedValue({ user: mockUser as User, session: mockSession as Session })
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      vi.mocked(hash).mockResolvedValue('hashedpassword')

      const mockCreatedUser: MockPrismaUser = {
        id: 2,
        user: 'newuser',
        password: 'hashedpassword',
      };
      vi.mocked(prisma.user.create).mockResolvedValue({ ...mockCreatedUser, nama: 'New User', role: 'Teknisi' } as PrismaUser)

      const payload: MockRegisterPayload = {
        nama: 'New User',
        user: 'newuser',
        password: 'password123',
        role: 'Teknisi',
      };
      const result = await registerPageAction(payload as UserOptionalDefaults);

      expect(hash).toHaveBeenCalledWith('password123', expect.any(Object))
      expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          user: 'newuser',
          password: 'hashedpassword',
          role: 'Teknisi'
        })
      }))
      
      // Check that password is removed from response
      expect(result).not.toHaveProperty('password')
      expect(result).toHaveProperty('user', 'newuser')
    })
  })
})
