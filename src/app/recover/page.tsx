import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { recoverPassword } from "@/modules/identity/actions";
export default function Recover() {
  return <section className="narrow panel"><p className="eyebrow">Staff access</p><h1>Reset your password</h1><p>Enter your individual staff email to request a reset link.</p><ActionForm action={recoverPassword} label="Request reset link"><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label></ActionForm><p><Link href="/login">Back to sign in</Link></p></section>;
}
