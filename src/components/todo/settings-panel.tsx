import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellRing, ImagePlus, Palette, RotateCcw, SlidersHorizontal, UserRound, X } from "lucide-react";
import { DEFAULT_SETTINGS, type BgPreset, type Settings, type ThemeMode, type UiScale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/jalali";
import { BG_PRESETS, imageIsLight, presetSwatch } from "./backdrop";
import { UpdateSection } from "./update-section";
import { AccountSection, ClaudeConnect } from "./account-section";
import type { SyncApi } from "@/hooks/use-sync";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (s: Settings) => void;
  isDesktop: boolean;
  sync: SyncApi;
}

type TabId = "look" | "remind" | "account" | "app";
const TAB_KEY = "yadnegar-settings-tab";

// ---------- اجزای کوچک ----------
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-white" : "bg-white/15")}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full shadow transition-all",
          checked ? "left-0.5 bg-black" : "left-[18px] bg-white"
        )}
      />
    </button>
  );
}

/** گروهی از ردیف‌ها در یک کارت، با خط جداکنندهٔ ظریف */
const Group = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={cn(
      "divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-white/[0.035] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]",
      className
    )}
  >
    {children}
  </div>
);

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{title}</p>
        {hint && <p className="mt-0.5 text-[11px] text-white/40">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="w-28 shrink-0 text-[12.5px] font-semibold">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="yg-range min-w-0 flex-1"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
      <span className="w-11 shrink-0 text-left text-[11px] text-white/45" dir="ltr">
        {toFa(value)}
        {unit}
      </span>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-black/25 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 rounded-full py-1.5 text-xs transition-colors",
            value === o.id ? "bg-white font-bold text-black shadow-md" : "font-semibold text-white/60 hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Section = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between px-1">
      <h3 className="text-[11px] font-bold text-white/40">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

/** تصویر را کوچک و فشرده می‌کند تا فایل ذخیره سنگین نشود */
function loadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 2200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.86));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function readTab(): TabId {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (t === "look" || t === "remind" || t === "account" || t === "app") return t;
  } catch {
    /* ignore */
  }
  return "look";
}

