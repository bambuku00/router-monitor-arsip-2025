import { describe, expect, it, vi, beforeEach } from "vitest";

const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    router: {
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}));

vi.mock("@/lib/authz", () => ({
  getRouterForUser: vi.fn(),
}));

import { getRouterForUser } from "@/lib/authz";
import {
  assertRouterIdAccess,
  resolveRouterIdAccess,
} from "@/lib/router-page-access";

const mockUser = {
  id: 1,
  role: "Admin" as const,
  parentId: null,
};

beforeEach(() => {
  findFirst.mockReset();
  vi.mocked(getRouterForUser).mockReset();
});

describe("resolveRouterIdAccess", () => {
  it("returns not_found for malformed id", async () => {
    expect(await resolveRouterIdAccess(mockUser as never, "abc")).toEqual({
      status: "not_found",
    });
  });

  it("returns not_found when router does not exist", async () => {
    findFirst.mockResolvedValue(null);
    expect(await resolveRouterIdAccess(mockUser as never, "9")).toEqual({
      status: "not_found",
    });
  });

  it("returns forbidden when router exists but user is out of scope", async () => {
    findFirst.mockResolvedValue({ id: 9 });
    vi.mocked(getRouterForUser).mockResolvedValue(null);
    expect(await resolveRouterIdAccess(mockUser as never, "9")).toEqual({
      status: "forbidden",
    });
  });

  it("returns ok when router exists and user is in scope", async () => {
    findFirst.mockResolvedValue({ id: 97 });
    vi.mocked(getRouterForUser).mockResolvedValue({ id: 97 } as never);
    expect(await resolveRouterIdAccess(mockUser as never, "97")).toEqual({
      status: "ok",
      routerId: 97,
    });
  });
});

describe("assertRouterIdAccess", () => {
  it("throws notFound for not_found status", () => {
    expect(() => assertRouterIdAccess({ status: "not_found" })).toThrow();
  });
});
