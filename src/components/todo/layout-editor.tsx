import * as React from "react";
import { Reorder, useDragControls } from "motion/react";
import { cn } from "@/lib/utils";

export type BlockId = "clock" | "gregorian" | "calendar" | "notes" | "upcoming" | "tasks";

export const DEFAULT_LAYOUT: { left: BlockId[]; right: BlockId[] } = {
  left: ["clock", "gregorian", "calendar", "notes"],
  right: ["upcoming", "tasks"],
};

/** اندازهٔ هر بخش داخل ستون: بعضی ثابت، بعضی فضای باقی‌مانده را پر می‌کنند */
const SIZE: Record<BlockId, string> = {
  clock: "h-[156px] shrink-0",
  gregorian: "h-[96px] shrink-0",
  calendar: "shrink-0",
  notes: "min-h-[120px] flex-1",
  upcoming: "h-[156px] shrink-0",
  tasks: "min-h-0 flex-1",
};

/** ترتیب ذخیره‌شده را معتبر می‌کند (بخش جاافتاده یا تکراری → پیش‌فرض) */
export function normalizeLayout(raw?: { left?: string[]; right?: string[] }): { left: BlockId[]; right: BlockId[] } {
  const ok = (col: "left" | "right") => {
    const want = DEFAULT_LAYOUT[col];
    const got = raw?.[col];
    return Array.isArray(got) && got.length === want.length && want.every((id) => got.includes(id)) ? (got as BlockId[]) : want;
  };
  return { left: ok("left"), right: ok("right") };
}

function Block({ id, onDragEnd, children }: { id: BlockId; onDragEnd: () => void; children: React.ReactNode }) {
  const controls = useDragControls();
  const [dragging, setDragging] = React.useState(false);
  return (
    <Reorder.Item
      as="div"
      value={id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
      layout="position"
      transition={{ type: "spring", damping: 32, stiffness: 380 }}
      whileDrag={{ scale: 1.025 }}
      style={{ zIndex: dragging ? 30 : 0 }}
      className={cn(
        "group/block relative flex min-h-0 flex-col rounded-[24px]",
        SIZE[id],
        dragging && "shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
      )}
    >
      {children}
      {/* دستگیرهٔ جابه‌جایی: بالای هر کادر؛ نگه دار و بکش */}
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          controls.start(e);
        }}
        title="برای جابه‌جایی نگه دار و بکش"
        style={{ touchAction: "none" }}
        className="absolute inset-x-0 top-0 z-[40] flex h-4 cursor-grab justify-center active:cursor-grabbing"
      >
        <span
          className={cn(
            "mt-1.5 h-1 w-10 rounded-full bg-white/10 transition-all duration-200 group-hover/block:bg-white/35",
            dragging && "w-14 bg-white/80"
          )}
        />
      </div>
    </Reorder.Item>
  );
}

/** یک ستون از کادرها که با کشیدن دستگیرهٔ بالای هر کادر مرتب می‌شود */
export function LayoutColumn({
  order,
  onCommit,
  blocks,
  className,
}: {
  order: BlockId[];
  onCommit: (next: BlockId[]) => void;
  blocks: Record<BlockId, React.ReactNode>;
  className?: string;
}) {
  const [items, setItems] = React.useState(order);
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  const key = order.join(",");
  React.useEffect(() => setItems(order), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Reorder.Group as="div" axis="y" values={items} onReorder={setItems} className={className}>
      {items.map((id) => (
        <Block
          key={id}
          id={id}
          onDragEnd={() => {
            if (itemsRef.current.join(",") !== key) onCommit(itemsRef.current);
          }}
        >
          {blocks[id]}
        </Block>
      ))}
    </Reorder.Group>
  );
}
