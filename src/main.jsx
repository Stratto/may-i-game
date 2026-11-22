import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ClaudeApp.jsx";

createRoot(document.getElementById("root")).render(React.createElement(App));

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
