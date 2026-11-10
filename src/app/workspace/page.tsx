import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Icon } from "@/components/workspace/icon";
import { roles } from "@/components/workspace/roles";
import styles from "@/components/workspace/workspace.module.css";

export default async function Workspace() {
  const { profile, memberships } = await requireStaff();
  const isAdmin = memberships.some(m => m.role === "Admin");
  const canUseBookings = memberships.some(m => ["SO", "TL", "SM"].includes(m.role));
  const canCreateBooking = memberships.some(m => m.role === "SO");
  const assignedRoles = [...new Set(memberships.map(m => m.role))];
  return <WorkspaceShell profile={profile} memberships={memberships} page="workspace">
    <div className={styles.heading}>
      <div><span className={styles.kicker}><Icon name="home" />Your workspace</span><h1>Welcome, {profile.display_name}.</h1><p>Your team, your access and your next steps. All in one place.</p></div>
      {isAdmin && <a className={styles.primaryLink} href="/staff#invite"><Icon name="invite" />Add a staff account</a>}
    </div>
    <div className={styles.overviewGrid}>
      <div>
        <section className={styles.surface} id="assignments" tabIndex={-1} aria-labelledby="assignments-heading">
          <div className={styles.sectionHeading}><Icon name="shield" /><h2 id="assignments-heading">My assignments</h2><span className={styles.badge}>{memberships.length} active</span></div>
          {memberships.map(m => <div className={styles.assignment} key={m.id}>
            <span className={styles.roleIcon}><Icon name={roles[m.role]?.icon || "shield"} /></span>
            <div><h3>{roles[m.role]?.name || m.role}</h3><p>{m.branches?.name}</p><small>{m.teams?.name || "Branch assignment"}</small></div><span className={`${styles.badge} ${styles.active}`}>Active</span>
          </div>)}
        </section>
        {isAdmin && <section className={styles.surface} aria-labelledby="admin-heading">
          <div className={styles.sectionHeading}><Icon name="settings" /><h2 id="admin-heading">Administration</h2></div>
          <Link className={styles.adminLink} href="/staff"><Icon name="users" /><span><strong>Manage staff</strong><small>Review roles and activate or deactivate assignments</small></span><Icon name="arrow" /></Link>
          <a className={styles.adminLink} href="/staff#invitations"><Icon name="invite" /><span><strong>Review account requests</strong><small>Review pending or completed account setup</small></span><Icon name="arrow" /></a>
          <a className={styles.adminLink} href="/staff#history"><Icon name="history" /><span><strong>View access history</strong><small>Trace account creation and assignment changes</small></span><Icon name="arrow" /></a>
        </section>}
        <section className={styles.surface} aria-labelledby="role-heading">
          <div className={styles.sectionHeading}><Icon name="document" /><h2 id="role-heading">Your role in the workflow</h2></div>
          {assignedRoles.map(role => <div className={styles.roleDescription} key={role}><h3><Icon name={roles[role]?.icon || "shield"} />{roles[role]?.name || role}</h3><p>{roles[role]?.description}</p></div>)}
        </section>
      </div>
      <div>
        <section className={styles.readyPanel}>
          <div className={styles.emptyArtwork}><Icon name="folder" /><Icon name="lock" /></div>
          {canUseBookings ? <>
            <h2>Booking files</h2><p>{canCreateBooking ? "Enter the file header and booking details, save drafts and continue later." : "View booking drafts in your assigned team or branch."}</p>
            <Link className={styles.primaryLink} href={canCreateBooking ? "/bookings/new" : "/bookings"}>{canCreateBooking ? "New booking" : "View bookings"}<Icon name="arrow" /></Link>
            <p style={{ marginTop: 20 }}>Registered-owner documents and SO-to-TL file submission are available. Approval steps are not enabled yet.</p>
          </> : <><h2>Booking work is not enabled yet</h2>
          <p>Booking fields, required documents and approval handoffs are awaiting confirmation. Your role’s upcoming tools are listed in the sidebar.</p>
          {isAdmin ? <Link className={styles.primaryLink} href="/staff">Manage staff access<Icon name="arrow" /></Link> : <p>Your active assignment is ready. Contact your branch administrator if your role or team needs a change.</p>}
          </>}
          <div className={styles.readiness}><Icon name="lock" />No customer records have been imported.</div>
        </section>
        <div className={styles.accessNote}><Icon name="shield" /><span>{isAdmin ? "Administration manages staff access. Booking approvals and pilot exceptions require their own authorization." : "Your access follows your active branch and team assignments. Other departments’ records are not shared automatically."}</span></div>
      </div>
    </div>
  </WorkspaceShell>;
}
