"use client";
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/modules/identity/actions";
import { toast } from "@/components/toast";

export function ActionForm({ action, children, label, secondary = false, disabled = false, disabledReason }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: ReactNode; label: string; secondary?: boolean;
  disabled?: boolean; disabledReason?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    } else if (state.success) {
      toast.success(state.success);
      if (!state.link) formRef.current?.reset();
    }
  }, [state]);
  return <form ref={formRef} action={submit} onSubmit={event => {
    if (disabled) { event.preventDefault(); return; }
    // Retain entered fields and the operation identity after rejected/timed-out commands.
    // The native server action remains the fallback before hydration.
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => submit(form));
  }}>
    <div title={disabled ? disabledReason : undefined} style={disabled ? { cursor: 'not-allowed', display: 'inline-block' } : undefined}>
      <fieldset disabled={pending || disabled}>{children}
        <button
          type="submit"
          className={secondary ? "secondary" : ""}
          disabled={pending || disabled}
          title={disabled ? disabledReason : undefined}
          style={disabled ? { opacity: 0.55, cursor: 'not-allowed', filter: 'grayscale(1)', background: '#8c9ba5', borderColor: '#8c9ba5', color: '#ffffff' } : undefined}
        >
          {pending ? "Please wait…" : label}
        </button>
      </fieldset>
    </div>
    {disabled && disabledReason && (
      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>{disabledReason}</p>
    )}
    {state.error && <p role="alert" className="error">{state.error}</p>}
    {state.success && <p role="status" className="success">{state.success}</p>}
    {state.link && <label>Private invitation link<textarea readOnly rows={4} value={state.link} onFocus={e => e.target.select()} /></label>}
  </form>;
}
