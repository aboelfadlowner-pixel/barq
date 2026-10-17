import type { Metadata } from "next";
import { OrderDetails } from "@/features/admin/OrderDetails";

export const metadata: Metadata = { title: "تفاصيل الطلب" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetails id={id} />;
}
