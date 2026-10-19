import type { Metadata } from "next";
import { ReportsPage } from "@/features/admin/ReportsPage";
import { adminOnlyPage } from "@/server/auth";

export const metadata: Metadata = { title: "التقارير" };

export default async function AdminReportsPage() {
  await adminOnlyPage();
  return <ReportsPage />;
}
