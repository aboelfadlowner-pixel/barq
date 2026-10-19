import type { Metadata } from "next";
import { ReportsPage } from "@/features/admin/ReportsPage";

export const metadata: Metadata = { title: "التقارير" };

export default function AdminReportsPage() {
  return <ReportsPage />;
}
