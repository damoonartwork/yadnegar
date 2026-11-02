import * as React from "react";
import { cn } from "@/lib/utils";

// دکمهٔ شیشه‌ای تیره (الهام از عکس دوم): کپسولی، لبهٔ روشن داخلی و درخشش ملایم بیرونی

type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";
type Variant = "glass" | "solid";

export interface LiquidGlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  variant?: Variant;
  active?: boolean;
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-base gap-2",
  icon: "h-10 w-10",
  "icon-sm": "h-8 w-8",
};

export const LiquidGlassButton = React.forwardRef<HTMLButtonElement, LiquidGlassButtonProps>(
  ({ className, size = "md", variant = "glass", active, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        "transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        variant === "glass" &&
          cn(
            "border border-white/10 bg-white/[0.04] text-white/90 backdrop-blur-xl",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.5),0_0_14px_rgba(255,255,255,0.05)]",
            "hover:bg-white/[0.08] hover:text-white hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-1px_1px_rgba(255,255,255,0.1),0_2px_10px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.09)]",
            active && "bg-white/[0.12] text-white"
          ),
        variant === "solid" &&
          "bg-white text-black shadow-[inset_0_-2px_4px_rgba(0,0,0,0.15),0_0_18px_rgba(255,255,255,0.18)] hover:bg-white/90",
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
LiquidGlassButton.displayName = "LiquidGlassButton";
