"use client";

import { useState } from "react";
import styles from "./page.module.css";

export function PasswordField() {
  const [visible, setVisible] = useState(false);
  return <div className={styles.passwordField}>
    <label htmlFor="login-password">Password</label>
    <div className={styles.passwordInput}>
      <input id="login-password" name="password" type={visible ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" required />
      <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} aria-controls="login-password" onClick={() => setVisible(value => !value)}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg>
      </button>
    </div>
  </div>;
}
