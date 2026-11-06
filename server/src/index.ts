// سرور یادنگار روی Cloudflare Workers + D1
// ورود با ایمیل و کد یک‌بارمصرف، و همگام‌سازی کارها و تنظیمات بین دستگاه‌ها
import { WorkerMailer } from "worker-mailer";

export interface Env {
  DB: D1Database;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  /** فقط برای آزمایش محلی: کد به‌جای ایمیل در پاسخ برگردانده می‌شود. هرگز در نسخهٔ واقعی تنظیم نشود. */
  DEV_RETURN_CODE?: string;
}

const CODE_TTL_MS = 10 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_TASKS_PER_SYNC = 2000;
const MAX_ITEM_BYTES = 16_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
const fail = (status: number, error: string) => json({ error }, status);

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const normEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");
const validEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function toFaDigits(s: string) {
  return s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

async function sendCodeEmail(env: Env, to: string, code: string) {
  if (!env.SMTP_USER || !env.SMTP_PASS) throw new Error("email not configured");
  const first = Number(env.SMTP_PORT || 465);
  try {
    await sendVia(env, first, to, code);
  } catch (e) {
    // اگر یک درگاه نشد، درگاه دیگر جیمیل را امتحان کن
    const alt = first === 465 ? 587 : 465;
    try {
      await sendVia(env, alt, to, code);
    } catch (e2) {
      throw new Error(`${first}: ${errText(e)} | ${alt}: ${errText(e2)}`);
    }
  }
}

function errText(e: unknown) {
  const m = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return m.slice(0, 400);
}

async function sendVia(env: Env, port: number, to: string, code: string) {
  const html = `<!doctype html><html dir="rtl" lang="fa"><body style="margin:0;background:#0a0a0a;font-family:Tahoma,Arial,sans-serif">
  <div style="max-width:420px;margin:32px auto;padding:28px;border-radius:24px;background:#161618;color:#fff;border:1px solid #2a2a2e;text-align:center">
    <div style="font-size:15px;color:#aaa">کد ورود به یادنگار</div>
    <div style="margin:18px 0;font-size:40px;font-weight:bold;letter-spacing:10px;direction:ltr">${code}</div>
    <div style="font-size:13px;color:#888;line-height:24px">این کد تا ۱۰ دقیقه معتبر است.<br>اگر خودت درخواست نداده‌ای، این ایمیل را نادیده بگیر.</div>
  </div></body></html>`;
  await WorkerMailer.send(
    {
      host: env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      startTls: port !== 465,
      credentials: { username: env.SMTP_USER!.trim(), password: env.SMTP_PASS!.replace(/\s+/g, "") },
      authType: ["plain", "login"],
    },
    {
      from: { name: "یادنگار", email: env.SMTP_USER!.trim() },
      to,
      subject: `کد ورود یادنگار: ${toFaDigits(code)}`,
      text: `کد ورود به یادنگار: ${code}\nاین کد تا ۱۰ دقیقه معتبر است.`,
      html,
    }
  );
}

// ---------- ورود ----------
async function requestCode(req: Request, env: Env) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = normEmail(body.email);
  if (!validEmail(email)) return fail(400, "invalid_email");

  const now = Date.now();
  const prev = await env.DB.prepare("SELECT sent_at FROM login_codes WHERE email = ?").bind(email).first<{ sent_at: number }>();
  if (prev && now - prev.sent_at < RESEND_AFTER_MS) return fail(429, "too_soon");

  const code = randomCode();
  await env.DB.prepare(
    `INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`
  )
    .bind(email, await sha256(`${email}:${code}`), now + CODE_TTL_MS, now)
    .run();

  if (env.DEV_RETURN_CODE === "1") return json({ ok: true, devCode: code });
  try {
    await sendCodeEmail(env, email, code);
  } catch (e) {
    console.error("send failed", e);
    // آخرین خطای ایمیل برای عیب‌یابی (بدون رمز)
    await env.DB.prepare("INSERT INTO diag (key, value, at) VALUES ('mail', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, at = excluded.at")
      .bind(errText(e).slice(0, 900), Date.now())
      .run()
      .catch(() => {});
    await env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(email).run();
    return fail(502, "email_failed");
  }
  return json({ ok: true });
}

async function verifyCode(req: Request, env: Env) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; code?: string; device?: string };
  const email = normEmail(body.email);
  const code = String(body.code ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");
  if (!validEmail(email) || code.length !== 6) return fail(400, "invalid_code");

  const row = await env.DB.prepare("SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?")
    .bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>();
  const now = Date.now();
  if (!row || row.expires_at < now || row.attempts >= MAX_ATTEMPTS) return fail(400, "expired");
  if ((await sha256(`${email}:${code}`)) !== row.code_hash) {
    await env.DB.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
    return fail(400, "wrong_code");
  }

  let user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  if (!user) {
    user = { id: crypto.randomUUID() };
    await env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)").bind(user.id, email, now).run();
  }
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(email),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_id, device, created_at, last_seen) VALUES (?, ?, ?, ?, ?)").bind(
      await sha256(token),
      user.id,
      String(body.device ?? "").slice(0, 60),
      now,
      now
    ),
  ]);
  return json({ token, email });
}

async function authUser(req: Request, env: Env): Promise<string | null> {
  const m = /^Bearer\s+(.+)$/.exec(req.headers.get("Authorization") || "");
  if (!m) return null;
  const s = await env.DB.prepare("SELECT user_id, last_seen FROM sessions WHERE token_hash = ?")
    .bind(await sha256(m[1]))
    .first<{ user_id: string; last_seen: number }>();
  if (!s) return null;
  if (Date.now() - s.last_seen > 6 * 3600_000) {
    await env.DB.prepare("UPDATE sessions SET last_seen = ? WHERE token_hash = ?").bind(Date.now(), await sha256(m[1])).run();
  }
  return s.user_id;
}

