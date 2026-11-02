/**
 * Minimal mock types for tests to avoid excessive "as unknown as T" casts.
 * Use these when mocking Prisma/Lucia so mock shape is explicit and type-safe.
 */
import type { User, Session } from "lucia";
import type { User as PrismaUser, Pembayaran } from "@prisma/client";
import type { NextRequest } from "next/server";

/** Minimal user for auth mocks (validateRequest) */
export type MockAuthUser = Partial<User> & { id: number; role: string };

/** Minimal session for auth mocks */
export type MockSession = Partial<Session> & { id: string };

/** Minimal Prisma User for findFirst/update mocks */
export type MockPrismaUser = Partial<PrismaUser> & { id: number; user?: string; password?: string };

/** Minimal Prisma Pembayaran for update mocks */
export type MockPembayaran = Partial<Pembayaran> & { id: number; status?: string; metode?: string; bankId?: number | null; total?: number };

/** Minimal NextRequest for route handlers (only json() used) */
export type MockNextRequest = Partial<NextRequest> & { json: () => Promise<unknown> };

/** Payload for registerPageAction (subset of UserOptionalDefaults) */
export type MockRegisterPayload = {
  nama: string;
  user: string;
  password: string;
  role: string;
};
