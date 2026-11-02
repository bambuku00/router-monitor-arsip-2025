import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "lucia";

const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import { canAccessUser, canAccessManagedUser, canManageUserAccount, canAccessSensitiveUserUpload, getOwnedResourcesUserId, canAdminDeleteOwnStaff } from "@/lib/rbac";

function actor(p: {
  id: number;
  role: string;
  parentId: number | null;
}): User {
  return p as unknown as User;
}

beforeEach(() => {
  findUnique.mockReset();
});

describe("canAccessUser (resource owner scope)", () => {
  it("Superadmin can access any ownerId (no cross-tenant block at this layer)", () => {
    expect(canAccessUser(actor({ id: 1, role: "Superadmin", parentId: null }), 999)).toBe(
      true
    );
  });

  it("Admin cannot access another tenant ownerId without parent/self relation", () => {
    expect(canAccessUser(actor({ id: 10, role: "Admin", parentId: null }), 999)).toBe(false);
  });

  it("Admin can access own ownerId", () => {
    expect(canAccessUser(actor({ id: 10, role: "Admin", parentId: null }), 10)).toBe(true);
  });

  it("Teknisi can access resource owned by parent mitra", () => {
    expect(canAccessUser(actor({ id: 5, role: "Teknisi", parentId: 10 }), 10)).toBe(true);
  });

  it("Teknisi cannot access unrelated tenant ownerId", () => {
    expect(canAccessUser(actor({ id: 5, role: "Teknisi", parentId: 10 }), 99)).toBe(false);
  });

  it("Keuangan follows same parent rule", () => {
    expect(canAccessUser(actor({ id: 7, role: "Keuangan", parentId: 10 }), 10)).toBe(true);
    expect(canAccessUser(actor({ id: 7, role: "Keuangan", parentId: 10 }), 11)).toBe(false);
  });
});

describe("canAccessManagedUser (user account / tenant subtree)", () => {
  it("Superadmin can access any target user id", async () => {
    await expect(
      canAccessManagedUser(actor({ id: 1, role: "Superadmin", parentId: null }), 888)
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("user can access self", async () => {
    await expect(
      canAccessManagedUser(actor({ id: 10, role: "Admin", parentId: null }), 10)
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("Admin can access managed child user (parentId matches Admin)", async () => {
    findUnique.mockResolvedValueOnce({ parentId: 10 });
    await expect(
      canAccessManagedUser(actor({ id: 10, role: "Admin", parentId: null }), 50)
    ).resolves.toBe(true);
  });

  it("Admin cannot access user in another tenant", async () => {
    findUnique.mockResolvedValueOnce({ parentId: 20 });
    await expect(
      canAccessManagedUser(actor({ id: 10, role: "Admin", parentId: null }), 50)
    ).resolves.toBe(false);
  });

  it("staff can still access parent user row via canAccessUser branch (legacy hierarchy)", async () => {
    await expect(
      canAccessManagedUser(actor({ id: 5, role: "Teknisi", parentId: 10 }), 10)
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns false when target user missing", async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(
      canAccessManagedUser(actor({ id: 10, role: "Admin", parentId: null }), 50)
    ).resolves.toBe(false);
  });
});

describe("canManageUserAccount (C3: user ACCOUNT mutation, never resource access)", () => {
  it("Superadmin can manage any target user", async () => {
    await expect(
      canManageUserAccount(actor({ id: 1, role: "Superadmin", parentId: null }), 888)
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("self update is always allowed (any role)", async () => {
    await expect(
      canManageUserAccount(actor({ id: 5, role: "Teknisi", parentId: 10 }), 5)
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("Admin can manage own child staff (password change etc.)", async () => {
    findUnique.mockResolvedValueOnce({ parentId: 10 });
    await expect(
      canManageUserAccount(actor({ id: 10, role: "Admin", parentId: null }), 50)
    ).resolves.toBe(true);
  });

  it("Admin cannot manage a user in another tenant (cross-tenant)", async () => {
    findUnique.mockResolvedValueOnce({ parentId: 20 });
    await expect(
      canManageUserAccount(actor({ id: 10, role: "Admin", parentId: null }), 50)
    ).resolves.toBe(false);
  });

  it("C3: Teknisi CANNOT manage parent Admin account (password change denied)", async () => {
    await expect(
      canManageUserAccount(actor({ id: 5, role: "Teknisi", parentId: 10 }), 10)
    ).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("C3: Keuangan CANNOT manage parent Admin account", async () => {
    await expect(
      canManageUserAccount(actor({ id: 7, role: "Keuangan", parentId: 10 }), 10)
    ).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("Teknisi cannot manage another tenant's account either", async () => {
    await expect(
      canManageUserAccount(actor({ id: 5, role: "Teknisi", parentId: 10 }), 99)
    ).resolves.toBe(false);
  });
});

describe("canAccessSensitiveUserUpload (H10: identity/invoice PII)", () => {
  it("Superadmin can access any owner upload", async () => {
    await expect(
      canAccessSensitiveUserUpload(actor({ id: 1, role: "Superadmin", parentId: null }), 99)
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("self can access own upload", async () => {
    await expect(
      canAccessSensitiveUserUpload(actor({ id: 5, role: "Teknisi", parentId: 10 }), 5)
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("H10: staff cannot access parent Admin identity upload", async () => {
    await expect(
      canAccessSensitiveUserUpload(actor({ id: 5, role: "Teknisi", parentId: 10 }), 10)
    ).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("Admin can access child staff upload", async () => {
    findUnique.mockResolvedValueOnce({ parentId: 10 });
    await expect(
      canAccessSensitiveUserUpload(actor({ id: 10, role: "Admin", parentId: null }), 50)
    ).resolves.toBe(true);
  });
});

describe("Admin tambahan dalam satu mitra", () => {
  it("Admin induk memakai id sendiri sebagai pemilik data", () => {
    expect(
      getOwnedResourcesUserId(actor({ id: 10, role: "Admin", parentId: null }))
    ).toBe(10);
  });

  it("Admin tambahan memakai id mitra induk", () => {
    expect(
      getOwnedResourcesUserId(actor({ id: 50, role: "Admin", parentId: 10 }))
    ).toBe(10);
  });

  it("Admin tambahan boleh mengelola staff mitra yang sama", async () => {
    findUnique.mockResolvedValueOnce({ parentId: 10 });
    await expect(
      canManageUserAccount(actor({ id: 50, role: "Admin", parentId: 10 }), 60)
    ).resolves.toBe(true);
  });

  it("Admin tambahan tidak boleh mengubah akun mitra induk", async () => {
    await expect(
      canManageUserAccount(actor({ id: 50, role: "Admin", parentId: 10 }), 10)
    ).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("Admin tambahan tidak membaca identitas mitra induk", async () => {
    await expect(
      canAccessSensitiveUserUpload(
        actor({ id: 50, role: "Admin", parentId: 10 }),
        10
      )
    ).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("menghapus Admin tambahan tidak dianggap hapus mitra", () => {
    expect(
      canAdminDeleteOwnStaff(actor({ id: 10, role: "Admin", parentId: null }), {
        role: "Admin",
        parentId: 10,
      })
    ).toBe(true);
    expect(
      canAdminDeleteOwnStaff(actor({ id: 50, role: "Admin", parentId: 10 }), {
        role: "Admin",
        parentId: null,
      })
    ).toBe(false);
  });
});