// ---------- پنل ----------
export function SettingsPanel({ open, onClose, settings, onChange, isDesktop, sync }: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const android = window.yadnegar?.platform === "android";
  const [perm, setPerm] = React.useState<{ notifications: boolean; exact: boolean } | null>(null);
  const [tab, setTabState] = React.useState<TabId>(readTab);
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  // اندازهٔ برنامه: ویندوز و اندروید
  const showSize = isDesktop;

  // با هر باز شدن، آخرین زبانه (یا زبانه‌ای که بیرون تعیین شده) خوانده شود
  React.useEffect(() => {
    if (open) setTabState(readTab());
  }, [open]);

  const setTab = (t: TabId) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "look", label: "ظاهر", icon: Palette },
    { id: "remind", label: "یادآوری", icon: Bell },
    { id: "account", label: "حساب", icon: UserRound },
    { id: "app", label: "برنامه", icon: SlidersHorizontal },
  ];

  // ---------- محتوای هر زبانه ----------
  const look = (
    <div className="space-y-4">
      <div className={cn("grid gap-4", showSize && "grid-cols-2")}>
        <Section title="حالت رنگ">
          <Segmented
            value={(settings.theme ?? "auto") as ThemeMode}
            options={[
              { id: "auto", label: "خودکار" },
              { id: "dark", label: "تیره" },
              { id: "light", label: "روشن" },
            ]}
            onChange={(v) => set({ theme: v })}
          />
        </Section>
        {showSize && (
          <Section title="اندازهٔ برنامه">
            <Segmented
              value={(settings.uiScale ?? "medium") as UiScale}
              options={[
                { id: "small", label: "کوچک" },
                { id: "medium", label: "متوسط" },
                { id: "large", label: "بزرگ" },
              ]}
              onChange={(v) => set({ uiScale: v })}
            />
          </Section>
        )}
      </div>

      <Section
        title="پس‌زمینه"
        action={
          settings.bgImage ? (
            <button onClick={() => fileRef.current?.click()} className="text-[11px] text-white/45 hover:text-white">
              عکس دیگر…
            </button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-5 gap-1.5">
          {(Object.keys(BG_PRESETS) as BgPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => set({ background: p })}
              title={BG_PRESETS[p].label}
              className="group flex flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "h-9 w-full rounded-xl border transition-all",
                  settings.background === p ? "border-white ring-2 ring-white/25" : "border-white/10 group-hover:border-white/30"
                )}
                style={{
                  background: presetSwatch(p),
                  ...(BG_PRESETS[p].dots
                    ? { backgroundImage: `radial-gradient(rgba(255,255,255,.25) 1px, transparent 1.2px), ${presetSwatch(p)}`, backgroundSize: "8px 8px, cover" }
                    : {}),
                }}
              />
              <span className={cn("text-[10px]", settings.background === p ? "text-white" : "text-white/50")}>{BG_PRESETS[p].label}</span>
            </button>
          ))}
          <button
            onClick={() => (settings.bgImage ? set({ background: "image" }) : fileRef.current?.click())}
            title="عکس دلخواه"
            className="group flex flex-col items-center gap-1"
          >
            <span
              className={cn(
                "grid h-9 w-full place-items-center rounded-xl border bg-cover bg-center transition-all",
                settings.background === "image" ? "border-white ring-2 ring-white/25" : "border-dashed border-white/25 group-hover:border-white/40"
              )}
              style={settings.bgImage ? { backgroundImage: `url(${settings.bgImage})` } : undefined}
            >
              {!settings.bgImage && <ImagePlus className="h-4 w-4 text-white/60" />}
            </span>
            <span className={cn("text-[10px]", settings.background === "image" ? "text-white" : "text-white/50")}>عکس</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const data = await loadImage(f);
            set({ background: "image", bgImage: data, bgImageLight: await imageIsLight(data) });
          }}
        />
      </Section>

      <Section
        title="شیشه و پس‌زمینه"
        action={
          <button
            onClick={() => set({ glassBlur: DEFAULT_SETTINGS.glassBlur, glassTint: DEFAULT_SETTINGS.glassTint, glassEdge: DEFAULT_SETTINGS.glassEdge })}
            className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            پیش‌فرض
          </button>
        }
      >
        <Group>
          <Slider label="تاری پشت شیشه" value={settings.glassBlur} min={0} max={60} unit=" px" onChange={(v) => set({ glassBlur: v })} />
          <Slider label="رنگ و مات بودن" value={settings.glassTint} min={0} max={30} unit="٪" onChange={(v) => set({ glassTint: v })} />
          <Slider label="درخشش لبه‌ها" value={settings.glassEdge} min={0} max={100} unit="٪" onChange={(v) => set({ glassEdge: v })} />
          <Slider label="تیره‌کردن پس‌زمینه" value={settings.bgDim} min={0} max={80} unit="٪" onChange={(v) => set({ bgDim: v })} />
        </Group>
      </Section>
    </div>
  );

  const pill = "flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-xs font-bold transition-colors";

  const remind = android ? (
    <div className="space-y-5">
      <Section title="اعلان‌های گوشی">
        <Group>
          <div className="px-3.5 py-3 text-[12px] leading-6 text-white/55">
            یادآورها را خود اندروید سر ساعت نشان می‌دهد، حتی وقتی یادنگار بسته است. داخل اعلان دکمه‌های «انجام شد» و «۱۰ دقیقه بعد» هست.
          </div>
          {perm && (
            <Row title="وضعیت اجازه‌ها" hint={`اعلان: ${perm.notifications ? "مجاز ✓" : "غیرمجاز"} · هشدار دقیق: ${perm.exact ? "مجاز ✓" : "غیرمجاز"}`}>
              {!perm.exact ? (
                <button onClick={() => window.yadnegar?.openNotificationSettings()} className="shrink-0 text-[11px] font-semibold text-white/70 underline">
                  اجازه بده
                </button>
              ) : (
                <span />
              )}
            </Row>
          )}
        </Group>
      </Section>
      <div className="flex gap-2">
        <button onClick={() => window.yadnegar?.testNotification()} className={cn(pill, "bg-white text-black")}>
          <BellRing className="h-3.5 w-3.5" />
          آزمایش اعلان
        </button>
        <button
          onClick={async () => setPerm((await window.yadnegar?.requestNotificationPermission?.()) ?? null)}
          className={cn(pill, "bg-white/[0.07] text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]")}
        >
          بررسی اجازه‌ها
        </button>
      </div>
    </div>
  ) : (
    <div className="space-y-5">
      <Section title="نحوهٔ یادآوری">
        <Group>
          <Row title="پنجرهٔ یادآوری یادنگار" hint="کارت شیشه‌ای گوشهٔ صفحه، روی همهٔ پنجره‌ها">
            <Toggle checked={settings.popupReminder} onChange={(v) => set({ popupReminder: v })} />
          </Row>
          <Row title="اعلان ویندوز" hint="کنار ساعت ویندوز (Action Center)">
            <Toggle checked={settings.windowsNotification} onChange={(v) => set({ windowsNotification: v })} />
          </Row>
          <Row title="صدای یادآوری">
            <Toggle checked={settings.sound} onChange={(v) => set({ sound: v })} />
          </Row>
        </Group>
      </Section>
      {isDesktop && (
        <div className="flex gap-2">
          <button onClick={() => window.yadnegar?.testNotification()} className={cn(pill, "bg-white text-black hover:bg-white/90")}>
            <BellRing className="h-3.5 w-3.5" />
            آزمایش یادآوری
          </button>
          <button
            onClick={() => window.yadnegar?.openNotificationSettings()}
            className={cn(pill, "bg-white/[0.07] text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] hover:bg-white/[0.1]")}
          >
            تنظیمات اعلان ویندوز
          </button>
        </div>
      )}
      <p className="px-1 text-[11px] leading-5 text-white/35">
        اعلان ویندوز نمی‌آید؟ در تنظیمات ویندوز اعلان‌های «Yadnegar» را روشن و Focus assist را خاموش کن. پنجرهٔ یادآوری یادنگار به این تنظیمات وابسته نیست.
      </p>
    </div>
  );

  const account = (
    <div className="space-y-5">
      <Section title="حساب کاربری و همگام‌سازی">
        <AccountSection sync={sync} />
      </Section>
      {sync.account.token && (
        <Section title="اتصال به Claude">
          <ClaudeConnect server={sync.account.server} token={sync.account.token} />
        </Section>
      )}
    </div>
  );

  const app = (
    <div className="space-y-5">
      {!android && (
        <Section title="عمومی">
          <Group>
            <Row title="اجرا همراه ویندوز" hint="تا یادآورها همیشه کار کنند">
              <Toggle checked={settings.autoStart} onChange={(v) => set({ autoStart: v })} />
            </Row>
            <Row title="با بستن، کنار ساعت بماند" hint="برنامه در System Tray فعال می‌ماند">
              <Toggle checked={settings.closeToTray} onChange={(v) => set({ closeToTray: v })} />
            </Row>
          </Group>
        </Section>
      )}
      {isDesktop && (
        <Section title="به‌روزرسانی">
          <UpdateSection />
        </Section>
      )}
    </div>
  );

  const content: Record<TabId, React.ReactNode> = { look, remind, account, app };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-3 md:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full max-h-full w-full max-w-[660px] md:h-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 yg-panel backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_20px_60px_rgba(0,0,0,0.6)] md:flex-row"
          >
            {/* نوار زبانه‌ها: کنار پنل در دسکتاپ، بالای پنل در موبایل */}
            <nav className="flex shrink-0 flex-col border-white/[0.07] md:w-44 md:border-l md:bg-black/10">
              <div className="flex items-center justify-between px-5 pt-4 pb-3 md:pt-5">
                <h2 className="text-base font-bold">تنظیمات</h2>
                <button onClick={onClose} className="text-white/50 hover:text-white md:hidden" aria-label="بستن">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mx-3 mb-3 flex gap-1 rounded-full bg-black/25 p-1 md:mx-2.5 md:flex-col md:rounded-none md:bg-transparent md:p-0">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "relative flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors md:flex-none md:justify-start md:rounded-xl md:py-2 md:text-[13px]",
                        active ? "text-black md:text-white" : "text-white/55 hover:text-white"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="settings-tab"
                          className="absolute inset-0 rounded-full bg-white md:rounded-xl md:bg-white/[0.09] md:shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                          transition={{ type: "spring", damping: 30, stiffness: 400 }}
                        />
                      )}
                      <Icon className="relative h-4 w-4 shrink-0" />
                      <span className="relative">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="hidden shrink-0 items-center justify-between px-6 pt-5 pb-1 md:flex">
                <h3 className="text-sm font-bold text-white/80">{tabs.find((t) => t.id === tab)?.label}</h3>
                <button
                  onClick={onClose}
                  className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/[0.06] hover:text-white"
                  aria-label="بستن"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-5 md:px-6 md:pt-3">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    
                  >
                    {content[tab]}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
