import type { Metadata } from "next";
import { ArrangePage } from "@/features/admin/ArrangePage";
import { adminOnlyPage } from "@/server/auth";

export const metadata: Metadata = { title: "ترتيب المنتجات" };

export default async function AdminArrangePage() {
  await adminOnlyPage();
  return <ArrangePage />;
}
