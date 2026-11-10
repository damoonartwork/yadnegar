// ویس: صدا → متن (Whisper) → کارهای جدا (مدل زبانی). هیچ صدایی ذخیره نمی‌شود.
import { toJalali } from "./jalali";
import { addDays, nowTime, parseDate, parseTime, todayKey, weekday } from "./mcp";

interface Env {
  DB: D1Database;
  AI?: Ai;
  /** فقط آزمایش محلی: بدون Workers AI، متن ثابت برمی‌گرداند */
  DEV_RETURN_CODE?: string;
}

export const VOICE_DAILY_LIMIT = 30;
const MAX_BYTES = 6 * 1024 * 1024; // ~۳ دقیقه WAV ۱۶ کیلوهرتز
const WHISPER = "@cf/openai/whisper-large-v3-turbo";
const LLMS = ["@cf/openai/gpt-oss-120b", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"] as const;
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

export interface VoiceTask {
  title: string;
  date: string;
  time?: string;
  important: boolean;
}

export class VoiceError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function jalaliLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const j = toJalali(y, m, d);
  return `${weekday(key)} ${j.jd} ${MONTHS[j.jm - 1]} ${j.jy}`;
}

/** سهمیهٔ روزانهٔ هر نفر؛ پیش از کار سنگین یکی کم می‌شود */
async function takeQuota(env: Env, userId: string) {
  const day = todayKey();
  const r = await env.DB.prepare(
    `INSERT INTO voice_usage (user_id, day, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1 RETURNING count`
  )
    .bind(userId, day)
    .first<{ count: number }>();
  const used = r?.count ?? 1;
  if (used > VOICE_DAILY_LIMIT) throw new VoiceError("voice_limit", 429);
  return VOICE_DAILY_LIMIT - used;
}

async function refundQuota(env: Env, userId: string) {
  await env.DB.prepare("UPDATE voice_usage SET count = MAX(0, count - 1) WHERE user_id = ? AND day = ?")
    .bind(userId, todayKey())
    .run()
    .catch(() => {});
}

function aiFailure(e: unknown): VoiceError {
  const msg = String((e as Error)?.message ?? e);
  console.error("workers ai failed", msg);
  // سهمیهٔ روزانهٔ Workers AI تمام شده
  if (/neuron|limit|quota|429|exceeded/i.test(msg)) return new VoiceError("ai_quota", 503);
  return new VoiceError("ai_error", 502);
}

async function transcribe(env: Env, audio: Uint8Array): Promise<string> {
  if (!env.AI) {
    if (env.DEV_RETURN_CODE) return "فردا ساعت ده صبح جلسه با علی. امروز دامنه جدید رو بخرم، مهمه. پنجشنبه تیزر فاطمیه رو تحویل بدم.";
    throw new VoiceError("ai_error", 502);
  }
  try {
    const r = (await env.AI.run(WHISPER as never, { audio: toBase64(audio), language: "fa", task: "transcribe", vad_filter: true } as never)) as {
      text?: string;
    };
    return (r?.text ?? "").trim();
  } catch (e) {
    throw aiFailure(e);
  }
}

function buildPrompt(text: string) {
  const today = todayKey();
  const days: string[] = [];
  for (let i = -1; i <= 21; i++) {
    const k = addDays(today, i);
    const tag = i === -1 ? " (دیروز)" : i === 0 ? " (امروز)" : i === 1 ? " (فردا)" : i === 2 ? " (پس‌فردا)" : "";
    days.push(`${k} = ${jalaliLabel(k)}${tag}`);
  }
  const system = `You turn a Persian voice note into separate to-do items for a Persian to-do app.
Now in Iran: ${jalaliLabel(today)} (${today}), time ${nowTime()}. The Iranian week starts on Saturday (شنبه).
Calendar (Gregorian = Persian):
${days.join("\n")}

Rules:
- Split the note into separate tasks. One task per distinct thing to do. Ignore filler words, greetings and thinking aloud.
- "title": short, clear Persian (2–8 words). Remove the date/time words from the title. Keep names as heard. Fix obvious speech-to-text spelling mistakes.
- "date": Gregorian YYYY-MM-DD taken from the calendar above. "امروز"=today, "فردا"=tomorrow, a weekday name = its next occurrence (today counts if it is that weekday and still upcoming), "هفته بعد/دیگه" = 7 days later. A Persian date like "۲۰ آبان" maps through the calendar. If no day is said, use today.
- "time": 24-hour "HH:MM" or null. "صبح" = morning, "ظهر" ≈ 12:00, "بعدازظهر/عصر" = afternoon (e.g. "پنج عصر" = 17:00), "شب" = evening/night (e.g. "نه شب" = 21:00). "ساعت ده" with no part of day: pick the sensible one (meetings ≈ daytime). No time mentioned → null.
- "important": true only if the speaker says it is important/urgent (مهم، فوری، حتماً، ضروری).
- If the note contains no task at all, return an empty list.
Reply with ONLY this JSON, no other text:
{"tasks":[{"title":"...","date":"YYYY-MM-DD","time":"HH:MM" or null,"important":false}]}`;
  return [
    { role: "system", content: system },
    { role: "user", content: text },
  ];
}

