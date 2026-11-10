import "server-only";
import { redirect } from "next/navigation";
import { isConfigured, userClient } from "@/lib/supabase/server";

export async function requireStaff() {
  if (!isConfigured()) redirect("/login");
  const client = await userClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  const [profile, scope] = await Promise.all([
    client.from("staff").select("id,display_name,active").eq("id", user.id).maybeSingle(),
    client.from("memberships").select("id,branch_id,team_id,role,revision,branches(name),teams(name)")
      .eq("staff_id", user.id).eq("active", true),
  ]);
  if (profile.error || scope.error) throw new Error("Workspace unavailable");
  if (!profile.data?.active || !scope.data?.length) redirect("/no-access");
  return { client, user, profile: profile.data, memberships: scope.data };
}

export async function requireAdmin() {
  const session = await requireStaff();
  if (!session.memberships.some(m => m.role === "Admin")) redirect("/workspace");
  return session;
}
