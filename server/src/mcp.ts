// درگاه MCP: اجازه می‌دهد Claude (یا هر دستیار سازگار با MCP) کارهای یادنگار را ببیند و بچیند.
// هر کاربر یک آدرس محرمانه دارد: /mcp/<کلید>. هر تغییری مثل یک دستگاه دیگر ثبت می‌شود
// و چند ثانیه بعد با همگام‌سازی معمولی به ویندوز و گوشی می‌رسد.
import { jalaliMonthLength, toGregorian, toJalali } from "./jalali";

interface Env {
  DB: D1Database;
}

const TZ = "Asia/Tehran";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const MAX_TASKS_PER_CALL = 60;

interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD میلادی
  time?: string;
  important: boolean;
  done: boolean;
  createdAt: number;
  updatedAt?: number;
  order?: number;
  snoozedUntil?: number;
  [k: string]: unknown;
}

// ---------- تاریخ ----------
const pad = (n: number) => String(n).padStart(2, "0");
const enDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** تاریخ امروز به وقت ایران، به شکل YYYY-MM-DD میلادی */
function todayKey(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // en-CA → 2026-11-06
}

function nowTime(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function weekday(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function describeDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const j = toJalali(y, m, d);
  return `${weekday(key)} ${j.jd} ${MONTHS[j.jm - 1]} ${j.jy} (${j.jy}/${pad(j.jm)}/${pad(j.jd)} شمسی، ${key} میلادی)`;
}

function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** تاریخ ورودی: شمسی (۱۴۰۵/۰۸/۱۶) یا میلادی (2026-11-06) یا today/tomorrow → کلید میلادی */
function parseDate(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) throw new ToolError("تاریخ لازم است (مثلاً 1405/08/16 یا 2026-11-06).");
  const s = enDigits(input.trim().toLowerCase());
  if (s === "today" || s === "امروز") return todayKey();
  if (s === "tomorrow" || s === "فردا") return addDays(todayKey(), 1);
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (!m) throw new ToolError(`تاریخ «${input}» قابل فهم نیست. شکل درست: 1405/08/16 (شمسی) یا 2026-11-06 (میلادی).`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1700) {
    if (mo < 1 || mo > 12 || d < 1 || d > jalaliMonthLength(y, mo)) throw new ToolError(`تاریخ شمسی «${input}» وجود ندارد.`);
    const g = toGregorian(y, mo, d);
    return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
  }
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) throw new ToolError(`تاریخ میلادی «${input}» وجود ندارد.`);
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function parseTime(input: unknown): string | undefined {
  if (input === undefined || input === null || input === "") return undefined;
  if (typeof input !== "string") throw new ToolError("ساعت باید متن باشد، مثل 14:30.");
  const m = /^(\d{1,2}):(\d{2})$/.exec(enDigits(input.trim()));
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new ToolError(`ساعت «${input}» درست نیست. شکل ۲۴ ساعته بده، مثل 09:00 یا 18:30.`);
  return `${pad(Number(m[1]))}:${m[2]}`;
}

// ---------- داده ----------
class ToolError extends Error {}

async function loadTasks(env: Env, userId: string): Promise<Task[]> {
  const rs = await env.DB.prepare("SELECT data FROM tasks WHERE user_id = ? AND deleted = 0").bind(userId).all<{ data: string }>();
  return rs.results.map((r) => JSON.parse(r.data) as Task).filter((t) => t && t.id);
}

