import type { Metadata } from "next";
import { SettingsPage } from "@/features/admin/SettingsPage";
import { adminOnlyPage } from "@/server/auth";

export const metadata: Metadata = { title: "الإعدادات" };

export default async function StoreSettingsPage() {
  await adminOnlyPage();
  return <SettingsPage />;
}
