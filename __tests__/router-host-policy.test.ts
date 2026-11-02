import { describe, it, expect } from "vitest";
import { resolveMikrotikProxyConnectHost } from "@/lib/router-host-policy";

describe("H6: host policy SSRF (canonical IPv6)", () => {
  const reject = [
    "127.0.0.1",
    "::1",
    "::",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "0:0:0:0:0:ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:a9fe:a9fe",
    "169.254.169.254",
    "0.0.0.0",
    "10.1.2.3",
    "192.168.0.1",
    "172.16.5.5",
    "ff02::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
  ];

  for (const host of reject) {
    it(`rejects ${host}`, async () => {
      await expect(resolveMikrotikProxyConnectHost(host)).rejects.toThrow();
    });
  }

  it("allows public IPv4", async () => {
    await expect(resolveMikrotikProxyConnectHost("8.8.8.8")).resolves.toBe("8.8.8.8");
  });

  it("allows public IPv6", async () => {
    await expect(resolveMikrotikProxyConnectHost("2001:4860:4860::8888")).resolves.toBe(
      "2001:4860:4860::8888"
    );
  });
});

describe("H6: zone-ID / multicast / broadcast adversarial", () => {
  const zoneReject = [
    "::ffff:127.0.0.1%lo",
    "::ffff:127.0.0.1%eth0",
    "::ffff:127.0.0.1%en0",
    "::ffff:127.0.0.1%25eth0",
    "::1%lo",
    "[::1]",
    "[::ffff:127.0.0.1%lo]",
    " [::ffff:127.0.0.1%lo] ",
    "::1%",
    "%lo",
    "fe80::1%eth0",
  ];

  for (const host of zoneReject) {
    it(`rejects zone/bracket form ${JSON.stringify(host)}`, async () => {
      await expect(resolveMikrotikProxyConnectHost(host)).rejects.toThrow();
    });
  }

  const multicastBroadcast = [
    "224.0.0.1",
    "239.255.255.250",
    "255.255.255.255",
  ];

  for (const host of multicastBroadcast) {
    it(`rejects multicast/broadcast ${host}`, async () => {
      await expect(resolveMikrotikProxyConnectHost(host)).rejects.toThrow();
    });
  }

  it("mapped public IPv6 still unwraps", async () => {
    await expect(resolveMikrotikProxyConnectHost("::ffff:8.8.4.4")).resolves.toBe(
      "8.8.4.4"
    );
  });
});
