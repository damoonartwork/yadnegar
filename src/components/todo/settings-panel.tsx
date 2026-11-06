import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, ImagePlus, RotateCcw, X } from "lucide-react";
import { DEFAULT_SETTINGS, type BgPreset, type Settings, type ThemeMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/jalali";
import { BG_PRESETS, imageIsLight, presetSwatch } from "./backdrop";
import { UpdateSection } from "./update-section";
import { AccountSection } from "./account-section";
import type { SyncApi } from "@/hooks/use-sync";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (s: Settings) => void;
  isDesktop: boolean;
  sync: SyncApi;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-white" : "bg-white/15")}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full shadow transition-all",
          checked ? "left-0.5 bg-black" : "left-[22px] bg-white"
        )}
      />
    </button>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-white/45">{hint}</p>}
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
    <div className="rounded-2xl bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-white/50">
          {toFa(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="yg-range w-full"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}

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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h3 className="px-1 text-xs font-bold text-white/45">{title}</h3>
    {children}
  </section>
);

export function SettingsPanel({ open, onClose, settings, onChange, isDesktop, sync }: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const android = window.yadnegar?.platform === "android";
  const [perm, setPerm] = React.useState<{ notifications: boolean; exact: boolean } | null>(null);
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

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
            className="flex max-h-full w-full max-w-[880px] flex-col rounded-3xl border border-white/10 yg-panel backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_20px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-lg font-bold">تنظیمات</h2>
              <button onClick={onClose} className="text-white/50 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="thin-scroll grid min-h-0 grid-cols-1 gap-6 overflow-y-auto px-4 pb-6 md:grid-cols-2 md:px-6">
              {/* ستون راست: ظاهر */}
              <div className="space-y-5">
                <Section title="شیشه">
                  <Slider label="میزان تاری پشت شیشه" value={settings.glassBlur} min={0} max={60} unit=" px" onChange={(v) => set({ glassBlur: v })} />
                  <Slider label="رنگ و مات بودن شیشه" value={settings.glassTint} min={0} max={30} unit="٪" onChange={(v) => set({ glassTint: v })} />
                  <Slider label="درخشش لبه‌ها" value={settings.glassEdge} min={0} max={100} unit="٪" onChange={(v) => set({ glassEdge: v })} />
                  <button
                    onClick={() =>
                      set({ glassBlur: DEFAULT_SETTINGS.glassBlur, glassTint: DEFAULT_SETTINGS.glassTint, glassEdge: DEFAULT_SETTINGS.glassEdge })
                    }
                    className="flex items-center gap-1.5 px-1 text-xs text-white/50 hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    برگشت به حالت پیش‌فرض
                  </button>
                </Section>

                <Section title="حالت رنگ">
                  <div className="flex gap-1 rounded-full bg-black/25 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
                    {(
                      [
                        { id: "auto", label: "خودکار" },
                        { id: "dark", label: "تیره" },
                        { id: "light", label: "روشن" },
                      ] as { id: ThemeMode; label: string }[]
                    ).map((o) => (
                      <button
                        key={o.id}
                        onClick={() => set({ theme: o.id })}
                        className={cn(
                          "flex-1 rounded-full py-1.5 text-xs transition-colors",
                          (settings.theme ?? "auto") === o.id
                            ? "bg-white font-bold text-black shadow-md"
                            : "font-semibold text-white/60 hover:text-white"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <p className="px-1 text-[11px] text-white/40">
                    «خودکار»: روی پس‌زمینهٔ روشن، شیشه سفید و نوشته‌ها تیره می‌شوند.
                  </p>
                </Section>

                <Section title="پس‌زمینه">
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(BG_PRESETS) as BgPreset[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => set({ background: p })}
                        className={cn(
                          "group flex flex-col items-center gap-1.5 rounded-2xl p-1.5 transition-colors",
                          settings.background === p ? "bg-white/10" : "hover:bg-white/[0.05]"
                        )}
                      >
                        <span
                          className={cn(
                            "h-12 w-full rounded-xl border",
                            settings.background === p ? "border-white/80" : "border-white/10"
                          )}
                          style={{
                            background: presetSwatch(p),
                            ...(BG_PRESETS[p].dots
                              ? { backgroundImage: `radial-gradient(rgba(255,255,255,.25) 1px, transparent 1.2px), ${presetSwatch(p)}`, backgroundSize: "8px 8px, cover" }
                              : {}),
                          }}
                        />
                        <span className="text-[11px] text-white/70">{BG_PRESETS[p].label}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => (settings.bgImage ? set({ background: "image" }) : fileRef.current?.click())}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl p-1.5 transition-colors",
                        settings.background === "image" ? "bg-white/10" : "hover:bg-white/[0.05]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-12 w-full place-items-center rounded-xl border bg-cover bg-center",
                          settings.background === "image" ? "border-white/80" : "border-dashed border-white/25"
                        )}
                        style={settings.bgImage ? { backgroundImage: `url(${settings.bgImage})` } : undefined}
                      >
                        {!settings.bgImage && <ImagePlus className="h-5 w-5 text-white/60" />}
                      </span>
                      <span className="text-[11px] text-white/70">عکس دلخواه</span>
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
                  {settings.bgImage && (
                    <button onClick={() => fileRef.current?.click()} className="px-1 text-xs text-white/50 hover:text-white">
                      انتخاب عکس دیگر…
                    </button>
                  )}
                  <Slider label="تیره‌کردن پس‌زمینه" value={settings.bgDim} min={0} max={80} unit="٪" onChange={(v) => set({ bgDim: v })} />
                </Section>
              </div>

              {/* ستون چپ: حساب، یادآوری و عمومی */}
              <div className="space-y-5">
                <Section title="حساب کاربری و همگام‌سازی">
                  <AccountSection sync={sync} />
                </Section>

                {android ? (
                  <Section title="یادآوری">
                    <p className="px-1 text-[11px] leading-5 text-white/45">
                      یادآورها را خود اندروید سر ساعت نشان می‌دهد، حتی وقتی یادنگار بسته است. داخل اعلان دکمه‌های «انجام شد» و «۱۰ دقیقه بعد» هست.
                    </p>
                    <button
                      onClick={async () => {
                        const r = await window.yadnegar?.requestNotificationPermission?.();
                        setPerm(r ?? null);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-white/[0.07] py-2.5 text-sm font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] active:bg-white/[0.12]"
                    >
                      بررسی اجازهٔ اعلان
                    </button>
                    {perm && (
                      <p className="px-1 text-[11px] leading-5 text-white/55">
                        اعلان: {perm.notifications ? "مجاز ✓" : "غیرمجاز — از تنظیمات گوشی اجازه بده"} · هشدار دقیق: {perm.exact ? "مجاز ✓" : "غیرمجاز"}
                      </p>
                    )}
                    {perm && !perm.exact && (
                      <button
                        onClick={() => window.yadnegar?.openNotificationSettings()}
                        className="w-full rounded-full bg-white/[0.06] py-2.5 text-xs font-semibold text-white/75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                      >
                        اجازهٔ «هشدار و یادآوری دقیق»
                      </button>
                    )}
                    <button
                      onClick={() => window.yadnegar?.testNotification()}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-bold text-black active:bg-white/90"
                    >
                      <BellRing className="h-4 w-4" />
                      آزمایش اعلان (۳ ثانیه دیگر)
                    </button>
                  </Section>
                ) : (
                  <Section title="یادآوری">
                    <Row title="پنجرهٔ یادآوری یادنگار" hint="کارت شیشه‌ای گوشهٔ صفحه، روی همهٔ پنجره‌ها">
                      <Toggle checked={settings.popupReminder} onChange={(v) => set({ popupReminder: v })} />
                    </Row>
                    <Row title="اعلان ویندوز" hint="اعلان کنار ساعت ویندوز (Action Center)">
                      <Toggle checked={settings.windowsNotification} onChange={(v) => set({ windowsNotification: v })} />
                    </Row>
                    <Row title="صدای یادآوری">
                      <Toggle checked={settings.sound} onChange={(v) => set({ sound: v })} />
                    </Row>
                    {isDesktop && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.yadnegar?.testNotification()}
                          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-bold text-black hover:bg-white/90"
                        >
                          <BellRing className="h-4 w-4" />
                          آزمایش یادآوری
                        </button>
                        <button
                          onClick={() => window.yadnegar?.openNotificationSettings()}
                          className="flex-1 rounded-full bg-white/[0.06] py-2.5 text-xs font-semibold text-white/75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] hover:bg-white/[0.1]"
                        >
                          تنظیمات اعلان ویندوز
                        </button>
                      </div>
                    )}
                    <p className="px-1 text-[11px] leading-5 text-white/40">
                      اگر اعلان ویندوز نمی‌آید، در تنظیمات اعلان ویندوز مطمئن شو اعلان‌های «Yadnegar» روشن است و Focus assist خاموش باشد. پنجرهٔ یادآوری یادنگار به این تنظیمات وابسته نیست.
                    </p>
                  </Section>
                )}

                {isDesktop && (
                  <Section title="به‌روزرسانی">
                    <UpdateSection />
                  </Section>
                )}

                {!android && (
                <Section title="عمومی">
                  <Row title="اجرا همراه ویندوز" hint="تا یادآورها همیشه کار کنند">
                    <Toggle checked={settings.autoStart} onChange={(v) => set({ autoStart: v })} />
                  </Row>
                  <Row title="با بستن، کنار ساعت بماند" hint="برنامه در System Tray فعال می‌ماند">
                    <Toggle checked={settings.closeToTray} onChange={(v) => set({ closeToTray: v })} />
                  </Row>
                </Section>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
