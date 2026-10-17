import type { Metadata } from "next";
import { ProductForm } from "@/features/admin/ProductForm";

export const metadata: Metadata = { title: "تعديل منتج" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductForm id={id} />;
}
