import { redirect } from "next/navigation";
import { AdminNav } from "@/features/admin/AdminNav";
import { getRole } from "@/server/auth";

/** Every dashboard page except the login: requires a session (admin or call center; admin-only pages check again). (The API checks the session again on every call.) */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await getRole())) redirect("/admin/login");
  return (
    <div className="adm">
      <AdminNav />
      <main className="adm-main">{children}</main>
    </div>
  );
}
