"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isConfigured, userClient } from "@/lib/supabase/server";
import { invitationClient } from "@/lib/supabase/admin";
import { safeError, textField, uuid } from "@/lib/errors";
import { requireAdmin } from "./session";
import type { Database } from "@/lib/database.types";

export type ActionState = { error?: string; success?: string; link?: string };

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  if (!isConfigured()) return { error: "The workspace is not connected. Ask your administrator to finish local setup." };
  const email = textField(form, "email", 254);
  const password = form.get("password");
  if (!email || typeof password !== "string" || !password || password.length > 1024) return { error: "Enter your email and password." };
  const client = await userClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: "Sign-in failed. Check your email and password, or try again when the connection is available." };
  redirect("/workspace");
}

export async function signOut() {
  const client = await userClient();
  await client.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function recoverPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const email = textField(form, "email", 254);
  if (!email || !isConfigured()) return { error: "Enter your staff email. The workspace must be connected." };
  const client = await userClient();
  const { error } = await client.auth.resetPasswordForEmail(email);
  if (error) return { error: "The request could not be completed. Try again later." };
  return { success: "If this email belongs to an account, a password reset link will arrive. Check your inbox." };
}

export async function setPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const password = form.get("password");
  if (typeof password !== "string" || password.length < 6 || password.length > 128 || password !== form.get("confirm")) {
    return { error: "Use 6–128 characters and enter the same password twice." };
  }
  const client = await userClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: "This link has expired. Request a new link." };
  const { error } = await client.auth.updateUser({ password });
  if (error) return { error: "The password could not be saved. Try a different password or request a new link." };
  redirect("/workspace");
}

export async function createInvitation(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireAdmin();
  const operation = textField(form, "operation", 36);
  const branch = textField(form, "branch", 36);
  const team = textField(form, "team", 36);
  const role = textField(form, "role", 20);
  const roles = ["SO", "TL", "SM", "BO", "Insurance", "Accounts", "Cashier", "Accessories", "Security"];
  if (!uuid.test(operation) || !uuid.test(branch) || (team && !uuid.test(team)) || !roles.includes(role)) return { error: "Select a valid branch, team and role." };
  const { data, error } = await client.rpc("create_staff_invitation", {
    p_operation: operation, p_branch: branch, p_team: team || undefined, p_role: role as Database["public"]["Enums"]["staff_role"],
    p_email: textField(form, "email", 254), p_name: textField(form, "name", 100),
  });
  if (error || !data) return { error: safeError(error) };
  revalidatePath("/staff");
  return { success: "Invitation saved. Prepare its private link below; no email has been sent." };
}

export async function prepareInvitationLink(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireAdmin();
  const id = textField(form, "invitation", 36);
  if (!uuid.test(id)) return { error: "Select a valid invitation." };
  // Read under the administrator's JWT/RLS immediately before the privileged Auth operation.
  const { data: invite } = await client.from("staff_invitations")
    .select("id,email,expires_at,accepted_at").eq("id", id).maybeSingle();
  if (!invite || invite.accepted_at || new Date(invite.expires_at) <= new Date()) return { error: "This invitation is unavailable." };
  try {
    const { data, error } = await invitationClient().auth.admin.generateLink({ type: "invite", email: invite.email });
    if (error || !data.properties?.hashed_token) return { error: "Could not prepare a link. If the account already exists, the staff member can sign in and accept the saved invitation." };
    const link = new URL("/auth/confirm", process.env.APP_ORIGIN || "http://127.0.0.1:3000");
    link.searchParams.set("token_hash", data.properties.hashed_token);
    link.searchParams.set("type", "invite");
    link.searchParams.set("invitation", invite.id);
    return { link: link.href, success: "Private, single-use link prepared. Share only with the named staff member through your approved channel." };
  } catch { return { error: "Invitation service is unavailable. The saved invitation remains pending." }; }
}