function textOf(r: unknown): string {
  const o = r as Record<string, unknown> & {
    choices?: { message?: { content?: string | null } }[];
    output?: { content?: { text?: string }[] }[];
  };
  if (typeof o?.response === "string") return o.response;
  if (o?.response && typeof o.response === "object") return JSON.stringify(o.response);
  const c = o?.choices?.[0]?.message?.content;
  if (typeof c === "string") return c;
  if (typeof o?.output_text === "string") return o.output_text as string;
  const out = o?.output?.flatMap((x) => x.content ?? []).map((x) => x.text ?? "").join("");
  return out ?? "";
}

function extractJson(s: string): { tasks?: unknown[] } | null {
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
}

function clean(raw: unknown[]): VoiceTask[] {
  const today = todayKey();
  const out: VoiceTask[] = [];
  for (const it of raw.slice(0, 30)) {
    const o = (it ?? {}) as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim().slice(0, 200) : "";
    if (!title) continue;
    let date = today;
    try {
      if (o.date) date = parseDate(o.date);
    } catch {
      /* تاریخ نامفهوم → امروز */
    }
    let time: string | undefined;
    try {
      time = parseTime(o.time ?? undefined);
    } catch {
      time = undefined;
    }
    out.push({ title, date, time, important: o.important === true });
  }
  return out;
}

/** تقسیم ساده وقتی مدل زبانی در دسترس نیست (آزمایش محلی) */
function naiveSplit(text: string): VoiceTask[] {
  return text
    .split(/[.،,؛\n]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title) => ({ title, date: todayKey(), important: /مهم|فوری/.test(title) }));
}

async function toTasks(env: Env, text: string): Promise<VoiceTask[]> {
  if (!env.AI) return naiveSplit(text);
  const messages = buildPrompt(text);
  let lastErr: unknown = null;
  for (const model of LLMS) {
    try {
      const r = await env.AI.run(model as never, { messages, max_tokens: 3000, temperature: 0.1 } as never);
      const json = extractJson(textOf(r));
      if (json && Array.isArray(json.tasks)) return clean(json.tasks);
      lastErr = new Error(`unparsable output from ${model}: ${textOf(r).slice(0, 200)}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw aiFailure(lastErr);
}

export async function handleVoice(req: Request, env: Env, userId: string) {
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length < 2000) throw new VoiceError("voice_empty");
  if (buf.length > MAX_BYTES) throw new VoiceError("voice_too_long", 413);
  const remaining = await takeQuota(env, userId);
  try {
    const text = await transcribe(env, buf);
    if (!text) return { text: "", tasks: [], remaining };
    const tasks = await toTasks(env, text);
    return { text, tasks, remaining };
  } catch (e) {
    // اگر سرور خطا داد، از سهمیهٔ کاربر کم نشود
    await refundQuota(env, userId);
    throw e;
  }
}

export async function voiceStatus(env: Env, userId: string) {
  const r = await env.DB.prepare("SELECT count FROM voice_usage WHERE user_id = ? AND day = ?")
    .bind(userId, todayKey())
    .first<{ count: number }>();
  return { limit: VOICE_DAILY_LIMIT, remaining: Math.max(0, VOICE_DAILY_LIMIT - (r?.count ?? 0)) };
}
