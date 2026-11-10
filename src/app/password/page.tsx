import { ActionForm } from "@/components/action-form";
import { setPassword } from "@/modules/identity/actions";
import { userClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export default async function Password() {
  const client = await userClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  return <section className="narrow panel"><h1>Choose your password</h1><p>Use at least 6 characters. Keep your individual account private.</p><ActionForm action={setPassword} label="Save password"><label>New password<input name="password" type="password" minLength={6} maxLength={128} required autoComplete="new-password" /></label><label>Confirm password<input name="confirm" type="password" minLength={6} maxLength={128} required autoComplete="new-password" /></label></ActionForm></section>;
}
