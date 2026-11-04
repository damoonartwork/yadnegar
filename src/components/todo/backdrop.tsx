import type { BgPreset, Settings } from "@/lib/types";

interface Blob {
  color: string;
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  opacity?: number;
}

interface PresetDef {
  label: string;
  /** پس‌زمینهٔ روشن → در حالت خودکار، نوشته‌ها تیره می‌شوند */
  light?: boolean;
  base: string;
  dots?: boolean;
  blobs?: Blob[];
}

export const BG_PRESETS: Record<BgPreset, PresetDef> = {
  dots: { label: "ساده نقطه‌ای", base: "#0a0a0a", dots: true },
  glow: {
    label: "شب درخشان",
    base: "#0a0a0a",
    dots: true,
    blobs: [
      { color: "#3b82f6", size: 520, top: "-12%", right: "8%", opacity: 0.22 },
      { color: "#e2e8f0", size: 420, bottom: "-10%", left: "18%", opacity: 0.12 },
      { color: "#a855f7", size: 380, top: "35%", left: "-6%", opacity: 0.16 },
    ],
  },
  aurora: {
    label: "شفق",
    base: "#0b0b14",
    blobs: [
      { color: "#ec4899", size: 520, top: "-10%", right: "-4%", opacity: 0.55 },
      { color: "#8b5cf6", size: 480, top: "40%", right: "35%", opacity: 0.45 },
      { color: "#14b8a6", size: 460, bottom: "-12%", left: "-6%", opacity: 0.45 },
    ],
  },
  ocean: {
    label: "آسمان",
    base: "linear-gradient(160deg,#0f6fb8 0%,#2a9ad8 40%,#79c4ea 65%,#e9cdb6 88%,#a9a7c4 100%)",
    blobs: [
      { color: "#ffffff", size: 420, top: "8%", left: "10%", opacity: 0.35 },
      { color: "#fde7d4", size: 520, bottom: "-15%", right: "20%", opacity: 0.55 },
    ],
  },
  sunset: {
    label: "غروب",
    base: "linear-gradient(170deg,#1a1033 0%,#4a1d4f 40%,#b2456e 75%,#f19a6b 100%)",
    blobs: [
      { color: "#fbbf24", size: 420, bottom: "-12%", left: "30%", opacity: 0.4 },
      { color: "#f472b6", size: 380, top: "10%", right: "10%", opacity: 0.35 },
    ],
  },
  forest: {
    label: "جنگل",
    base: "linear-gradient(160deg,#04140f 0%,#0b2e22 50%,#14513b 100%)",
    blobs: [
      { color: "#34d399", size: 460, top: "-8%", left: "20%", opacity: 0.3 },
      { color: "#a3e635", size: 360, bottom: "-10%", right: "10%", opacity: 0.2 },
    ],
  },
  paper: {
    label: "روشن",
    light: true,
    base: "#eceef2",
    dots: true,
    blobs: [
      { color: "#c7d2fe", size: 520, top: "-12%", right: "6%", opacity: 0.55 },
      { color: "#fbcfe8", size: 440, bottom: "-12%", left: "16%", opacity: 0.5 },
      { color: "#bae6fd", size: 400, top: "38%", left: "-6%", opacity: 0.5 },
    ],
  },
  mist: {
    label: "مه صبحگاهی",
    light: true,
    base: "linear-gradient(160deg,#fdfcfb 0%,#eef1f5 45%,#dde7f2 100%)",
    blobs: [
      { color: "#a5b4fc", size: 480, top: "-10%", left: "30%", opacity: 0.4 },
      { color: "#fda4af", size: 420, bottom: "-14%", right: "10%", opacity: 0.35 },
      { color: "#99f6e4", size: 360, top: "40%", right: "40%", opacity: 0.3 },
    ],
  },
  graphite: {
    label: "گرافیت",
    base: "linear-gradient(160deg,#1c1c1f 0%,#2b2b31 50%,#121214 100%)",
    blobs: [
      { color: "#ffffff", size: 460, top: "-15%", left: "40%", opacity: 0.1 },
      { color: "#94a3b8", size: 400, bottom: "-15%", right: "5%", opacity: 0.18 },
    ],
  },
};

/** میانگین روشنایی یک عکس (۰ تا ۱) — برای تشخیص پس‌زمینهٔ روشن */
export function imageIsLight(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(false);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 48;
      c.height = 32;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      resolve(sum / (d.length / 4) / 255 > 0.58);
    };
    img.src = src;
  });
}

/** حالت روشن فعال باشد؟ (خودکار: بر اساس روشن بودن پس‌زمینه و میزان تیره‌کردن) */
export function isLightTheme(s: Settings): boolean {
  if (s.theme === "light") return true;
  if (s.theme === "dark") return false;
  if (s.bgDim >= 40) return false;
  if (s.background === "image") return !!(s.bgImage && s.bgImageLight);
  return !!BG_PRESETS[s.background as BgPreset]?.light;
}

/** پیش‌نمایش کوچک هر پس‌زمینه برای تنظیمات */
export function presetSwatch(p: BgPreset): string {
  const def = BG_PRESETS[p];
  const glows = (def.blobs ?? [])
    .map((b, i) => `radial-gradient(circle at ${["80% 15%", "25% 85%", "10% 50%"][i]}, ${hexA(b.color, b.opacity ?? 0.4)} 0%, transparent 55%)`)
    .join(",");
  return [glows, def.base].filter(Boolean).join(",");
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function Backdrop({ settings }: { settings: Settings }) {
  const isImage = settings.background === "image" && settings.bgImage;
  const def = BG_PRESETS[(isImage ? "dots" : settings.background) as BgPreset] ?? BG_PRESETS.glow;

  return (
    <div className="yg-bg" style={{ background: isImage ? "#000" : def.base }}>
      {isImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${settings.bgImage})` }}
        />
      ) : (
        <>
          {def.dots && <div className="dots" />}
          {(def.blobs ?? []).map((b, i) => (
            <span
              key={i}
              className="blob"
              style={{
                width: b.size,
                height: b.size,
                background: b.color,
                opacity: b.opacity ?? 0.4,
                top: b.top,
                left: b.left,
                right: b.right,
                bottom: b.bottom,
              }}
            />
          ))}
        </>
      )}
      <div className="dim" style={{ opacity: settings.bgDim / 100 }} />
    </div>
  );
}
