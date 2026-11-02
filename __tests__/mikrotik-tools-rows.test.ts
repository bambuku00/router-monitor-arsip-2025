import { describe, it, expect } from "vitest";
import {
  buildActiveByName,
  mergeSecretRows,
  mergeSecretWithActive,
  parseProxyList,
  resolveIpPppoe,
} from "@/lib/mikrotik-tools-rows";

describe("mikrotik-tools-rows", () => {
  const secretPpp1 = {
    ".id": "*1",
    name: "ppp1",
    password: "ppp1",
    profile: "5Mbps",
    service: "pppoe",
    "local-address": "",
    "remote-address": "",
    disabled: "false",
  };

  const activePpp1 = {
    ".id": "*A1",
    name: "ppp1",
    address: "10.10.8.25",
    service: "pppoe",
  };

  it("parseProxyList reads { data: [...] }", () => {
    expect(parseProxyList({ data: [activePpp1] })).toEqual([activePpp1]);
    expect(parseProxyList([])).toEqual([]);
    expect(parseProxyList({ data: null })).toEqual([]);
  });

  it("resolveIpPppoe prefers active.address over remote-address", () => {
    expect(resolveIpPppoe({ address: "10.10.8.25" }, "")).toBe("10.10.8.25");
    expect(resolveIpPppoe(undefined, "192.168.1.5")).toBe("192.168.1.5");
    expect(resolveIpPppoe(undefined, "-")).toBe("-");
    expect(resolveIpPppoe(undefined, undefined)).toBe("-");
  });

  it("buildActiveByName keys by String(name)", () => {
    const map = buildActiveByName([{ name: "ppp1", address: "10.10.8.25" }]);
    expect(map.get("ppp1")).toEqual({ address: "10.10.8.25" });
    expect(map.get(String("ppp1"))).toEqual({ address: "10.10.8.25" });
  });

  it("mergeSecretWithActive: ppp1 online gets active.address", () => {
    const activeByName = buildActiveByName([activePpp1]);
    const row = mergeSecretWithActive(secretPpp1, activeByName);

    expect(row.name).toBe("ppp1");
    expect(row.password).toBe("ppp1");
    expect(row.profile).toBe("5Mbps");
    expect(row.isOnline).toBe(true);
    expect(row.statusLabel).toBe("Online");
    expect(row.ipPppoe).toBe("10.10.8.25");
  });

  it("mergeSecretWithActive: ppp1 offline when not in active list", () => {
    const row = mergeSecretWithActive(secretPpp1, new Map());
    expect(row.isOnline).toBe(false);
    expect(row.statusLabel).toBe("Offline");
    expect(row.ipPppoe).toBe("-");
  });

  it("mergeSecretRows handles empty active list", () => {
    const rows = mergeSecretRows([secretPpp1], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].ipPppoe).toBe("-");
    expect(rows[0].statusLabel).toBe("Offline");
  });

  it("mergeSecretRows: ppp1 row receives active.address from pool session", () => {
    const rows = mergeSecretRows([secretPpp1], [activePpp1]);
    expect(rows[0]).toMatchObject({
      name: "ppp1",
      password: "ppp1",
      profile: "5Mbps",
      statusLabel: "Online",
      ipPppoe: "10.10.8.25",
    });
  });
});