export async function changeMembership(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireAdmin();
  const id = textField(form, "membership", 36);
  const operation = textField(form, "operation", 36);
  const revision = Number(form.get("revision"));
  const active = form.get("active");
  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision) || revision < 1 || !["true", "false"].includes(String(active))) return { error: "Refresh and select a current assignment." };
  const { error } = await client.rpc("set_membership_active", {
    p_operation: operation, p_membership: id, p_revision: revision, p_active: active === "true", p_reason: textField(form, "reason", 500),
  });
  if (error) return { error: safeError(error) };
  revalidatePath("/staff");
  return { success: "Access updated. History is retained." };
}

export async function acceptInvitation(_: ActionState, form: FormData): Promise<ActionState> {
  const client = await userClient();
  const id = textField(form, "invitation", 36);
  if (!uuid.test(id)) return { error: "Enter the invitation ID supplied by your administrator." };
  const { error } = await client.rpc("accept_staff_invitation", { p_invitation: id });
  if (error) return { error: safeError(error) };
  redirect("/workspace");
}

export async function createStaffAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireAdmin();
  const password = form.get("password");
  if (typeof password !== "string" || password.length !== 6 || /\s/.test(password)) return { error: "Set a password of exactly 6 characters, without spaces." };
  const operation = textField(form, "operation", 36);
  const branch = textField(form, "branch", 36);
  const team = textField(form, "team", 36);
  const role = textField(form, "role", 20);
  const email = textField(form, "email", 254).toLowerCase();
  const name = textField(form, "name", 100);
  if (!uuid.test(operation) || !uuid.test(branch) || (team && !uuid.test(team)) || !["SO", "TL", "SM", "BO", "Insurance", "Accounts", "Cashier", "Accessories", "Security"].includes(role)) return { error: "Select a valid branch, team and role." };
  // Reserve the request with the administrator's JWT before any Auth operation.
  // Passwords never enter application tables, audit history, action results or logs.
  const { data: request, error } = await client.rpc("create_staff_invitation", {
    p_operation: operation, p_branch: branch, p_team: team || undefined,
    p_role: role as Database["public"]["Enums"]["staff_role"], p_email: email, p_name: name,
  });
  if (error || !request) return { error: safeError(error) };
  revalidatePath("/staff");
  const { data: existing } = await client.from("staff_invitations").select("accepted_at").eq("id", request).single();
  if (existing?.accepted_at) return { success: "This account was already created. Its password has not been changed." };
  let created = false;
  try {
    const result = await invitationClient().auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { filesdigi_invitation: request },
    });
    created = !result.error;
    // A retry may find the identity already created by this exact request.
    // The SQL command verifies Auth-owned metadata, not caller-supplied user IDs.
    const completion = await client.rpc("complete_staff_account", { p_invitation: request });
    if (completion.error) return { error: created
      ? "The login was created, but its assignment could not be completed. Use Finish account setup under Recent account requests; the original password is retained."
      : "Account creation could not be completed. Check the email; an existing account is never overwritten. You can retry a pending request below." };
  } catch { return { error: "Account setup could not be confirmed. Check Recent account requests before retrying; existing passwords are never overwritten." }; }
  revalidatePath("/staff");
  return { success: created ? "Staff account created. The staff member can sign in using the email and password you set. No email has been sent." : "Account setup recovered from an earlier attempt. Its original password is unchanged." };
}

export async function finishStaffAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireAdmin();
  const request = textField(form, "invitation", 36);
  if (!uuid.test(request)) return { error: "Select a valid account request." };
  const { error } = await client.rpc("complete_staff_account", { p_invitation: request });
  if (error) return { error: "This request has no prepared login, has expired, or belongs to another administrator. No account or password was changed." };
  revalidatePath("/staff");
  return { success: "Account assignment is complete. The original password is unchanged." };
}

export async function createStaffTeam(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireAdmin();
  const operation = textField(form, "operation", 36);
  const branch = textField(form, "branch", 36);
  if (!uuid.test(operation) || !uuid.test(branch)) return { error: "Select an authorized branch." };
  const { error } = await client.rpc("create_staff_team", { p_operation: operation, p_branch: branch, p_name: textField(form, "name", 100) });
  if (error) return { error: safeError(error) };
  revalidatePath("/staff");
  return { success: "Team added to this branch." };
}
