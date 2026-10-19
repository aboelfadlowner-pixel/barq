"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { StoreSettings } from "@/types/settings";

const SettingsContext = createContext<StoreSettings>(DEFAULT_SETTINGS);

/** Store settings from the dashboard (minimum order, notice strip, WhatsApp, orders paused). */
export function useSettings(): StoreSettings {
  return useContext(SettingsContext);
}

/** Gives client components the settings the root layout loaded on the server. */
export function SettingsProvider({ settings, children }: { settings: StoreSettings; children: React.ReactNode }) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

/** The minimum order amount, for server components (hero, footer) that cannot call the hook. */
export function MinOrderAmount() {
  return <>{useSettings().minOrder}</>;
}
