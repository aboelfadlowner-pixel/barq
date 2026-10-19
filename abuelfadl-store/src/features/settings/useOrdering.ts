"use client";

import { useEffect, useState } from "react";
import { isWithinHours, outsideHoursMessage } from "@/lib/hours";
import { useSettings } from "./SettingsProvider";

/** How often the store re-checks the order hours while it is open. */
const CHECK_MS = 30_000;

/**
 * Whether the store takes orders right now: not paused from the dashboard and inside the order hours (Cairo time).
 * The hours are checked in the browser after the page loads (pages are cached, so the server cannot know the time)
 * and again every 30 seconds. `message` explains why ordering is off.
 */
export function useOrdering(): { canOrder: boolean; message: string } {
  const settings = useSettings();
  const [inHours, setInHours] = useState(true);

  useEffect(() => {
    const check = () => setInHours(isWithinHours(settings.orderHours));
    check();
    const timer = setInterval(check, CHECK_MS);
    return () => clearInterval(timer);
  }, [settings.orderHours]);

  if (!settings.ordersOpen) return { canOrder: false, message: settings.closedMessage };
  if (!inHours) return { canOrder: false, message: outsideHoursMessage(settings.orderHours) };
  return { canOrder: true, message: "" };
}
