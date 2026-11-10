import Link from "next/link";
import { hanken } from "@/lib/fonts";
import { ActionForm } from "@/components/action-form";
import { signIn } from "@/modules/identity/actions";
import { isConfigured } from "@/lib/supabase/server";
import { PasswordField } from "./password-field";
import { VehicleShowcase } from "./vehicle-showcase";
import styles from "./page.module.css";


export default function Login() {
  return <div className={`${styles.page} ${hanken.className}`}>
    <div className={styles.canvas}>
      <header className={styles.header}>
        <Link href="/login" className={styles.wordmark} aria-label="Nippon Toyota staff login">
          <svg viewBox="0 0 54 38" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="2"><ellipse cx="27" cy="19" rx="25" ry="16" /><ellipse cx="27" cy="19" rx="9" ry="16" /><ellipse cx="27" cy="12" rx="22" ry="8" /></g></svg>
          <span>NIPPON <strong>TOYOTA</strong></span>
        </Link>
      </header>
      <div className={styles.content}>
        <section className={styles.intro} aria-labelledby="welcome">
          <div className={styles.introCopy}>
            <h1 id="welcome">Booking files.<br /><span>Clear ownership.</span></h1>
          </div>
          <div className={styles.fileFlow} aria-label="File management scope">
            <span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h6l2 3h8v12H4zM4 11h16" /></svg>Booking documents</span>
            <span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H5v18h14V8zM14 3v5h5M8 14l3 3 5-6" /></svg>Approvals</span>
            <span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4" /></svg>File movement</span>
          </div>
          <VehicleShowcase />
        </section>
        <div className={styles.access}>
          <section className={styles.login} aria-labelledby="signin">
            <h2 id="signin">Your files.<br /> Your workspace.</h2>
            <p>Sign in with your staff account to continue.</p>
            {!isConfigured() && <p className="notice">The workspace is being set up. Contact your administrator for access.</p>}
            <ActionForm action={signIn} label="Sign in">
              <label>Email address<input aria-label="Email" name="email" type="email" placeholder="you@company.com" autoComplete="username" required maxLength={254} /></label>
              <PasswordField />
              <div className={styles.recovery}><Link href="/recover">Forgot password?</Link></div>
            </ActionForm>
            <div className={styles.secure}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4.5" y="8" width="11" height="9" rx="2" /><path d="M7 8V5a3 3 0 0 1 6 0v3M10 11v3" /></svg>Secure access. Your individual account.</div>
          </section>
          <p className={styles.help}>New to the team? <span>Contact your branch administrator.</span></p>
        </div>
      </div>
    </div>
  </div>;
}
