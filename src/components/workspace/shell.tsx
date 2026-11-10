import Link from "next/link";
import { hanken } from "@/lib/fonts";
import type { ReactNode } from "react";
import type { requireStaff } from "@/modules/identity/session";
import { signOut } from "@/modules/identity/actions";
import { Icon } from "./icon";
import { MobileNavigation } from "./mobile-navigation";
import { SectionNavigation } from "./section-navigation";
import { roles } from "./roles";
import styles from "./workspace.module.css";

type Session = Awaited<ReturnType<typeof requireStaff>>;
export function WorkspaceShell({ profile, memberships, page, children }: Pick<Session, "profile" | "memberships"> & { page: "workspace" | "staff" | "bookings"; children: ReactNode }) {
  const isAdmin = memberships.some(m => m.role === "Admin");
  const canUseBookings = memberships.some(m => ["SO", "TL", "SM"].includes(m.role));
  const canCreateBooking = memberships.some(m => m.role === "SO");
  const bookingLabel = memberships.some(m => m.role === "SM") ? "Branch bookings" : memberships.some(m => m.role === "TL") ? "Team bookings" : "My bookings";
  const assignedRoles = [...new Set(memberships.map(m => m.role))];
  const initials = profile.display_name.split(" ").slice(0, 2).map(word => word[0]).join("");
  const navigation = <>
    <Link href="/workspace" className={styles.brand} aria-label="FilesDigi home">
      <svg viewBox="0 0 54 38" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="2"><ellipse cx="27" cy="19" rx="25" ry="16" /><ellipse cx="27" cy="19" rx="9" ry="16" /><ellipse cx="27" cy="12" rx="22" ry="8" /></g></svg>
      <span>NIPPON <b>TOYOTA</b><small>FilesDigi</small></span>
    </Link>
    <nav aria-label="Workspace" className={styles.navigation}>
      <p className={styles.navLabel}>Workspace</p>
      <Link href="/workspace" aria-current={page === "workspace" ? "page" : undefined}><Icon name="home" />Overview</Link>
      <a href="/workspace#assignments"><Icon name="shield" />My assignments<span className={styles.count}>{memberships.length}</span></a>
      {canUseBookings && <><p className={styles.navLabel}>Sales</p><Link href="/bookings" aria-current={page === "bookings" ? "page" : undefined}><Icon name="folder" />{bookingLabel}</Link>{canCreateBooking && <Link href="/bookings/new"><Icon name="document" />New booking</Link>}</>}
      {isAdmin && <><p className={styles.navLabel}>Administration</p>
        <Link href="/staff" aria-current={page === "staff" ? "page" : undefined}><Icon name="users" />Staff access</Link>
        <a href="/staff#staff-assignments"><Icon name="shield" />Assignments</a>
        <a href="/staff#invite"><Icon name="invite" />Add staff</a>
        <a href="/staff#invitations"><Icon name="document" />Account requests</a>
        <a href="/staff#history"><Icon name="history" />Access history</a>
      </>}
      <p className={styles.navLabel}>Upcoming tools <span>Not enabled</span></p>
      {assignedRoles.map(role => <div className={styles.roleNavigation} key={role}>
        {assignedRoles.length > 1 && <small>{roles[role]?.name || role}</small>}
        {roles[role]?.tools.filter((_, index) => !(["SO","TL","SM"].includes(role) && index === 0)).map(tool => <span className={styles.unavailable} key={tool.label} aria-disabled="true"><Icon name={tool.icon} />{tool.label}<Icon name="lock" className={styles.lockIcon} /></span>)}
      </div>)}
    </nav>
    <div className={styles.sidebarBottom}>
      <div className={styles.identity}><span className={styles.avatar}>{initials}</span><span><strong>{profile.display_name}</strong><small>{assignedRoles.map(role => roles[role]?.name || role).join(" · ")}</small></span></div>
      <form action={signOut}><button className={styles.signOut}><Icon name="logout" />Sign out</button></form>
    </div>
  </>;
  return <div className={`${styles.shell} ${hanken.className}`}>
    <aside className={styles.rail} aria-label="Quick navigation">
      <span className={styles.appIcon}><Icon name="folder" /></span>
      <Link href="/workspace" title="Workspace overview" aria-label="Workspace overview" className={page === "workspace" ? styles.railActive : undefined}><Icon name="home" /></Link>
      {isAdmin && <Link href="/staff" title="Staff administration" aria-label="Staff administration" className={page === "staff" ? styles.railActive : undefined}><Icon name="users" /></Link>}
      {canUseBookings && <Link href="/bookings" title="Booking files" aria-label="Booking files" className={page === "bookings" ? styles.railActive : undefined}><Icon name="folder" /></Link>}
      <a href="/workspace#assignments" title="Your access" aria-label="Your access"><Icon name="shield" /></a>
      <span className={styles.railBottom}>FD</span>
    </aside>
    <aside className={styles.sidebar}>{navigation}</aside>
    <div className={styles.main}>
      <header className={styles.topbar}>
        <MobileNavigation>{navigation}</MobileNavigation>
        <div className={styles.breadcrumb}><span>Nippon Toyota</span><span>/</span><strong>{page === "staff" ? "Staff access" : page === "bookings" ? "Bookings" : "Workspace"}</strong></div>
        <span className={styles.mode}><span />Local workspace</span>
        <span className={styles.topAvatar} title={profile.display_name}>{initials}</span>
      </header>
      <div className={styles.pageContent}>{children}</div>
      <SectionNavigation />
      <div className={styles.footnote}>FilesDigi <span>Sales booking & fulfilment</span></div>
    </div>
  </div>;
}
