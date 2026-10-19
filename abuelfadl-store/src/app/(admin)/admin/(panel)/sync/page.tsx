import type { Metadata } from "next";
import { SyncPage } from "@/features/admin/SyncPage";
import { adminOnlyPage } from "@/server/auth";

export const metadata: Metadata = { title: "تحديث الأسعار" };

export default async function PricesSyncPage() {
  await adminOnlyPage();
  return <SyncPage />;
}
