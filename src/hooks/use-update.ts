import * as React from "react";
import type { UpdateStatus } from "@/lib/types";

/** وضعیت به‌روزرسانی از GitHub Releases (از فرآیند اصلی) */
export function useUpdate() {
  const api = typeof window !== "undefined" ? window.yadnegar : undefined;
  const [status, setStatus] = React.useState<UpdateStatus>({ state: "idle" });
  const [version, setVersion] = React.useState<string>("");

  React.useEffect(() => {
    if (!api?.onUpdateStatus) return;
    api.appVersion?.().then(setVersion);
    api.getUpdate?.().then(setStatus);
    return api.onUpdateStatus(setStatus);
  }, [api]);

  return {
    supported: !!api?.checkUpdate,
    version,
    status,
    check: () => api?.checkUpdate?.(),
    download: () => api?.downloadUpdate?.(),
    install: () => api?.installUpdate?.(),
    openReleases: () => api?.openReleases?.(),
  };
}
