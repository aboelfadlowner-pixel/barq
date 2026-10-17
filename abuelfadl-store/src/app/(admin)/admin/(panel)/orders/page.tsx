import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersList } from "@/features/admin/OrdersList";

export const metadata: Metadata = { title: "الطلبات" };

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersList />
    </Suspense>
  );
}
