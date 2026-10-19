import type { Metadata } from "next";
import { ProductForm } from "@/features/admin/ProductForm";
import { adminOnlyPage } from "@/server/auth";

export const metadata: Metadata = { title: "تعديل منتج" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await adminOnlyPage();
  const { id } = await params;
  return <ProductForm id={id} />;
}
