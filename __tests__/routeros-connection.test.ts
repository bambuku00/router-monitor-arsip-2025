import { describe, expect, it, vi } from "vitest";
import {
  buildPlainApiProtocolProbe,
  classifyPreflightDataChunk,
  classifyPreflightTimeout,
  destroyPreflightSocket,
  looksLikeRouterOsApiReply,
  looksLikeTlsRecord,
  plainApiProtocolProbeContainsLogin,
} from "@/lib/routeros-preflight";
import {
  buildChallengeLoginSentences,
  buildDirectLoginSentences,
  computeRouterOsLoginResponse,
  parseRouterOsLoginResponse,
} from "@/lib/routeros-login";
import {
  expectedProtocolForPort,
  parseRouterIdFromLabel,
  requiresProtocolPreflight,
  ROUTEROS_PLAIN_API_PORT,
  ROUTEROS_SSL_API_PORT,
} from "@/lib/routeros-ports";
import { normalizeRouterOsConnectError } from "@/lib/routeros-client";
import { RouterOSConnectError } from "@/lib/routeros-client";

describe("routeros preflight probe", () => {
  it("does not send /login (avoids MikroTik login failure log)", () => {
    expect(plainApiProtocolProbeContainsLogin()).toBe(false);
    const probe = buildPlainApiProtocolProbe();
    expect(probe.toString("utf8")).toContain("/system/identity/print");
  });

  it("detects TLS record on custom port API-SSL responses", () => {
    expect(looksLikeTlsRecord(Buffer.from([0x16, 0x03, 0x01, 0x00]))).toBe(true);
  });

  it("detects plain API !trap reply on custom port", () => {
    const trap = Buffer.from([5, ...Buffer.from("!trap"), 0]);
    expect(looksLikeRouterOsApiReply(trap)).toBe(true);
  });
});

describe("routeros custom port preflight classification", () => {
  it("custom port plain API trap → plain probed OK", () => {
    const trap = Buffer.from([5, ...Buffer.from("!trap"), 0]);
    const result = classifyPreflightDataChunk(trap);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.protocol).toBe("plain");
  });

  it("custom port API-SSL TLS → ROUTEROS_SSL_REQUIRED, not AUTH_FAILED", () => {
    const tls = Buffer.from([0x16, 0x03, 0x01, 0x00]);
    const result = classifyPreflightDataChunk(tls);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ROUTEROS_SSL_REQUIRED");
      expect(result.error.code).not.toBe("ROUTEROS_AUTH_FAILED");
    }
  });

  it("custom port unknown binary → PROTOCOL_MISMATCH", () => {
    const garbage = Buffer.from([0x48, 0x54, 0x54, 0x50]); // HTTP
    const result = classifyPreflightDataChunk(garbage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ROUTEROS_PROTOCOL_UNCERTAIN");
    }
  });

  it("custom port TCP connected timeout → CONNECTION_TIMEOUT", () => {
    const err = classifyPreflightTimeout(true);
    expect(err.code).toBe("ROUTEROS_CONNECT_TIMEOUT");
    expect(err.code).not.toBe("ROUTEROS_AUTH_FAILED");
  });

  it("custom port TCP refused → UNREACHABLE", () => {
    const err = classifyPreflightTimeout(false);
    expect(err.code).toBe("ROUTEROS_UNREACHABLE");
  });
});

describe("routeros port policy", () => {
  it("never infers protocol from port number alone (8728, 8729, custom)", () => {
    expect(expectedProtocolForPort(ROUTEROS_PLAIN_API_PORT)).toBe("unknown");
    expect(expectedProtocolForPort(ROUTEROS_SSL_API_PORT)).toBe("unknown");
    expect(expectedProtocolForPort(11_000)).toBe("unknown");
    expect(expectedProtocolForPort(8727)).toBe("unknown");
  });

  it("requires protocol preflight for every configured port", () => {
    expect(requiresProtocolPreflight(8728)).toBe(true);
    expect(requiresProtocolPreflight(8729)).toBe(true);
    expect(requiresProtocolPreflight(11_000)).toBe(true);
    expect(requiresProtocolPreflight(null)).toBe(true);
  });

  it("parses routerId from session labels", () => {
    expect(parseRouterIdFromLabel("health:12")).toBe(12);
    expect(parseRouterIdFromLabel("syncPPP:3")).toBe(3);
    expect(parseRouterIdFromLabel("mikrotik-proxy:5:/ppp/secret/print")).toBe(5);
    expect(parseRouterIdFromLabel("no-id")).toBeUndefined();
  });
});

