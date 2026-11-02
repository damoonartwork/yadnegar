// پل امن بین رابط کاربری و فرآیند اصلی
const { contextBridge, ipcRenderer } = require("electron");

function listen(channel, cb) {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("yadnegar", {
  load: () => ipcRenderer.invoke("load"),
  saveTasks: (tasks) => ipcRenderer.invoke("save-tasks", tasks),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  onTasksUpdated: (cb) => listen("tasks-updated", cb),
  onReminder: (cb) => listen("reminder", cb),
  testNotification: () => ipcRenderer.send("test-notification"),
  openNotificationSettings: () => ipcRenderer.send("open-notification-settings"),
  reminderAction: (id, action) => ipcRenderer.send("reminder-action", { id, action }),
  minimize: () => ipcRenderer.send("minimize"),
  close: () => ipcRenderer.send("close"),
  toggleMaximize: () => ipcRenderer.send("toggle-maximize"),
  onMaximizeChange: (cb) => listen("maximize-change", cb),
  togglePin: () => ipcRenderer.invoke("toggle-pin"),
  appVersion: () => ipcRenderer.invoke("app-version"),
  getUpdate: () => ipcRenderer.invoke("update-get"),
  checkUpdate: () => ipcRenderer.invoke("update-check"),
  downloadUpdate: () => ipcRenderer.invoke("update-download"),
  installUpdate: () => ipcRenderer.send("update-install"),
  openReleases: () => ipcRenderer.send("open-releases"),
  onUpdateStatus: (cb) => listen("update-status", cb),
});
