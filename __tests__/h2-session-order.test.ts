import { describe, it, expect, vi, beforeEach } from "vitest";
import { lucia } from "@/lib/auth";
import { PUT } from "@/app/api/user/[id]/route";
import prisma from "@/lib/prisma";
import { validateRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { hasRole, canManageUserAccount } from "@/lib/rbac";
import { hash } from "argon2";
import type { User, Session } from "lucia";
import type { User as PrismaUser } from "@prisma/client";
import type { MockAuthUser, MockSession, MockNextRequest } from "./mocks";

const sessionDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
const userUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: (...args: unknown[]) => userUpdate(...args),
    },
    session: {
      deleteMany: (...args: unknown[]) => sessionDeleteMany(...args),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { update: (...args: unknown[]) => userUpdate(...args) },
        session: { deleteMany: (...args: unknown[]) => sessionDeleteMany(...args) },
      };
      return fn(tx);
    }),
  },
}));

vi.mock("argon2", () => ({
  hash: vi.fn().mockResolvedValue("hashed-new"),
}));

vi.mock("@/lib/auth", () => ({
  validateRequest: vi.fn(),
  lucia: {
    invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue({ id: "new-session" }),
    createSessionCookie: vi.fn().mockReturnValue({
      name: "session",
      value: "cookie",
      attributes: { httpOnly: true, sameSite: "lax", secure: false, path: "/" },
    }),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
  })),
}));

vi.mock("@/lib/rbac", () => ({
  hasRole: vi.fn(),
  canManageUserAccount: vi.fn().mockResolvedValue(true),
  canAdminDeleteOwnStaff: vi.fn(),
}));

vi.mock("@/lib/staff-menu-api", () => ({
  staffMenuApiForbidden: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/server-actions/api", () => ({
  errorApiResponse: vi.fn((err: Error) => ({
    status: 500,
    json: () => Promise.resolve({ error: err.message }),
  })),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200,
      data,
    })),
  },
}));

describe("H2: password change session ordering (atomic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hash).mockResolvedValue("hashed-new");
    vi.mocked(canManageUserAccount).mockResolvedValue(true);
    vi.mocked(hasRole).mockReturnValue(true);
    sessionDeleteMany.mockResolvedValue({ count: 1 });
    userUpdate.mockResolvedValue({
      id: 2,
      user: "me",
      nama: "Me",
      password: "hashed-new",
    } as PrismaUser);
  });

  it("updates password and deletes sessions in one transaction (self)", async () => {
    const mockUser: MockAuthUser = { id: 2, role: "Admin" };
    const mockSession: MockSession = { id: "session" };
    vi.mocked(validateRequest).mockResolvedValue({
      user: mockUser as User,
      session: mockSession as Session,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 2,
      user: "me",
      role: "Admin",
      parentId: null,
    } as PrismaUser);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: "Me",
        user: "me",
        password: "newpassword123",
      }),
    };

    await PUT(request as NextRequest, { params: Promise.resolve({ id: "2" }) });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalled();
    expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: 2 } });
    const updateOrder = userUpdate.mock.invocationCallOrder[0]!;
    const deleteOrder = sessionDeleteMany.mock.invocationCallOrder[0]!;
    const createOrder = vi.mocked(lucia.createSession).mock.invocationCallOrder[0]!;
    expect(updateOrder).toBeLessThan(deleteOrder);
    expect(deleteOrder).toBeLessThan(createOrder);
    expect(lucia.invalidateUserSessions).not.toHaveBeenCalled();
  });

  it("does not wipe sessions if transaction update throws", async () => {
    const mockUser: MockAuthUser = { id: 2, role: "Admin" };
    vi.mocked(validateRequest).mockResolvedValue({
      user: mockUser as User,
      session: { id: "session" } as Session,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 2,
      user: "me",
      role: "Admin",
      parentId: null,
    } as PrismaUser);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    userUpdate.mockRejectedValue(new Error("db down"));

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: "Me",
        user: "me",
        password: "newpassword123",
      }),
    };

    await PUT(request as NextRequest, { params: Promise.resolve({ id: "2" }) });

    expect(sessionDeleteMany).not.toHaveBeenCalled();
    expect(lucia.createSession).not.toHaveBeenCalled();
  });

  it("rolls back via transaction when session delete fails (no stale sessions)", async () => {
    const mockUser: MockAuthUser = { id: 2, role: "Admin" };
    vi.mocked(validateRequest).mockResolvedValue({
      user: mockUser as User,
      session: { id: "session" } as Session,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 2,
      user: "me",
      role: "Admin",
      parentId: null,
    } as PrismaUser);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    // Simulate transaction aborting when deleteMany fails
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
      const tx = {
        user: {
          update: vi.fn().mockResolvedValue({
            id: 2,
            user: "me",
            nama: "Me",
            password: "hashed-new",
          }),
        },
        session: {
          deleteMany: vi.fn().mockRejectedValue(new Error("session wipe failed")),
        },
      };
      return (
        fn as unknown as (client: typeof tx) => Promise<unknown>
      )(tx);
    });

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: "Me",
        user: "me",
        password: "newpassword123",
      }),
    };

    await PUT(request as NextRequest, { params: Promise.resolve({ id: "2" }) });

    // Transaction throws → createSession must not run; password change aborted by DB
    expect(lucia.createSession).not.toHaveBeenCalled();
  });

  it("Admin changing another user: wipe sessions, no actor recreate", async () => {
    const mockUser: MockAuthUser = { id: 1, role: "Superadmin" };
    vi.mocked(validateRequest).mockResolvedValue({
      user: mockUser as User,
      session: { id: "session" } as Session,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 2,
      user: "target",
      role: "Admin",
      parentId: null,
    } as PrismaUser);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    userUpdate.mockResolvedValue({
      id: 2,
      user: "target",
      nama: "T",
      password: "hashed-new",
    } as PrismaUser);

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: "T",
        user: "target",
        password: "newpassword123",
        role: "Admin",
      }),
    };

    await PUT(request as NextRequest, { params: Promise.resolve({ id: "2" }) });

    expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: 2 } });
    expect(lucia.createSession).not.toHaveBeenCalled();
  });

  it("createSession failure after wipe: still succeeds (availability only)", async () => {
    const mockUser: MockAuthUser = { id: 2, role: "Admin" };
    vi.mocked(validateRequest).mockResolvedValue({
      user: mockUser as User,
      session: { id: "session" } as Session,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 2,
      user: "me",
      role: "Admin",
      parentId: null,
    } as PrismaUser);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(lucia.createSession).mockRejectedValueOnce(new Error("session store down"));

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: "Me",
        user: "me",
        password: "newpassword123",
      }),
    };

    const res = await PUT(request as NextRequest, {
      params: Promise.resolve({ id: "2" }),
    });
    expect(sessionDeleteMany).toHaveBeenCalled();
    const body = await res.json();
    expect(body.warning).toBeTruthy();
  });

  it("password unchanged: no session wipe", async () => {
    const mockUser: MockAuthUser = { id: 2, role: "Admin" };
    vi.mocked(validateRequest).mockResolvedValue({
      user: mockUser as User,
      session: { id: "session" } as Session,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 2,
      user: "me",
      role: "Admin",
      parentId: null,
    } as PrismaUser);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const request: MockNextRequest = {
      json: vi.fn().mockResolvedValue({
        nama: "Me Updated",
        user: "me",
      }),
    };

    await PUT(request as NextRequest, { params: Promise.resolve({ id: "2" }) });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sessionDeleteMany).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalled();
  });
});