describe("routeros login parser", () => {
  it("modern RouterOS on custom port: direct name/password !done → success", () => {
    expect(parseRouterOsLoginResponse({ status: true })).toEqual({ kind: "success" });
  });

  it("legacy RouterOS: !done with ret → challenge", () => {
    expect(
      parseRouterOsLoginResponse({
        status: true,
        ret: "8ea3123a5743ad819d3953f3ed95a4c5",
      })
    ).toEqual({
      kind: "challenge",
      ret: "8ea3123a5743ad819d3953f3ed95a4c5",
    });
  });

  it("wrong password !trap → auth_failed", () => {
    const parsed = parseRouterOsLoginResponse({
      status: false,
      message: "invalid user name or password (6)",
    });
    expect(parsed.kind).toBe("auth_failed");
  });

  it("protocol mismatch trap → malformed, not auth_failed", () => {
    const parsed = parseRouterOsLoginResponse({
      status: false,
      message: "protocol mismatch on input",
    });
    expect(parsed.kind).toBe("malformed");
  });

  it("builds direct login sentences with real credentials", () => {
    expect(buildDirectLoginSentences("admin", "secret")).toEqual([
      "/login",
      "=name=admin",
      "=password=secret",
    ]);
  });

  it("builds challenge login after ret", () => {
    const response = computeRouterOsLoginResponse(
      "abcdef",
      "8ea3123a5743ad819d3953f3ed95a4c5"
    );
    expect(buildChallengeLoginSentences("admin", response)).toEqual([
      "/login",
      "=name=admin",
      `=response=${response}`,
    ]);
  });
});

describe("routeros challenge hash", () => {
  it("computes response hash with 00 prefix", () => {
    const response = computeRouterOsLoginResponse(
      "abcdef",
      "8ea3123a5743ad819d3953f3ed95a4c5"
    );
    expect(response).toBe("002941de48981a5bfbf1b0d873a65450a9");
  });
});

describe("routeros error mapping", () => {
  it("connection closed is not AUTH_FAILED", () => {
    const err = normalizeRouterOsConnectError(
      Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" })
    );
    expect((err as RouterOSConnectError).code).toBe("ROUTEROS_CONNECTION_CLOSED");
  });

  it("protocol mismatch is not AUTH_FAILED", () => {
    const err = normalizeRouterOsConnectError(
      new Error("protocol mismatch on unexpected token")
    );
    expect((err as RouterOSConnectError).code).toBe("ROUTEROS_PROTOCOL_UNCERTAIN");
  });

  it("SSL on custom port is not AUTH_FAILED", () => {
    const err = normalizeRouterOsConnectError(
      Object.assign(new Error("wrong version number"), {
        code: "ERR_SSL_WRONG_VERSION_NUMBER",
      })
    );
    expect((err as RouterOSConnectError).code).toBe("ROUTEROS_SSL_REQUIRED");
  });

  it("timeout is not AUTH_FAILED", () => {
    const err = normalizeRouterOsConnectError(
      new RouterOSConnectError("habis waktu", "ROUTEROS_CONNECT_TIMEOUT")
    );
    expect((err as RouterOSConnectError).code).toBe("ROUTEROS_CONNECT_TIMEOUT");
  });

  it("connection refused is not AUTH_FAILED", () => {
    const err = normalizeRouterOsConnectError(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    );
    expect((err as RouterOSConnectError).code).toBe("ROUTEROS_UNREACHABLE");
  });

  it("malformed login response is not AUTH_FAILED", () => {
    const err = normalizeRouterOsConnectError(
      new RouterOSConnectError("invalid", "ROUTEROS_MALFORMED_RESPONSE")
    );
    expect((err as RouterOSConnectError).code).toBe("ROUTEROS_MALFORMED_RESPONSE");
  });

  it("explicit wrong password maps to AUTH_FAILED", () => {
    const err = normalizeRouterOsConnectError(
      new Error("invalid user name or password (6)")
    );
    expect((err as RouterOSConnectError).code).toBe("ROUTEROS_AUTH_FAILED");
  });
});

describe("preflight socket cleanup", () => {
  it("destroyPreflightSocket always closes socket on error path", () => {
    const socket = {
      removeAllListeners: vi.fn(),
      setTimeout: vi.fn(),
      destroy: vi.fn(),
    };
    destroyPreflightSocket(socket as unknown as import("node:net").Socket);
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.setTimeout).toHaveBeenCalledWith(0);
    expect(socket.destroy).toHaveBeenCalled();
  });
});
