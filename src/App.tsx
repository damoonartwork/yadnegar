import * as React from "react";
import { GlassCalendar, type DayMark } from "@/components/ui/glass-calendar";
import { Glass } from "@/components/todo/glass";
import { TitleBar } from "@/components/todo/title-bar";
import { ClockCard } from "@/components/todo/clock-card";
import { GregorianCard } from "@/components/todo/gregorian-card";
import { NotesCard } from "@/components/todo/notes-card";
import { UpcomingStrip } from "@/components/todo/upcoming-strip";
import type { AddTaskHandle } from "@/components/todo/add-task";
import { TaskPanel, type Filter } from "@/components/todo/task-panel";
import { MobileApp } from "./mobile-app";
import { isNative } from "./platform/mobile";
import { ReminderToasts } from "@/components/todo/reminder-toast";
import { SettingsPanel } from "@/components/todo/settings-panel";
import { VoiceDialog } from "@/components/todo/voice-dialog";
import { useTasks } from "@/hooks/use-tasks";
import { useSync } from "@/hooks/use-sync";
import { Backdrop, imageIsLight, isLightTheme } from "@/components/todo/backdrop";
import { LayoutColumn, normalizeLayout, type BlockId } from "@/components/todo/layout-editor";

/** موبایل: اپ اندروید یا پنجرهٔ باریک */
function useIsMobile() {
  const query = "(max-width: 760px)";
  const [narrow, setNarrow] = React.useState(() => window.matchMedia(query).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return isNative() || narrow;
}

export default function App() {
  const store = useTasks();
  const sync = useSync(store);
  const { tasks } = store;
  const [selected, setSelected] = React.useState(new Date());
  const [filter, setFilter] = React.useState<Filter>("day");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const addRef = React.useRef<AddTaskHandle>(null);

  const mobile = useIsMobile();

  const marks = React.useMemo(() => {
    const m: Record<string, DayMark> = {};
    for (const t of tasks) {
      if (t.done) continue;
      const cur = m[t.date] ?? { count: 0, important: false };
      m[t.date] = { count: cur.count + 1, important: cur.important || t.important };
    }
    return m;
  }, [tasks]);

  const closeSettings = React.useCallback(() => setSettingsOpen(false), []);

  const pickDate = (d: Date) => {
    setSelected(d);
    setFilter("day");
  };

  // اعمال تنظیمات شیشه روی کل برنامه
  const { glassBlur, glassTint, glassEdge, glassDark } = store.settings;
  React.useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--g-blur", `${glassBlur}px`);
    r.setProperty("--g-tint", String(glassTint / 100));
    r.setProperty("--g-edge", String(glassEdge / 100));
    r.setProperty("--g-dark", String((glassDark ?? 0) / 100));
  }, [glassBlur, glassTint, glassEdge, glassDark]);

  // حالت رنگ روشن/تیره
  const light = isLightTheme(store.settings);
  React.useEffect(() => {
    document.documentElement.classList.toggle("theme-light", light);
    void window.yadnegar?.setStatusBar?.(light);
  }, [light]);

  // برای عکس‌هایی که قبلاً انتخاب شده‌اند، روشن بودن را یک بار بسنج
  const { background, bgImage, bgImageLight } = store.settings;
  React.useEffect(() => {
    if (background === "image" && bgImage && bgImageLight === undefined) {
      imageIsLight(bgImage).then((v) => store.setSettings((s) => ({ ...s, bgImageLight: v })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background, bgImage, bgImageLight]);

  // میانبر Ctrl+N برای کار جدید
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "n" || e.key === "N" || e.key === "د")) {
        e.preventDefault();
        addRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // دکمهٔ میکروفون کادر «کار تازه»
  React.useEffect(() => {
    const on = () => setVoiceOpen(true);
    window.addEventListener("yadnegar:voice", on);
    return () => window.removeEventListener("yadnegar:voice", on);
  }, []);

  // اندازهٔ برنامه روی گوشی (در ویندوز با zoom خود Electron انجام می‌شود)
  const uiScale = store.settings.uiScale ?? "medium";
  React.useEffect(() => {
    if (window.yadnegar?.platform !== "android") return;
    const z = uiScale === "small" ? 0.88 : uiScale === "large" ? 1.12 : 1;
    document.documentElement.style.setProperty("--ui-zoom", String(z));
    document.documentElement.classList.toggle("ui-zoomed", z !== 1);
  }, [uiScale]);

  const overlays = (
    <>
      <ReminderToasts
        reminders={store.reminders}
        onDone={(id) => {
          store.updateTask(id, { done: true });
          store.dismissReminder(id);
        }}
        onSnooze={store.snooze}
        onDismiss={store.dismissReminder}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={store.settings}
        onChange={store.setSettings}
        isDesktop={store.isDesktop}
        sync={sync}
      />
      <VoiceDialog
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        sync={sync}
        onAdd={(list) => list.forEach((t) => store.addTask({ title: t.title, date: t.date, time: t.time, important: t.important }))}
        onNeedAccount={() => {
          setVoiceOpen(false);
          try {
            localStorage.setItem("yadnegar-settings-tab", "account");
          } catch {
            /* ignore */
          }
          setSettingsOpen(true);
        }}
      />
    </>
  );

  const layout = normalizeLayout(store.settings.layout);

  const blocks: Record<BlockId, React.ReactNode> = {
    clock: <ClockCard tasks={tasks} className="h-full" />,
    gregorian: (
      <GregorianCard
        className="h-full"
        zone={store.settings.worldZone}
        onZoneChange={(z) => store.setSettings((s) => ({ ...s, worldZone: z }))}
      />
    ),
    calendar: (
      <Glass contentClassName="p-4">
        <GlassCalendar
          variant="bare"
          defaultView="monthly"
          showFooter={false}
          compact
          selectedDate={selected}
          onDateSelect={pickDate}
          marks={marks}
        />
      </Glass>
    ),
    notes: (
      <NotesCard
        className="h-full min-h-0"
        tasks={tasks}
        note={store.settings.quickNote}
        onNoteChange={(v) => store.setSettings((s) => ({ ...s, quickNote: v }))}
      />
    ),
    upcoming: <UpcomingStrip tasks={tasks} onPick={pickDate} className="h-full min-w-0" />,
    tasks: (
      <Glass className="h-full min-h-0" contentClassName="flex h-full flex-col p-6">
        <TaskPanel store={store} selected={selected} filter={filter} setFilter={setFilter} addRef={addRef} />
      </Glass>
    ),
  };

  if (mobile) {
    return (
      <>
        <Backdrop settings={store.settings} />
        <MobileApp
          store={store}
          selected={selected}
          pickDate={pickDate}
          filter={filter}
          setFilter={setFilter}
          marks={marks}
          addRef={addRef}
          onSettings={() => setSettingsOpen(true)}
          settingsOpen={settingsOpen}
          closeSettings={closeSettings}
        />
        {overlays}
      </>
    );
  }

  return (
    <div dir="rtl" className="flex h-full flex-col">
      <Backdrop settings={store.settings} />
      <TitleBar onSettings={() => setSettingsOpen(true)} />

      {/* دو ستون؛ ترتیب بخش‌های هر ستون قابل تغییر است */}
      <main className="flex min-h-0 flex-1 gap-5 px-6 pt-2 pb-6">
        {(["left", "right"] as const).map((col) => (
          <LayoutColumn
            key={col}
            order={layout[col]}
            blocks={blocks}
            onCommit={(next) => store.setSettings((s) => ({ ...s, layout: { ...normalizeLayout(s.layout), [col]: next } }))}
            className={col === "left" ? "flex min-h-0 w-[340px] shrink-0 flex-col gap-5" : "flex min-h-0 min-w-0 flex-1 flex-col gap-5"}
          />
        ))}
      </main>

      {overlays}
    </div>
  );
}
