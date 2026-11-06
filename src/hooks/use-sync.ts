import * as React from "react";
import type { useTasks } from "./use-tasks";
import {
  type AccountState,
  SyncError,
  loadAccount,
  logoutRemote,
  requestCode as apiRequestCode,
  saveAccount,
  syncOnce,
  verifyCode as apiVerifyCode,
} from "@/lib/sync";

export type SyncStatus = "idle" | "syncing" | "ok" | "offline" | "error";

const ERRORS: Record<string, string> = {
  invalid_email: "ایمیل درست نیست.",
  too_soon: "کمی صبر کن؛ هر یک دقیقه یک کد می‌شود فرستاد.",
  email_failed: "فرستادن ایمیل ناموفق بود. کمی بعد دوباره امتحان کن.",
  invalid_code: "کد باید ۶ رقم باشد.",
  wrong_code: "کد اشتباه است.",
  expired: "کد منقضی شده یا چند بار اشتباه وارد شده. کد تازه بگیر.",
  network: "به سرور یادنگار وصل نشد. اینترنت یا فیلترشکن را بررسی کن.",
  unauthorized: "نشست منقضی شده؛ دوباره وارد شو.",
};
export const syncErrorText = (e: unknown) =>
  ERRORS[e instanceof SyncError ? e.code : ""] ?? "خطایی پیش آمد. دوباره امتحان کن.";

function deviceName() {
  const w = window.yadnegar;
  if (w?.platform === "android") return "Android";
  if (w) return "Windows";
  return "Web";
}

/** حساب کاربری و همگام‌سازی خودکار در پس‌زمینه */
export function useSync(store: ReturnType<typeof useTasks>) {
  const [account, setAccountState] = React.useState<AccountState>(loadAccount);
  const [status, setStatus] = React.useState<SyncStatus>("idle");
  const [lastError, setLastError] = React.useState<string | null>(null);
  const accountRef = React.useRef(account);
  const storeRef = React.useRef(store);
  storeRef.current = store;
  const running = React.useRef(false);
  const again = React.useRef(false);

  const setAccount = React.useCallback((a: AccountState) => {
    accountRef.current = a;
    saveAccount(a);
    setAccountState(a);
  }, []);

  const syncNow = React.useCallback(async () => {
    const acc = accountRef.current;
    if (!acc.token || !storeRef.current.loaded) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus("syncing");
    try {
      const s = storeRef.current;
      const r = await syncOnce(acc, s.tasks, s.settings);
      // ممکن است در حین درخواست، کاربر حساب را عوض کرده باشد
      if (accountRef.current.token === acc.token) {
        setAccount(r.account);
        if (r.tasks) s.replaceTasks(() => r.tasks!);
        if (r.settingsPatch) s.setSettings((prev) => ({ ...prev, ...r.settingsPatch }));
      }
      setStatus("ok");
      setLastError(null);
    } catch (e) {
      if (e instanceof SyncError && e.code === "unauthorized") {
        setAccount({ ...accountRef.current, token: undefined });
      }
      setStatus(e instanceof SyncError && e.code === "network" ? "offline" : "error");
      setLastError(syncErrorText(e));
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        void syncNow();
      }
    }
  }, [setAccount]);

  // همگام‌سازی بعد از هر تغییر (با کمی تأخیر)، هر ۳۰ ثانیه، و با برگشتن به برنامه
  const signedIn = !!account.token;
  React.useEffect(() => {
    if (!signedIn || !store.loaded) return;
    const t = setTimeout(() => void syncNow(), 2500);
    return () => clearTimeout(t);
  }, [signedIn, store.loaded, store.tasks, store.settings, syncNow]);

  React.useEffect(() => {
    if (!signedIn) return;
    const iv = setInterval(() => void syncNow(), 30_000);
    const onVis = () => document.visibilityState === "visible" && void syncNow();
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [signedIn, syncNow]);

  const requestCode = (email: string) => apiRequestCode(accountRef.current.server, email.trim());

  const verifyCode = async (email: string, code: string) => {
    const r = await apiVerifyCode(accountRef.current.server, email.trim(), code, deviceName());
    // حساب تازه: از صفر همگام شود تا کارهای این دستگاه و حساب با هم ادغام شوند
    setAccount({ server: accountRef.current.server, email: r.email, token: r.token, cursor: 0, synced: {}, settingsUpdatedAt: 0 });
    setTimeout(() => void syncNow(), 50);
  };

  const logout = async () => {
    const acc = accountRef.current;
    if (acc.token) void logoutRemote(acc.server, acc.token);
    setAccount({ server: acc.server, cursor: 0, synced: {}, settingsUpdatedAt: 0 });
    setStatus("idle");
  };

  const setServer = (server: string) => {
    const clean = server.trim().replace(/\/+$/, "");
    if (clean && clean !== accountRef.current.server) {
      setAccount({ server: clean, cursor: 0, synced: {}, settingsUpdatedAt: 0 });
    }
  };

  return { account, status, lastError, syncNow, requestCode, verifyCode, logout, setServer };
}

export type SyncApi = ReturnType<typeof useSync>;
