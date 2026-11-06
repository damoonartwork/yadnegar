import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/vazirmatn";
import "./index.css";
import App from "./App";
import { ReminderPopup } from "./reminder-popup";
import { installMobileBridge, isNative } from "./platform/mobile";

// پنجرهٔ یادآوری ویندوز با آدرس #popup?... باز می‌شود
const hash = window.location.hash;
const isPopup = hash.startsWith("#popup");
const params = new URLSearchParams(hash.split("?")[1] ?? "");

async function start() {
  if (isNative()) {
    document.documentElement.classList.add("is-mobile");
    await installMobileBridge();
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>{isPopup ? <ReminderPopup params={params} /> : <App />}</React.StrictMode>
  );
}
void start();