async function logout(req: Request, env: Env) {
  const m = /^Bearer\s+(.+)$/.exec(req.headers.get("Authorization") || "");
  if (m) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(m[1])).run();
  return json({ ok: true });
}

// ---------- همگام‌سازی ----------
interface IncomingTask {
  id: string;
  data?: unknown;
  deleted?: boolean;
  updatedAt: number;
}

async function sync(req: Request, env: Env, userId: string) {
  const body = (await req.json().catch(() => null)) as {
    since?: number;
    tasks?: IncomingTask[];
    settings?: { data: unknown; updatedAt: number } | null;
  } | null;
  if (!body) return fail(400, "bad_request");
  const since = Number(body.since) || 0;
  const incoming = Array.isArray(body.tasks) ? body.tasks.slice(0, MAX_TASKS_PER_SYNC) : [];

  // فقط تغییرهایی که از نسخهٔ سرور جدیدترند پذیرفته می‌شوند (آخرین ویرایش برنده است)
  const accepted: { id: string; data: string | null; deleted: number; updatedAt: number }[] = [];
  if (incoming.length) {
    const ids = incoming.map((t) => String(t.id));
    const existing = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      const rs = await env.DB.prepare(
        `SELECT id, updated_at FROM tasks WHERE user_id = ? AND id IN (${chunk.map(() => "?").join(",")})`
      )
        .bind(userId, ...chunk)
        .all<{ id: string; updated_at: number }>();
      for (const r of rs.results) existing.set(r.id, r.updated_at);
    }
    for (const t of incoming) {
      const id = String(t.id).slice(0, 64);
      const updatedAt = Number(t.updatedAt) || 0;
      if (!id || updatedAt <= (existing.get(id) ?? -1)) continue;
      const data = t.deleted ? null : JSON.stringify(t.data ?? null);
      if (data && data.length > MAX_ITEM_BYTES) continue;
      accepted.push({ id, data, deleted: t.deleted ? 1 : 0, updatedAt });
    }
  }

  let settingsAccepted: { data: string; updatedAt: number } | null = null;
  if (body.settings && body.settings.updatedAt) {
    const cur = await env.DB.prepare("SELECT updated_at FROM settings WHERE user_id = ?").bind(userId).first<{ updated_at: number }>();
    const data = JSON.stringify(body.settings.data ?? {});
    if ((!cur || body.settings.updatedAt > cur.updated_at) && data.length <= 64_000) {
      settingsAccepted = { data, updatedAt: Number(body.settings.updatedAt) };
    }
  }

  const n = accepted.length + (settingsAccepted ? 1 : 0);
  let top: number;
  if (n) {
    const c = await env.DB.prepare(
      "INSERT INTO counters (user_id, rev) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET rev = rev + ? RETURNING rev"
    )
      .bind(userId, n, n)
      .first<{ rev: number }>();
    top = c!.rev;
    let rev = top - n;
    const stmts = accepted.map((t) =>
      env.DB.prepare(
        `INSERT INTO tasks (user_id, id, data, deleted, updated_at, rev) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at, rev = excluded.rev`
      ).bind(userId, t.id, t.data, t.deleted, t.updatedAt, ++rev)
    );
    if (settingsAccepted) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO settings (user_id, data, updated_at, rev) VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, rev = excluded.rev`
        ).bind(userId, settingsAccepted.data, settingsAccepted.updatedAt, ++rev)
      );
    }
    for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
  } else {
    const c = await env.DB.prepare("SELECT rev FROM counters WHERE user_id = ?").bind(userId).first<{ rev: number }>();
    top = c?.rev ?? 0;
  }

  // تغییرهای دستگاه‌های دیگر از آخرین همگام‌سازی این دستگاه
  const changed = await env.DB.prepare(
    "SELECT id, data, deleted, updated_at FROM tasks WHERE user_id = ? AND rev > ? AND rev <= ? ORDER BY rev LIMIT 5000"
  )
    .bind(userId, since, top)
    .all<{ id: string; data: string | null; deleted: number; updated_at: number }>();
  const s = await env.DB.prepare("SELECT data, updated_at, rev FROM settings WHERE user_id = ?")
    .bind(userId)
    .first<{ data: string; updated_at: number; rev: number }>();

  return json({
    cursor: top,
    tasks: changed.results.map((r) => ({
      id: r.id,
      deleted: !!r.deleted,
      updatedAt: r.updated_at,
      data: r.data ? JSON.parse(r.data) : null,
    })),
    settings: s && s.rev > since ? { data: JSON.parse(s.data), updatedAt: s.updated_at } : null,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const { pathname } = new URL(req.url);
    try {
      if (pathname === "/" || pathname === "/health") return json({ ok: true, service: "yadnegar" });
      if (req.method !== "POST") return fail(405, "method_not_allowed");
      if (pathname === "/auth/request") return await requestCode(req, env);
      if (pathname === "/auth/verify") return await verifyCode(req, env);
      if (pathname === "/auth/logout") return await logout(req, env);
      if (pathname === "/sync") {
        const userId = await authUser(req, env);
        if (!userId) return fail(401, "unauthorized");
        return await sync(req, env, userId);
      }
      return fail(404, "not_found");
    } catch (e) {
      console.error(e);
      return fail(500, "server_error");
    }
  },
};
