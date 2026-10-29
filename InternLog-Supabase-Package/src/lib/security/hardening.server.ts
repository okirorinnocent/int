// bun add postgres @supabase/supabase-js @supabase/ssr
// Server-only (*.server.ts). Never import from client code.
import { createMiddleware } from "@tanstack/react-start";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

/* ── Env (set in Vercel → Settings → Environment Variables) ──
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY            (server only)
   DATABASE_POOLER_URL     postgres://authenticated-capable role @ :6543 (transaction pooler)
   INTERNAI_DB_URL         postgres://internai_agent.<ref>:...@...:6543/postgres?sslmode=require */

let _admin: ReturnType<typeof createClient> | undefined;
function getAdmin() {
  return (_admin ??= createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

// prepare:false is REQUIRED with the transaction pooler (no session-level prepared statements)
let _sql: ReturnType<typeof postgres> | undefined;
export const getSql = () => (_sql ??= postgres(process.env["DATABASE_POOLER_URL"]!, { prepare: false, max: 5, idle_timeout: 20, ssl: "require" }));
let _agent: ReturnType<typeof postgres> | undefined;
export const getAgentSql = () => (_agent ??= postgres(process.env["INTERNAI_DB_URL"]!, { prepare: false, max: 3, idle_timeout: 10, ssl: "require" }));

/* ── Cookies: pass to createServerClient({ cookieOptions }) ── */
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,   // blocks cross-site POST CSRF; keeps magic-link redirects working
  path: "/",
  maxAge: 60 * 60 * 8,        // 8h; refresh token rotation handled by Supabase
};

export const securityHeaders: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: blob: https://*.supabase.co; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
};

/* ── Client identity: IP + device hash. (MAC addresses never reach a web server — they are
   stripped at the first router — so we bind to IP + User-Agent/client fingerprint instead.) ── */
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "0.0.0.0";
}

/* ── Middleware 1: IP/device guard + per-IP and per-user rate limits ── */
export const guardMiddleware = createMiddleware().server(async ({ next, request }) => {
  const ip = clientIp(request);
  const ipOk = await getAdmin().rpc("check_rate_limit", { _key: `ip:${ip}`, _limit: 120, _window_seconds: 60 });
  if (ipOk.data === false) throw new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } });

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  let userId: string | null = null;
  if (token) {
    const { data } = await getAdmin().auth.getUser(token); // verifies JWT with Supabase Auth, not just decodes
    userId = data.user?.id ?? null;
  }
  if (userId) {
    const device = await sha256((request.headers.get("user-agent") ?? "") + (request.headers.get("x-device-id") ?? ""));
    const [userOk, accessOk] = await Promise.all([
      getAdmin().rpc("check_rate_limit", { _key: `user:${userId}`, _limit: 60, _window_seconds: 60 }),
      getAdmin().rpc("register_access", { _user: userId, _ip: ip, _device: device }),
    ]);
    if (userOk.data === false) throw new Response("Too many requests", { status: 429 });
    if (accessOk.data === false) throw new Response("Suspicious activity: too many devices/locations", { status: 403 });
  }
  const res = await next({ context: { userId, ip } });
  const headers = (res as { response?: { headers?: Headers } }).response?.headers;
  if (headers) for (const [k, v] of Object.entries(securityHeaders)) headers.set(k, v);
  return res;
});

/* ── Middleware 2: one TRANSACTION per request, RLS identity set with SET LOCAL ──
   Safe on the transaction pooler because everything is scoped to the transaction. */
export async function withUserTx<T>(userId: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return getSql().begin(async (tx) => {
    await tx`select set_config('role', 'authenticated', true)`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx`set local statement_timeout = '5s'`;
    return fn(tx); // commits on return, rolls back on throw
  }) as Promise<T>;
}

/* ── InternAI: agent sees ONLY the asking student's rows for this transaction ── */
export async function withAgentScope<T>(studentId: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return getAgentSql().begin(async (tx) => {
    await tx`select set_config('app.student_id', ${studentId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

/* Usage in a server function:
   export const askInternAI = createServerFn({ method: "POST" })
     .middleware([guardMiddleware])
     .handler(async ({ context, data }) => {
       const ok = await getAdmin().rpc("check_rate_limit", { _key: `ai:${context.userId}`, _limit: 10, _window_seconds: 60 });
       if (ok.data === false) throw new Response("InternAI limit reached", { status: 429 });
       return withAgentScope(context.userId!, async (tx) => { ... });
     }); */
