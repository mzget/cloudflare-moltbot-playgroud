const b64url = (input: ArrayBuffer | string): string => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Test-only: sign an HS256 JWT compatible with `verifyJwt`. */
export async function signJwt(payload: object, secret: string): Promise<string> {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

/** Test-only: minimal D1 fake that records prepared SQL and bound args. */
export function createFakeDb(options: { results?: unknown[]; failOn?: RegExp } = {}) {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  const make = (sql: string, args: unknown[]) => {
    const exec = async () => {
      if (options.failOn?.test(sql)) throw new Error("db failure");
      return { results: options.results ?? [], meta: { changes: 1, duration: 2, last_row_id: 3 } };
    };
    return {
      bind: (...bound: unknown[]) => make(sql, bound),
      run: async () => { calls.push({ sql, args }); return exec(); },
      all: async () => { calls.push({ sql, args }); return exec(); },
    };
  };
  return { calls, db: { prepare: (sql: string) => make(sql, []) } };
}
