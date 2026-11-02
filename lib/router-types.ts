export type SystemResource = {
  uptime: string;
  version: string;
  "build-time": string;
  "factory-software": string;
  "free-memory": string;
  "total-memory": string;
  cpu: string;
  "cpu-count": string;
  "cpu-frequency": string;
  "cpu-load": string;
  "free-hdd-space": string;
  "total-hdd-space": string;
  "architecture-name": string;
  "board-name": string;
  platform: string;
};

export type ToolNetwatch = {
  id: string;
  host: string;
  timeout: string;
  interval: string;
  since: string;
  status: string;
  upScript: string;
  downScript: string;
  disabled: boolean;
};

export type ServicePPP =
  | "any"
  | "async"
  | "isdn"
  | "l2tp"
  | "pppoe"
  | "pptp"
  | "ovpn"
  | "sstp";

export type PPPActive = {
  ".id": string;
  name: string;
  service: ServicePPP;
  "caller-id": string;
  address: string;
  uptime: string;
  encoding: string;
  "session-id": string;
  "limit-bytes-in": string;
  "limit-bytes-out": string;
  radius: string;
  comment?: string;
};

export type PPPSecret = {
  ".id": string;
  name: string;
  service: ServicePPP;
  "caller-id": string;
  password: string;
  profile: string;
  routes: string;
  "ipv6-routes": string;
  "limit-bytes-in": string;
  "limit-bytes-out": string;
  "last-logged-out": string;
  "last-caller-id"?: string;
  "last-disconnect-reason"?: string;
  disabled: string;
  comment?: string;
};

export type PPPProfile = {
  ".id": string;
  name: string;
  "local-address"?: string;
  "remote-address"?: string;
  "rate-limit"?: string;
  "dns-server"?: string;
  comment?: string;
};

export type PPP = {
  ".id": string;
  ".id_active": string;
  name: string;
  service: ServicePPP;
  "caller-id": string;
  address?: string;
  uptime?: string;
  encoding?: string;
  "session-id"?: string;
  "limit-bytes-in": string;
  "limit-bytes-out": string;
  radius?: string;
  comment: string;
  password?: string;
  profile?: string;
  routes?: string;
  "ipv6-routes"?: string;
  "last-logged-out"?: string;
  "last-caller-id"?: string;
  "last-disconnect-reason"?: string;
  disabled?: string;
};

export type MonitorTraffic = {
  tx: string;
  rx: string;
};

export type InterfaceMonitor = {
  name: string;
  "rx-bits-per-second": string;
  "tx-bits-per-second": string;
  "fp-rx-bits-per-second": string;
  "fp-tx-bits-per-second": string;
};
