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
import { useTasks } from "@/hooks/use-tasks";
import { useSync } from "@/hooks/use-sync";
import { Backdrop, imageIsLight, isLightTheme } from "@/components/todo/backdrop";

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
  const { glassBlur, glassTint, glassEdge } = store.settings;
  React.useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--g-blur", `${glassBlur}px`);
    r.setProperty("--g-tint", String(glassTint / 100));
    r.setProperty("--g-edge", String(glassEdge / 100));
  }, [glassBlur, glassTint, glassEdge]);

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
    </>
  );

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

      {/* شبکهٔ ۲×۲: کارت‌های هر ردیف هم‌ارتفاع و هر ستون هم‌عرض هستند */}
      <main className="grid min-h-0 flex-1 grid-cols-[340px_1fr] grid-rows-[156px_88px_auto_minmax(0,1fr)] gap-5 px-6 pt-2 pb-6">
        <ClockCard tasks={tasks} className="col-start-1 row-start-1 h-full" />
        <UpcomingStrip tasks={tasks} onPick={pickDate} className="col-start-2 row-start-1 h-full min-w-0" />
        <GregorianCard
          className="col-start-1 row-start-2 h-full"
          zone={store.settings.worldZone}
          onZoneChange={(z) => store.setSettings((s) => ({ ...s, worldZone: z }))}
        />

        <Glass className="col-start-1 row-start-3" contentClassName="p-4">
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

        <NotesCard
          className="col-start-1 row-start-4 h-full min-h-0"
          tasks={tasks}
          note={store.settings.quickNote}
          onNoteChange={(v) => store.setSettings((s) => ({ ...s, quickNote: v }))}
        />

        <section className="col-start-2 row-span-3 row-start-2 flex min-h-0 min-w-0 flex-col">
          <Glass className="min-h-0 flex-1" contentClassName="flex h-full flex-col p-6">
            <TaskPanel store={store} selected={selected} filter={filter} setFilter={setFilter} addRef={addRef} />
          </Glass>
        </section>
      </main>

      {overlays}
    </div>
  );
}
