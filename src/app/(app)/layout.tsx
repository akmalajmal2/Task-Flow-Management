import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppProvider } from "@/store/app-store";
import { TopBar } from "@/components/TopBar";
import { Toasts } from "@/components/Toasts";
import { ConfirmHost } from "@/components/ConfirmHost";
import { NavSignal } from "@/lib/nav";
import type { Notice, Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: me }, { data: notices }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,is_admin").eq("id", user.id).single(),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30),
  ]);
  if (!me) redirect("/login");

  return (
    <AppProvider me={me as Profile} notices={(notices ?? []) as Notice[]}>
      <TopBar />
      <div className="route">{children}</div>
      <NavSignal />
      <Toasts />
      <ConfirmHost />
    </AppProvider>
  );
}
