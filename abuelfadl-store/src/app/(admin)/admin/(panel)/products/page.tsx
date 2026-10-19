import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsList } from "@/features/admin/ProductsList";
import { adminOnlyPage } from "@/server/auth";

export const metadata: Metadata = { title: "المنتجات" };

export default async function ProductsPage() {
  await adminOnlyPage();
  return (
    <Suspense>
      <ProductsList />
    </Suspense>
  );
}
