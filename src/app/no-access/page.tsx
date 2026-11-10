import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { acceptInvitation, signOut } from "@/modules/identity/actions";
export default function NoAccess() {
  return <section className="narrow panel"><h1>No active assignment</h1><p>Your account has no active staff scope. Ask your administrator to review your access.</p><details><summary>Accept an existing invitation</summary><ActionForm action={acceptInvitation} label="Accept invitation"><label>Invitation ID<input name="invitation" required maxLength={36} /></label></ActionForm></details><p><Link href="/workspace">Check access again</Link></p><form action={signOut}><button className="secondary">Sign out</button></form></section>;
}
