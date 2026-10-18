import type { Metadata } from "next";
import { SyncPage } from "@/features/admin/SyncPage";

export const metadata: Metadata = { title: "تحديث الأسعار" };

export default function PricesSyncPage() {
  return <SyncPage />;
}