/** ذخیرهٔ کارها مثل یک دستگاه دیگر: rev تازه می‌گیرند تا دستگاه‌ها در همگام‌سازی بعدی دریافتشان کنند */
async function writeTasks(env: Env, userId: string, rows: { id: string; task: Task | null; updatedAt: number }[]) {
  if (!rows.length) return;
  const n = rows.length;
  const c = await env.DB.prepare(
    "INSERT INTO counters (user_id, rev) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET rev = rev + ? RETURNING rev"
  )
    .bind(userId, n, n)
    .first<{ rev: number }>();
  let rev = c!.rev - n;
  await env.DB.batch(
    rows.map((r) =>
      env.DB.prepare(
        `INSERT INTO tasks (user_id, id, data, deleted, updated_at, rev) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at, rev = excluded.rev`
      ).bind(userId, r.id, r.task ? JSON.stringify(r.task) : null, r.task ? 0 : 1, r.updatedAt, ++rev)
    )
  );
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function line(t: Task) {
  const flags = [t.done ? "✓ انجام شده" : "انجام نشده", t.important ? "⭐ مهم" : ""].filter(Boolean).join("، ");
  return `- [${t.id}] ${t.title} — ${describeDate(t.date)}${t.time ? `، ساعت ${t.time}` : "، بدون ساعت"} — ${flags}`;
}

function sortTasks(list: Task[]) {
  return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time ?? "99") < (b.time ?? "99") ? -1 : (a.time ?? "99") > (b.time ?? "99") ? 1 : (a.order ?? 0) - (b.order ?? 0)));
}

function findTask(tasks: Task[], id: unknown) {
  const t = tasks.find((x) => x.id === id);
  if (!t) throw new ToolError(`کاری با شناسهٔ «${String(id)}» پیدا نشد. اول get_tasks را صدا بزن تا شناسه‌ها را ببینی.`);
  return t;
}

// ---------- ابزارها ----------
function todayLine() {
  const k = todayKey();
  return `امروز به وقت ایران ${describeDate(k)} است و ساعت ${nowTime()}.`;
}

function toolDefs() {
  const dateHelp = "تاریخ شمسی مثل 1405/08/16، یا میلادی مثل 2026-11-06، یا today / tomorrow.";
  return [
    {
      name: "get_tasks",
      title: "دیدن کارهای یادنگار",
      description: `کارهای یادنگار کاربر را برمی‌گرداند، با شناسه، تاریخ شمسی و میلادی، ساعت و وضعیت. ${todayLine()} بدون بازهٔ تاریخ: کارهای انجام‌نشدهٔ گذشته + همهٔ کارهای امروز به بعد.`,
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: `شروع بازه (اختیاری). ${dateHelp}` },
          to: { type: "string", description: `پایان بازه (اختیاری). ${dateHelp}` },
          include_done: { type: "boolean", description: "کارهای انجام‌شده هم بیاید؟ پیش‌فرض: true" },
          search: { type: "string", description: "فقط کارهایی که عنوانشان این متن را دارد (اختیاری)" },
        },
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "add_tasks",
      title: "افزودن کار به یادنگار",
      description: `یک یا چند کار به یادنگار اضافه می‌کند. اگر ساعت داده شود، سر همان ساعت روی ویندوز و گوشی یادآوری می‌شود. ${todayLine()} عنوان را کوتاه و فارسی بنویس.`,
      inputSchema: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            minItems: 1,
            maxItems: MAX_TASKS_PER_CALL,
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "عنوان کار" },
                date: { type: "string", description: dateHelp },
                time: { type: "string", description: "ساعت یادآوری ۲۴ ساعته مثل 09:30 (اختیاری؛ بدون آن یادآوری نمی‌شود)" },
                important: { type: "boolean", description: "کار مهم است؟ (ستاره)" },
              },
              required: ["title", "date"],
            },
          },
        },
        required: ["tasks"],
      },
    },
    {
      name: "update_task",
      title: "ویرایش کار یادنگار",
      description: "یک کار موجود را تغییر می‌دهد: عنوان، تاریخ، ساعت، مهم بودن، یا انجام شدن. فقط فیلدهایی را بفرست که باید عوض شوند. برای برداشتن ساعت، time را رشتهٔ خالی بفرست.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "شناسهٔ کار (از get_tasks)" },
          title: { type: "string" },
          date: { type: "string", description: dateHelp },
          time: { type: "string", description: "ساعت ۲۴ ساعته مثل 14:00، یا رشتهٔ خالی برای برداشتن" },
          important: { type: "boolean" },
          done: { type: "boolean", description: "true یعنی انجام شد" },
        },
        required: ["id"],
      },
    },
    {
      name: "delete_task",
      title: "حذف کار از یادنگار",
      description: "یک کار را برای همیشه از یادنگار و همهٔ دستگاه‌ها حذف می‌کند.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "شناسهٔ کار (از get_tasks)" } },
        required: ["id"],
      },
      annotations: { destructiveHint: true },
    },
  ];
}

