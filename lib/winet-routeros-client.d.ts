/**
 * Type declaration for @winet/routeros-client (no official types; installed from GitHub).
 */
declare module "@winet/routeros-client" {
  export interface CreateClientOptions {
    host: string;
    port?: number;
    debug?: boolean;
  }

  export interface CommandBuilder {
    setAttrs(attrs: Record<string, string>): this;
    equal(name: string, value: string): this;
    get(): Promise<unknown>;
  }

  export interface RouterOSClientInstance {
    login(user: string, password: string): Promise<void>;
    close(): void;
    command(cmd: string): CommandBuilder;
  }

  function createClient(options: CreateClientOptions): RouterOSClientInstance;

  const routerosClient: {
    createClient: typeof createClient;
  };

  export default routerosClient;
}
