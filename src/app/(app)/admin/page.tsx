import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminToggle } from "@/components/AdminToggle";
import { Avatar } from "@/components/ui";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user!.id).single();
  if (!me?.is_admin) redirect("/projects");

  const { data: people } = await supabase.from("profiles").select("id,email,full_name,is_admin,created_at").order("created_at");
  return (
    <main className="page">
      <div className="page-head">
        <h1>Workspace people</h1>
      </div>
      <p style={{ color: "var(--ink-2)", marginBottom: 16, maxWidth: "65ch" }}>
        Admins can create projects and see every project. Project roles (manager, developer, tester) are set per project when someone is invited.
      </p>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Person</th><th>Access</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {((people ?? []) as Profile[]).map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="person">
                    <Avatar name={p.full_name || p.email} size={32} />
                    <div>{p.full_name}<small>{p.email}</small></div>
                  </div>
                </td>
                <td><span className="chip" data-tone={p.is_admin ? "violet" : undefined}>{p.is_admin ? "Admin" : "Member"}</span></td>
                <td style={{ textAlign: "right" }}><AdminToggle userId={p.id} isAdmin={p.is_admin} self={p.id === user!.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
