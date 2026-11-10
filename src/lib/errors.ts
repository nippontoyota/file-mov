export function safeError(error: { code?: string } | null): string {
  switch (error?.code) {
    case "42501": return "You no longer have permission for this action. Refresh your workspace or contact your administrator.";
    case "40001": return "This record changed. Refresh and review the latest version before trying again.";
    case "22023": case "23514": case "23502": case "23503":
      return "Check the fields and selected scope. Use a new request only if you have changed the details.";
    case "23505": return "That assignment already exists. Review the current staff access.";
    default: return "The update could not be confirmed. Refresh to check the result, then retry the same request if needed.";
  }
}
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function textField(form: FormData, key: string, max: number) {
  const value = form.get(key);
  return typeof value === "string" && value.trim().length <= max ? value.trim() : "";
}
