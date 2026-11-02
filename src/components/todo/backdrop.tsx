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
  graphite: {
    label: "گرافیت",
    base: "linear-gradient(160deg,#1c1c1f 0%,#2b2b31 50%,#121214 100%)",
    blobs: [
      { color: "#ffffff", size: 460, top: "-15%", left: "40%", opacity: 0.1 },
      { color: "#94a3b8", size: 400, bottom: "-15%", right: "5%", opacity: 0.18 },
    ],
  },
};

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
