"use client";
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/modules/identity/actions";

export function ActionForm({ action, children, label, secondary = false }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: ReactNode; label: string; secondary?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success && !state.link) formRef.current?.reset();
  }, [state]);
  return <form ref={formRef} action={submit} onSubmit={event => {
    // Retain entered fields and the operation identity after rejected/timed-out commands.
    // The native server action remains the fallback before hydration.
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => submit(form));
  }}>
    <fieldset disabled={pending}>{children}
      <button className={secondary ? "secondary" : ""} disabled={pending}>{pending ? "Please wait…" : label}</button>
    </fieldset>
    {state.error && <p role="alert" className="error">{state.error}</p>}
    {state.success && <p role="status" className="success">{state.success}</p>}
    {state.link && <label>Private invitation link<textarea readOnly rows={4} value={state.link} onFocus={e => e.target.select()} /></label>}
  </form>;
}