type Args = Record<string, unknown>;

async function callTool(env: Env, userId: string, name: string, args: Args): Promise<string> {
  const tasks = await loadTasks(env, userId);
  const now = Date.now();

  if (name === "get_tasks") {
    const today = todayKey();
    const from = args.from ? parseDate(args.from) : null;
    const to = args.to ? parseDate(args.to) : null;
    const includeDone = args.include_done !== false;
    const q = typeof args.search === "string" ? args.search.trim() : "";
    const list = sortTasks(
      tasks.filter((t) => {
        if (!includeDone && t.done) return false;
        if (q && !t.title.includes(q)) return false;
        if (from || to) return (!from || t.date >= from) && (!to || t.date <= to);
        return t.date >= today || !t.done;
      })
    );
    if (!list.length) return `${todayLine()}\nکاری در این بازه نیست.`;
    return `${todayLine()}\n${list.length} کار:\n${list.slice(0, 300).map(line).join("\n")}`;
  }

  if (name === "add_tasks") {
    const items = Array.isArray(args.tasks) ? (args.tasks as Args[]) : [];
    if (!items.length) throw new ToolError("دست‌کم یک کار بفرست.");
    if (items.length > MAX_TASKS_PER_CALL) throw new ToolError(`حداکثر ${MAX_TASKS_PER_CALL} کار در هر بار.`);
    let order = Math.max(0, ...tasks.map((t) => t.order ?? 0));
    const made: Task[] = items.map((it, i) => {
      const title = typeof it.title === "string" ? it.title.trim().slice(0, 300) : "";
      if (!title) throw new ToolError(`کار شمارهٔ ${i + 1} عنوان ندارد.`);
      return {
        id: newId() + i,
        title,
        date: parseDate(it.date),
        time: parseTime(it.time),
        important: it.important === true,
        done: false,
        createdAt: now,
        updatedAt: now,
        order: ++order,
      };
    });
    await writeTasks(env, userId, made.map((t) => ({ id: t.id, task: t, updatedAt: now })));
    return `${made.length} کار به یادنگار اضافه شد (چند ثانیه بعد روی دستگاه‌ها دیده می‌شود):\n${made.map(line).join("\n")}`;
  }

  if (name === "update_task") {
    const t = { ...findTask(tasks, args.id) };
    if (args.title !== undefined) {
      const title = String(args.title).trim().slice(0, 300);
      if (!title) throw new ToolError("عنوان نمی‌تواند خالی باشد.");
      t.title = title;
    }
    if (args.date !== undefined || args.time !== undefined) {
      if (args.date !== undefined) t.date = parseDate(args.date);
      if (args.time !== undefined) t.time = parseTime(args.time);
      delete t.snoozedUntil;
    }
    if (typeof args.important === "boolean") t.important = args.important;
    if (typeof args.done === "boolean") t.done = args.done;
    t.updatedAt = Math.max(now, (t.updatedAt ?? 0) + 1);
    if (t.time === undefined) delete t.time;
    await writeTasks(env, userId, [{ id: t.id, task: t, updatedAt: t.updatedAt }]);
    return `به‌روز شد:\n${line(t)}`;
  }

  if (name === "delete_task") {
    const t = findTask(tasks, args.id);
    await writeTasks(env, userId, [{ id: t.id, task: null, updatedAt: Math.max(now, (t.updatedAt ?? 0) + 1) }]);
    return `حذف شد: ${t.title}`;
  }

  throw new ToolError(`ابزار ناشناخته: ${name}`);
}

