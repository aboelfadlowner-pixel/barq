import { redirect } from "next/navigation";
import { AdminNav } from "@/features/admin/AdminNav";
import { isAdmin } from "@/server/auth";

/** Every dashboard page except the login: requires an admin session. (The API checks the session again on every call.) */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <div className="adm">
      <AdminNav />
      <main className="adm-main">{children}</main>
    </div>
  );
}
