"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardStats } from "@/server/orders";
import { egp } from "./api";
import { Ic, useToast } from "./ui";

/** localStorage key: "off" when staff turned the alert off on this device. */
const STORAGE_KEY = "af_admin_order_alert";

let audio: AudioContext | null = null;

/** Short two-note chime made in the browser (no sound file). Browsers only play it after a click on the page. */
function chime() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const start = audio.currentTime;
    [880, 1320].forEach((frequency, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.frequency.value = frequency;
      osc.type = "sine";
      const t = start + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain).connect(audio!.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    // no audio support
  }
}

const readEnabled = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
};

/**
 * New-order alert: when the polled stats show more orders than before, plays a chime, shows a toast and (if allowed)
 * a browser notification. On by default; the choice is remembered per device.
 */
export function useNewOrderAlert(stats: DashboardStats | null) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(true);
  const lastTotal = useRef<number | null>(null);

  useEffect(() => setEnabled(readEnabled()), []);

  // Unlock audio on the first click anywhere (browsers block sound until the user interacts with the page).
  useEffect(() => {
    const unlock = () => {
      try {
        audio ??= new AudioContext();
        void audio.resume();
      } catch {
        // ignore
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!stats) return;
    const previous = lastTotal.current;
    lastTotal.current = stats.totalOrders;
    if (previous === null || stats.totalOrders <= previous || !enabled) return;
    const added = stats.totalOrders - previous;
    const latest = stats.latestOrders[0];
    const text = added > 1 ? `${added} طلبات جديدة` : latest ? `طلب جديد ${latest.number} · ${latest.customer.name} · ${egp(latest.total)}` : "طلب جديد";
    chime();
    toast(`🔔 ${text}`);
    try {
      if ("Notification" in window && Notification.permission === "granted") new Notification("أبو الفضل · طلب جديد", { body: text, icon: "/images/logo-icon.png" });
    } catch {
      // notifications not supported
    }
  }, [stats, enabled, toast]);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // ignore
    }
    if (next) {
      chime();
      try {
        if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
      } catch {
        // ignore
      }
    }
    toast(next ? "تم تشغيل تنبيه الطلبات الجديدة" : "تم إيقاف تنبيه الطلبات الجديدة");
  }, [enabled, toast]);

  return { enabled, toggle };
}

/** On/off button for the new-order alert. */
export function AlertToggle({ enabled, onToggle, className }: { enabled: boolean; onToggle: () => void; className?: string }) {
  return (
    <button type="button" className={className} onClick={onToggle} aria-pressed={enabled} title="صوت وإشعار عند وصول طلب جديد">
      <Ic name="bell" />
      {enabled ? "التنبيه مفعّل" : "التنبيه متوقف"}
    </button>
  );
}
