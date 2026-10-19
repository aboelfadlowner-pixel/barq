import type { Metadata } from "next";
import { CustomersPage } from "@/features/admin/CustomersPage";

export const metadata: Metadata = { title: "العملاء" };

export default function AdminCustomersPage() {
  return <CustomersPage />;
}