// ---------- JSON-RPC روی HTTP ----------
interface RpcReq {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

async function handleOne(env: Env, userId: string, m: RpcReq) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: m.id ?? null, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: m.id ?? null, error: { code, message } });
  if (m.id === undefined || m.id === null) return null; // اعلان‌ها (notifications) پاسخ ندارند

  switch (m.method) {
    case "initialize": {
      const asked = String(m.params?.protocolVersion ?? "");
      return ok({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "yadnegar", title: "یادنگار", version: "1.0.0" },
        instructions:
          "یادنگار برنامهٔ کارها و یادآوری کاربر است (فارسی، تقویم شمسی، وقت ایران). برای برنامه‌ریزی، اول get_tasks را ببین تا تداخل نشود، بعد با add_tasks کارها را اضافه کن. تاریخ‌ها را ترجیحاً شمسی بده. بعد از هر تغییر، خلاصه‌اش را به فارسی به کاربر بگو.",
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: toolDefs() });
    case "tools/call": {
      const name = String(m.params?.name ?? "");
      const args = (m.params?.arguments ?? {}) as Args;
      try {
        const text = await callTool(env, userId, name, args);
        return ok({ content: [{ type: "text", text }] });
      } catch (e) {
        if (e instanceof ToolError) return ok({ content: [{ type: "text", text: e.message }], isError: true });
        console.error("mcp tool failed", e);
        return ok({ content: [{ type: "text", text: "خطای داخلی سرور یادنگار. دوباره امتحان کن." }], isError: true });
      }
    }
    case "resources/list":
      return ok({ resources: [] });
    case "prompts/list":
      return ok({ prompts: [] });
    default:
      return err(-32601, `Method not found: ${m.method}`);
  }
}

const MCP_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const rpcError = (status: number, code: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json", ...MCP_HEADERS },
  });

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleMcp(req: Request, env: Env, key: string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: MCP_HEADERS });
  const row = key
    ? await env.DB.prepare("SELECT user_id FROM mcp_keys WHERE key_hash = ?").bind(await sha256Hex(key)).first<{ user_id: string }>()
    : null;
  if (!row) return rpcError(404, -32001, "این آدرس اتصال یادنگار معتبر نیست یا باطل شده است.");
  // این سرور بدون حالت است و جریان SSE جداگانه ندارد
  if (req.method === "GET") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST", ...MCP_HEADERS } });
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: MCP_HEADERS });
  if (req.method !== "POST") return rpcError(405, -32000, "Method not allowed");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(400, -32700, "Parse error");
  }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as RpcReq[];
  const out = [];
  for (const m of msgs) {
    if (!m || typeof m !== "object") continue;
    const r = await handleOne(env, row.user_id, m);
    if (r) out.push(r);
  }
  if (!out.length) return new Response(null, { status: 202, headers: MCP_HEADERS });
  return new Response(JSON.stringify(batch ? out : out[0]), {
    status: 200,
    headers: { "Content-Type": "application/json", ...MCP_HEADERS },
  });
}

// ---------- مدیریت آدرس اتصال (از داخل برنامه) ----------
export async function createKey(env: Env, userId: string, origin: string) {
  const b = crypto.getRandomValues(new Uint8Array(24));
  const key = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM mcp_keys WHERE user_id = ?").bind(userId),
    env.DB.prepare("INSERT INTO mcp_keys (key_hash, user_id, created_at) VALUES (?, ?, ?)").bind(await sha256Hex(key), userId, Date.now()),
  ]);
  return { url: `${origin}/mcp/${key}` };
}

export async function revokeKey(env: Env, userId: string) {
  await env.DB.prepare("DELETE FROM mcp_keys WHERE user_id = ?").bind(userId).run();
  return { ok: true };
}

export async function keyStatus(env: Env, userId: string) {
  const r = await env.DB.prepare("SELECT created_at FROM mcp_keys WHERE user_id = ?").bind(userId).first<{ created_at: number }>();
  return { active: !!r, createdAt: r?.created_at ?? null };
}
