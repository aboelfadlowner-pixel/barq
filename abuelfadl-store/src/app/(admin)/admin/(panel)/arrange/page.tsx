import type { Metadata } from "next";
import { ArrangePage } from "@/features/admin/ArrangePage";

export const metadata: Metadata = { title: "ترتيب المنتجات" };

export default function AdminArrangePage() {
  return <ArrangePage />;
}
