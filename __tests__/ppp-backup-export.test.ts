import { describe, expect, it } from "vitest";
import { buildPppBackupScript, pppBackupFilename } from "@/lib/ppp-backup-export";

describe("buildPppBackupScript", () => {
  it("writes a secret and escapes quotes in the password", () => {
    const script = buildPppBackupScript({
      routerName: "Demo",
      exportedAt: "2026-10-24 02:14",
      secrets: [
        {
          name: "budi",
          password: `ra"hasia`,
          service: "pppoe",
          profile: "10 Mbps",
          comment: null,
          disabled: "false",
          isIsolir: false,
          profileBeforeIsolir: null,
          pelangganNama: "Budi",
          paketNama: "10 Mbps",
        },
      ],
    });

    expect(script).toContain("/ppp secret");
    expect(script).toContain(`password="ra\\"hasia"`);
    expect(script).toContain(`comment="Budi"`);
    expect(script).toContain("disabled=no");
  });

  it("restores the profile from before isolir", () => {
    const script = buildPppBackupScript({
      routerName: "Demo",
      exportedAt: "2026-10-24",
      secrets: [
        {
          name: "ani",
          password: "pw",
          service: "pppoe",
          profile: "isolir",
          comment: "Ani",
          disabled: "true",
          isIsolir: true,
          profileBeforeIsolir: "20 Mbps",
          pelangganNama: "Ani",
          paketNama: "20 Mbps",
        },
      ],
    });

    expect(script).toContain(`profile="20 Mbps"`);
    expect(script).not.toContain(`profile="isolir"`);
    expect(script).toContain("disabled=no");
  });

  it("keeps a manually disabled secret disabled", () => {
    const script = buildPppBackupScript({
      routerName: "Demo",
      exportedAt: "2026-10-24",
      secrets: [
        {
          name: "mati",
          password: "pw",
          service: "pppoe",
          profile: "10 Mbps",
          comment: null,
          disabled: "true",
          isIsolir: false,
          profileBeforeIsolir: null,
          pelangganNama: null,
          paketNama: null,
        },
      ],
    });

    expect(script).toContain("disabled=yes");
  });

  it("writes profiles before secrets", () => {
    const script = buildPppBackupScript({
      routerName: "Demo",
      exportedAt: "2026-10-24",
      profileNote: "cadangan terakhir di billing",
      profiles: [
        {
          name: "10 Mbps",
          rateLimit: "10M/10M",
          localAddress: "10.0.0.1",
          remoteAddress: null,
          onlyOne: "yes",
          comment: null,
          dnsServer: null,
          addressList: null,
          parentQueue: null,
          queueType: null,
          bridge: null,
          sessionTimeout: null,
          idleTimeout: null,
          changeTcpMss: null,
        },
      ],
      secrets: [
        {
          name: "budi",
          password: "pw",
          service: "pppoe",
          profile: "10 Mbps",
          comment: null,
          disabled: "false",
          isIsolir: false,
          profileBeforeIsolir: null,
          pelangganNama: null,
          paketNama: null,
        },
      ],
    });

    const poolAt = script.indexOf("/ip pool");
    const profileAt = script.indexOf("/ppp profile");
    const secretAt = script.indexOf("/ppp secret");
    expect(poolAt).toBeGreaterThanOrEqual(0);
    expect(poolAt).toBeLessThan(profileAt);
    expect(profileAt).toBeLessThan(secretAt);
    expect(script).toContain(`rate-limit="10M/10M"`);
    expect(script).toContain("cadangan terakhir di billing");
  });

  it("writes the next pool before the pool that uses it", () => {
    const script = buildPppBackupScript({
      routerName: "Demo",
      exportedAt: "2026-10-24",
      pools: [
        {
          name: "lanjut",
          ranges: "10.0.1.2-10.0.1.254",
          nextPool: "utama",
          comment: null,
        },
        {
          name: "utama",
          ranges: "10.0.0.2-10.0.0.254",
          nextPool: null,
          comment: null,
        },
      ],
      secrets: [],
    });

    const utama = script.indexOf('name="utama"');
    const lanjut = script.indexOf('name="lanjut"');
    expect(utama).toBeGreaterThanOrEqual(0);
    expect(utama).toBeLessThan(lanjut);
    expect(script).toContain(`ranges="10.0.0.2-10.0.0.254"`);
  });
});

describe("pppBackupFilename", () => {
  it("builds a safe file name", () => {
    expect(pppBackupFilename("Demo Router", "2026-10-24")).toBe(
      "pppoe-cadangan-demo-router-2026-10-24.rsc"
    );
  });
});
