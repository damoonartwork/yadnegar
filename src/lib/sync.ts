// همگام‌سازی با سرور یادنگار (Cloudflare Worker)
import type { Settings, Task } from "./types";

/** آدرس سرور پیش‌فرض؛ از تنظیمات حساب قابل تغییر است */
export const DEFAULT_SERVER = "https://yadnegar-api.damoon-artwork.workers.dev";

/** تنظیماتی که بین دستگاه‌ها مشترک است (بقیه مخصوص هر دستگاه می‌ماند) */
export const SHARED_SETTING_KEYS = [
  "quickNote",
  "worldZone",
  "theme",
  "background",
  "glassBlur",
  "glassTint",
  "glassEdge",
  "bgDim",
] as const satisfies readonly (keyof Settings)[];

export interface AccountState {
  server: string;
  email?: string;
  token?: string;
  /** آخرین rev دریافتی از سرور */
  cursor: number;
  /** id کار → updatedAt آخرین نسخه‌ای که با سرور یکی بود */
  synced: Record<string, number>;
  /** امضای تنظیمات مشترک در آخرین همگام‌سازی */
  settingsSig?: string;
  settingsUpdatedAt: number;
  lastSyncAt?: number;
}

const KEY = "yadnegar-account";

export function loadAccount(): AccountState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { cursor: 0, synced: {}, settingsUpdatedAt: 0, server: DEFAULT_SERVER, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { server: DEFAULT_SERVER, cursor: 0, synced: {}, settingsUpdatedAt: 0 };
}

export function saveAccount(a: AccountState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

export class SyncError extends Error {
  constructor(public code: string, public status = 0) {
    super(code);
  }
}

async function call<T>(server: string, path: string, body: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(server.replace(/\/+$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new SyncError("network");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new SyncError(data.error || `http_${res.status}`, res.status);
  return data;
}

export const requestCode = (server: string, email: string) => call<{ ok: true; devCode?: string }>(server, "/auth/request", { email });

export const verifyCode = (server: string, email: string, code: string, device: string) =>
  call<{ token: string; email: string }>(server, "/auth/verify", { email, code, device });

export const logoutRemote = (server: string, token: string) => call(server, "/auth/logout", {}, token).catch(() => {});

function sharedSettings(s: Settings) {
  const out: Record<string, unknown> = {};
  for (const k of SHARED_SETTING_KEYS) out[k] = s[k];
  return out;
}

/** فیلدهای مخصوص هر دستگاه فرستاده نمی‌شوند */
function wireTask(t: Task) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { notified, ...rest } = t;
  return rest;
}

interface SyncResult {
  account: AccountState;
  tasks: Task[] | null;
  settingsPatch: Partial<Settings> | null;
  changed: number;
}

/**
 * یک دور همگام‌سازی: تغییرهای این دستگاه را می‌فرستد و تغییرهای دستگاه‌های دیگر را می‌گیرد.
 * آخرین ویرایش هر کار برنده است.
 */
export async function syncOnce(account: AccountState, tasks: Task[], settings: Settings): Promise<SyncResult> {
  if (!account.token) throw new SyncError("signed_out");
  const now = Date.now();
  const localIds = new Set(tasks.map((t) => t.id));

  const outgoing = tasks
    .filter((t) => account.synced[t.id] !== (t.updatedAt ?? 0))
    .map((t) => ({ id: t.id, data: wireTask(t), updatedAt: t.updatedAt ?? t.createdAt }));
  const deletions = Object.keys(account.synced)
    .filter((id) => !localIds.has(id))
    .map((id) => ({ id, deleted: true, updatedAt: now }));

  const shared = sharedSettings(settings);
  const sig = JSON.stringify(shared);
  let settingsUpdatedAt = account.settingsUpdatedAt;
  let settingsOut: { data: unknown; updatedAt: number } | null = null;
  // دستگاهی که تازه وارد شده، اول تنظیمات حساب را می‌گیرد و چیزی نمی‌فرستد
  const fresh = account.settingsSig === undefined;
  if (!fresh && sig !== account.settingsSig) {
    settingsUpdatedAt = now;
    settingsOut = { data: shared, updatedAt: now };
  }

  const res = await call<{
    cursor: number;
    tasks: { id: string; deleted: boolean; updatedAt: number; data: Task | null }[];
    settings: { data: Partial<Settings>; updatedAt: number } | null;
  }>(account.server, "/sync", { since: account.cursor, tasks: [...outgoing, ...deletions], settings: settingsOut }, account.token);

  const synced = { ...account.synced };
  for (const t of outgoing) synced[t.id] = t.updatedAt;
  for (const d of deletions) delete synced[d.id];

  // اعمال تغییرهای دیگران
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let changed = 0;
  for (const r of res.tasks) {
    const local = byId.get(r.id);
    const localAt = local?.updatedAt ?? 0;
    if (r.deleted) {
      if (local && localAt <= r.updatedAt) {
        byId.delete(r.id);
        changed++;
      }
      delete synced[r.id];
    } else if (r.data && (!local || r.updatedAt > localAt)) {
      byId.set(r.id, { ...r.data, notified: local?.notified, updatedAt: r.updatedAt });
      synced[r.id] = r.updatedAt;
      changed++;
    } else if (local && r.updatedAt === localAt) {
      synced[r.id] = r.updatedAt;
    }
  }

  let settingsPatch: Partial<Settings> | null = null;
  let newSig = settingsOut ? sig : fresh ? "" : account.settingsSig;
  if (res.settings && res.settings.updatedAt > settingsUpdatedAt) {
    settingsPatch = {};
    for (const k of SHARED_SETTING_KEYS) {
      if (k in res.settings.data) (settingsPatch as Record<string, unknown>)[k] = (res.settings.data as Record<string, unknown>)[k];
    }
    settingsUpdatedAt = res.settings.updatedAt;
    newSig = JSON.stringify({ ...shared, ...settingsPatch });
  }

  return {
    account: { ...account, cursor: res.cursor, synced, settingsSig: newSig, settingsUpdatedAt, lastSyncAt: Date.now() },
    tasks: changed ? [...byId.values()] : null,
    settingsPatch,
    changed,
  };
}

// ---------- اتصال به Claude (MCP) ----------
export const connectStatus = (server: string, token: string) =>
  call<{ active: boolean; createdAt: number | null }>(server, "/connect/status", {}, token);
export const connectCreate = (server: string, token: string) => call<{ url: string }>(server, "/connect/create", {}, token);
export const connectRevoke = (server: string, token: string) => call<{ ok: true }>(server, "/connect/revoke", {}, token);
