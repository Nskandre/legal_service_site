declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

// The starter keeps D1 optional; Wrangler replaces this global with the full runtime type when D1 is enabled.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Database = any;
