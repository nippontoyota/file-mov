import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/modules/identity/session";
import { changeMembership, createStaffAccount, finishStaffAccount, createStaffTeam } from "@/modules/identity/actions";
import { SearchSelect } from "@/components/search-select";
import { AccountFields } from "@/components/workspace/account-fields";
import { ActionForm } from "@/components/action-form";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Icon } from "@/components/workspace/icon";
import { roles } from "@/components/workspace/roles";
import styles from "@/components/workspace/workspace.module.css";

const actionLabels: Record<string, string> = {
  "booking.draft_created": "Booking draft created", "booking.draft_updated": "Booking draft updated",
  "staff.account_created": "Account created", "staff.team_created": "Team created", "staff.invited": "Account request saved", "staff.invitation_accepted": "Invitation accepted",
  "membership.activated": "Assignment activated", "membership.deactivated": "Assignment deactivated",
};

export default async function Staff() {
  const { client, profile, memberships: own } = await requireAdmin();
  const branches = own.filter(m => m.role === "Admin").sort((a, b) => (a.branches?.name || "").localeCompare(b.branches?.name || ""));
  const branchIds = branches.map(m => m.branch_id);
  const [assignments, teams, invitations, audit] = await Promise.all([
    client.from("memberships").select("id,role,active,revision,staff_id,branch_id,staff(display_name),branches(name),teams(name)").in("branch_id", branchIds).order("role"),
    client.from("teams").select("id,name,branch_id,branches(name)").in("branch_id", branchIds),
    client.from("staff_invitations").select("id,email,display_name,role,expires_at,accepted_at,branches(name)").in("branch_id", branchIds).order("created_at", { ascending: false }).limit(50),
    client.from("audit_events").select("id,action,occurred_at,revision,reason,staff(display_name)").in("branch_id", branchIds).order("id", { ascending: false }).limit(30),
  ]);
  if (assignments.error || teams.error || invitations.error || audit.error) throw new Error("Staff access unavailable");
  const activeCount = new Set(assignments.data.filter(m => m.active).map(m => m.staff_id)).size;
  const pendingCount = invitations.data.filter(i => !i.accepted_at && new Date(i.expires_at) > new Date()).length;
  return <WorkspaceShell profile={profile} memberships={own} page="staff">
    <div className={styles.heading}><div><span className={styles.kicker}><Icon name="users" />Administration</span><h1>Staff access</h1><p>Give every team member the right access. Manage individual accounts within your assigned branches.</p></div><a href="#invite" className={styles.primaryLink}><Icon name="invite" />Add staff</a></div>
    <div className={styles.summaryStrip} aria-label="Staff access summary">
      <div className={styles.summaryItem}><Icon name="users" /><div><strong>{activeCount}</strong><small>Active staff accounts</small></div></div>
      <div className={styles.summaryItem}><Icon name="invite" /><div><strong>{pendingCount}</strong><small>Pending in latest 50 requests</small></div></div>
      <div className={styles.summaryItem}><Icon name="branch" /><div><strong>{new Set(branchIds).size}</strong><small>Branches you administer</small></div></div>
    </div>
    <div className={styles.adminGrid}>
    <section className={styles.surface} id="invite" tabIndex={-1}><div className={styles.sectionHeading}><Icon name="users" /><h2>Add a staff account</h2></div><p>Set the staff member’s login and assign their branch and role.</p>
      <ActionForm action={createStaffAccount} label="Create staff account">
        <input type="hidden" name="operation" value={randomUUID()} />
        <AccountFields branches={branches.map(b => ({ id: b.branch_id, name: b.branches?.name || "Branch" }))} teams={teams.data} />
      </ActionForm>
      <details className={styles.addTeam}><summary>Add a branch team<Icon name="chevron" /></summary><p>Use the actual team name. Sales Officers and Team Leaders require a team assignment.</p>
        <ActionForm action={createStaffTeam} label="Add team" secondary>
          <input type="hidden" name="operation" value={randomUUID()} />
          <label>Team branch<SearchSelect name="branch" label="Team branch" required defaultValue={branches[0]?.branch_id} options={branches.map(b=>({value:b.branch_id,label:b.branches?.name || "Branch"}))} /></label>
          <label>Team name<input name="name" required maxLength={100} /></label>
        </ActionForm>
      </details>
    </section>
    <section className={styles.surface} id="staff-assignments" tabIndex={-1}><div className={styles.sectionHeading}><Icon name="users" /><h2>Assignments</h2></div><p className="muted">Deactivation removes this assignment immediately, including for an existing session. Other explicit assignments remain active.</p>
      {assignments.data?.map(m => <details key={`${m.id}-${m.revision}`}><summary><span className={styles.personMark}><Icon name={roles[m.role]?.icon || "users"} /></span><span className={styles.summaryName}>{m.staff?.display_name} · {m.role}<small className={styles.branchCaption}>{m.branches?.name}</small></span> <span className="pill" data-active={m.active}>{m.active ? "Active" : "Inactive"}</span><Icon name="chevron" /></summary><p>{m.branches?.name} / {m.teams?.name || "Branch assignment"}</p>
        {m.role !== "Admin" ? <ActionForm action={changeMembership} label={m.active ? "Deactivate assignment" : "Reactivate assignment"} secondary>
          <input type="hidden" name="membership" value={m.id} /><input type="hidden" name="revision" value={m.revision} /><input type="hidden" name="operation" value={randomUUID()} /><input type="hidden" name="active" value={String(!m.active)} /><label>Reason<textarea name="reason" required maxLength={500} rows={2} /></label>
        </ActionForm> : <p className="muted">Administrator assignments require the controlled setup procedure.</p>}
      </details>)}
    </section>
    <section className={`${styles.surface} ${styles.wideSection}`} id="invitations" tabIndex={-1}><div className={styles.sectionHeading}><Icon name="invite" /><h2>Recent account requests</h2><span className={styles.badge}>Latest 50</span></div>{!invitations.data?.length && <p>No account requests yet.</p>}
      {invitations.data?.map(i => <details key={i.id}><summary><span className={styles.personMark}><Icon name="invite" /></span><span className={styles.summaryName}>{i.display_name} · {i.role}</span> <span className="pill">{i.accepted_at ? "Completed" : new Date(i.expires_at) <= new Date() ? "Expired" : "Pending"}</span><Icon name="chevron" /></summary><p>{i.email} · {i.branches?.name}</p><p>Request ID: <code>{i.id}</code></p>{!i.accepted_at && <ActionForm action={finishStaffAccount} label="Finish account setup" secondary><input type="hidden" name="invitation" value={i.id} /></ActionForm>}</details>)}
    </section>
    <section className={`${styles.surface} ${styles.wideSection}`} id="history" tabIndex={-1}><div className={styles.sectionHeading}><Icon name="history" /><h2>Recent access history</h2><span className={styles.badge}>Latest 30</span></div><div className="tableWrap" tabIndex={0} role="region" aria-label="Scrollable access history"><table><thead><tr><th>Time (India)</th><th>Staff member</th><th>Action</th><th>Revision</th><th>Reason</th></tr></thead><tbody>{audit.data?.map(a => <tr key={a.id}><td>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(a.occurred_at))}</td><td>{a.staff?.display_name ?? "Former staff member"}</td><td>{actionLabels[a.action] || "Access change"}</td><td>{a.revision ?? "Not recorded"}</td><td>{a.reason ?? "Not recorded"}</td></tr>)}</tbody></table></div>{!audit.data?.length && <p>No access changes recorded yet.</p>}</section>
    </div>
    <p className={styles.accessNote}><Icon name="shield" />Staff administration does not grant booking approval or pilot exception authority.</p>
  </WorkspaceShell>;
}
