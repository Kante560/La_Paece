"use client";

import { useEffect } from "react";

export default function ServiceWorker() {
  useEffect(() => {
    // Restore the saved theme before paint-sensitive interactions.
    const saved = localStorage.getItem("pt-theme");
    if (saved === "day" || saved === "night") {
      document.documentElement.setAttribute("data-theme", saved);
    }

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
