import * as React from "react";
import { LiquidGlassCard } from "@/components/ui/liquid-weather-glass";
import { cn } from "@/lib/utils";

/** کارت شیشه‌ای استاندارد برنامه (LiquidGlassCard با تنظیمات ثابت) */
export function Glass({
  className,
  contentClassName,
  children,
  radius = "24px",
}: {
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
  radius?: string;
}) {
  return (
    <LiquidGlassCard
      draggable={false}
      shadowIntensity="xs"
      glowIntensity="xs"
      blurIntensity="xl"
      borderRadius={radius}
      className={cn("yg-glass text-white", className)}
      contentClassName={contentClassName}
    >
      {children}
    </LiquidGlassCard>
  );
}
