import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/vazirmatn";
import "./index.css";
import App from "./App";
import { ReminderPopup } from "./reminder-popup";

// پنجرهٔ یادآوری با آدرس #popup?... باز می‌شود
const hash = window.location.hash;
const isPopup = hash.startsWith("#popup");
const params = new URLSearchParams(hash.split("?")[1] ?? "");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isPopup ? <ReminderPopup params={params} /> : <App />}</React.StrictMode>
);
