import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsList } from "@/features/admin/ProductsList";

export const metadata: Metadata = { title: "المنتجات" };

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsList />
    </Suspense>
  );
}
