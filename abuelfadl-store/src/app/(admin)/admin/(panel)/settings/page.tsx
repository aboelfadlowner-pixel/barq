import type { Metadata } from "next";
import { SettingsPage } from "@/features/admin/SettingsPage";

export const metadata: Metadata = { title: "الإعدادات" };

export default function StoreSettingsPage() {
  return <SettingsPage />;
}
