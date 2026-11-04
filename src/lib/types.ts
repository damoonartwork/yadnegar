export interface Task {
  id: string;
  title: string;
  /** روز کار به صورت yyyy-MM-dd (میلادی) */
  date: string;
  /** ساعت یادآوری HH:mm — اگر خالی باشد یادآوری ندارد */
  time?: string;
  important: boolean;
  done: boolean;
  /** آیا اعلان یادآوری نشان داده شده */
  notified?: boolean;
  /** اگر کاربر «بعداً یادم بنداز» زده باشد */
  snoozedUntil?: number;
  createdAt: number;
  /** ترتیب دستی کار در لیست (کوچک‌تر = بالاتر) */
  order?: number;
}

export type BgPreset = "dots" | "glow" | "aurora" | "ocean" | "sunset" | "forest" | "graphite";

export interface Settings {
  autoStart: boolean;
  closeToTray: boolean;
  /** میزان تاری پشت شیشه (px) */
  glassBlur: number;
  /** رنگ/مات بودن شیشه (۰ تا ۳۰ درصد سفیدی) */
  glassTint: number;
  /** درخشش لبهٔ شیشه (۰ تا ۱۰۰) */
  glassEdge: number;
  background: BgPreset | "image";
  /** تصویر دلخواه پس‌زمینه به صورت data URL */
  bgImage?: string;
  /** تیره‌کردن پس‌زمینه (۰ تا ۸۰ درصد) */
  bgDim: number;
  /** پنجرهٔ یادآوری اختصاصی گوشهٔ صفحه */
  popupReminder: boolean;
  /** اعلان خود ویندوز */
  windowsNotification: boolean;
  /** صدای یادآوری */
  sound: boolean;
  /** متن یادداشت سریع */
  quickNote: string;
  /** منطقهٔ زمانی کارت ساعت میلادی (IANA) */
  worldZone: string;
}

export const DEFAULT_SETTINGS: Settings = {
  autoStart: true,
  closeToTray: true,
  glassBlur: 24,
  glassTint: 6,
  glassEdge: 35,
  background: "glow",
  bgDim: 0,
  popupReminder: true,
  windowsNotification: true,
  sound: true,
  quickNote: "",
  worldZone: "America/New_York",
};

export interface AppData {
  tasks: Task[];
  settings: Settings;
}

export interface ReminderEvent {
  id: string;
  title: string;
  time?: string;
}

export interface UpdateStatus {
  state: "idle" | "checking" | "available" | "none" | "downloading" | "ready" | "error" | "unsupported";
  version?: string;
  percent?: number;
  message?: string;
}

export interface YadnegarAPI {
  load(): Promise<AppData>;
  saveTasks(tasks: Task[]): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  onTasksUpdated(cb: (tasks: Task[]) => void): () => void;
  onReminder(cb: (r: ReminderEvent) => void): () => void;
  testNotification(): void;
  openNotificationSettings(): void;
  /** فقط در پنجرهٔ یادآوری */
  reminderAction?(id: string, action: "done" | "snooze10" | "snooze60" | "dismiss" | "open"): void;
  minimize(): void;
  close(): void;
  toggleMaximize(): void;
  onMaximizeChange?(cb: (maximized: boolean) => void): () => void;
  togglePin(): Promise<boolean>;
  appVersion?(): Promise<string>;
  getUpdate?(): Promise<UpdateStatus>;
  checkUpdate?(): Promise<UpdateStatus>;
  downloadUpdate?(): Promise<void>;
  installUpdate?(): void;
  openReleases?(): void;
  onUpdateStatus?(cb: (s: UpdateStatus) => void): () => void;
}

declare global {
  interface Window {
    yadnegar?: YadnegarAPI;
  }
}
