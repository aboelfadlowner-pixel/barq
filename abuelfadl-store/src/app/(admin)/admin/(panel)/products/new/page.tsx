import type { Metadata } from "next";
import { ProductForm } from "@/features/admin/ProductForm";
import { adminOnlyPage } from "@/server/auth";

export const metadata: Metadata = { title: "منتج جديد" };

export default async function NewProductPage() {
  await adminOnlyPage();
  return <ProductForm />;
}
