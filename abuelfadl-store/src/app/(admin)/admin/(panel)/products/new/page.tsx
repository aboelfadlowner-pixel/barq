import type { Metadata } from "next";
import { ProductForm } from "@/features/admin/ProductForm";

export const metadata: Metadata = { title: "منتج جديد" };

export default function NewProductPage() {
  return <ProductForm />;
}
