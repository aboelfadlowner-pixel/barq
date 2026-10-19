import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/admin/LoginForm";
import { getRole } from "@/server/auth";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only same-site dashboard paths, so the link cannot send people to another site.
  const target = next?.startsWith("/admin") ? next : "/admin";
  if (await getRole()) redirect(target);
  return <LoginForm next={target} devHint={process.env.NODE_ENV !== "production" && !process.env.ADMIN_PASSWORD} />;
}
