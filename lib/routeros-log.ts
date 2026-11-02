import { logger } from "@/lib/logger";

export type RouterOsLogPhase =
  | "connect_start"
  | "connect_ok"
  | "timeout"
  | "forceDestroy"
  | "request_done"
  | "request_error"
  | "request_finally"
  | "before_watchdog_create"
  | "watchdog_created"
  | "before_promise_race"
  | "operation_started"
  | "watchdog_fired"
  | "finally_enter"
  | "getPPPProfiles_enter"
  | "ppp_profiles_wrapper_enter"
  | "preflight_start"
  | "preflight_skip"
  | "preflight_ssl_port"
  | "preflight_protocol_mismatch"
  | "preflight_uncertain"
  | "preflight_ok"
  | "login_direct_start"
  | "login_challenge_response"
  | "login_ok";

/** Fase debug sementara — juga ditulis ke stderr agar tidak tertahan buffer pino. */
const DEBUG_PHASES = new Set<RouterOsLogPhase>([
  "connect_start",
  "before_watchdog_create",
  "watchdog_created",
  "before_promise_race",
  "operation_started",
  "watchdog_fired",
  "timeout",
  "forceDestroy",
  "request_finally",
  "finally_enter",
  "getPPPProfiles_enter",
  "ppp_profiles_wrapper_enter",
  "preflight_start",
  "preflight_skip",
  "preflight_ssl_port",
  "preflight_protocol_mismatch",
  "preflight_uncertain",
  "preflight_ok",
  "login_direct_start",
  "login_challenge_response",
  "login_ok",
]);

export function logRouterOsSession(
  phase: RouterOsLogPhase,
  label: string,
  extra?: Record<string, unknown>
): void {
  const payload = { msg: `[RouterOS] ${phase}`, label, ...extra };
  logger.info(payload);
  if (DEBUG_PHASES.has(phase)) {
    console.error(JSON.stringify(payload));
  }
}
