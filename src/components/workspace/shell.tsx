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
export function WorkspaceShell({ profile, memberships, page, children }: Pick<Session, "profile" | "memberships"> & { page: "workspace" | "staff" | "bookings" | "cashier" | "back-office" | "insurance" | "accounts" | "accessories" | "security"; children: ReactNode }) {
  const isAdmin = memberships.some(m => m.role === "Admin");
  const isCashier = memberships.some(m => m.role === "Cashier");
  const isBO = memberships.some(m => m.role === "BO");
  const isInsurance = memberships.some(m => m.role === "Insurance");
  const isAccounts = memberships.some(m => m.role === "Accounts");
  const isAccessories = memberships.some(m => m.role === "Accessories");
  const isSecurity = memberships.some(m => m.role === "Security");
  const canCreateBooking = memberships.some(m => m.role === "SO");
  const bookingLabel = memberships.some(m => m.role === "BO") ? "Back Office files" :
    memberships.some(m => m.role === "Insurance") ? "Insurance files" :
    memberships.some(m => m.role === "Accounts") ? "Accounts files" :
    memberships.some(m => m.role === "Accessories") ? "Accessories files" :
    memberships.some(m => m.role === "Security") ? "Gate pass files" :
    memberships.some(m => m.role === "SM") ? "Branch bookings" :
    memberships.some(m => m.role === "TL") ? "Team bookings" : "My bookings";
  const assignedRoles = [...new Set(memberships.map(m => m.role))];
  const initials = profile.display_name.split(" ").slice(0, 2).map(word => word[0]).join("");
  const navigation = <>
    <Link href="/bookings" className={styles.brand} aria-label="FilesDigi home">
      <svg viewBox="0 0 54 38" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="2"><ellipse cx="27" cy="19" rx="25" ry="16" /><ellipse cx="27" cy="19" rx="9" ry="16" /><ellipse cx="27" cy="12" rx="22" ry="8" /></g></svg>
      <span>NIPPON <b>TOYOTA</b><small>FilesDigi</small></span>
    </Link>
    <nav aria-label="Workspace" className={styles.navigation}>
      <p className={styles.navLabel}>Customer Files</p>
      <Link href="/bookings" aria-current={page === "bookings" ? "page" : undefined}><Icon name="folder" />{bookingLabel}</Link>
      {canCreateBooking && <Link href="/bookings/new"><Icon name="document" />New booking</Link>}

      {(isCashier || isBO || isInsurance || isAccounts || isAccessories || isSecurity) && (
        <p className={styles.navLabel}>Departmental Desks</p>
      )}
      {isCashier && <Link href="/cashier" aria-current={page === "cashier" ? "page" : undefined}><Icon name="wallet" />Cashier desk</Link>}
      {isBO && <Link href="/back-office" aria-current={page === "back-office" ? "page" : undefined}><Icon name="car" />Back Office desk</Link>}
      {isInsurance && <Link href="/insurance" aria-current={page === "insurance" ? "page" : undefined}><Icon name="shield" />Insurance desk</Link>}
      {isAccounts && <Link href="/accounts" aria-current={page === "accounts" ? "page" : undefined}><Icon name="card" />Accounts desk</Link>}
      {isAccessories && <Link href="/accessories" aria-current={page === "accessories" ? "page" : undefined}><Icon name="tools" />Accessories desk</Link>}
      {isSecurity && <Link href="/security" aria-current={page === "security" ? "page" : undefined}><Icon name="shield" />Security desk</Link>}

      {isAdmin && <>
        <p className={styles.navLabel}>Administration</p>
        <Link href="/staff" aria-current={page === "staff" ? "page" : undefined}><Icon name="users" />Staff access</Link>
        <a href="/staff#staff-assignments"><Icon name="shield" />Assignments</a>
        <a href="/staff#invite"><Icon name="invite" />Add staff</a>
        <a href="/staff#invitations"><Icon name="document" />Account requests</a>
        <a href="/staff#history"><Icon name="history" />Access history</a>
      </>}
    </nav>
    <div className={styles.sidebarBottom}>
      <div className={styles.identity}><span className={styles.avatar}>{initials}</span><span><strong>{profile.display_name}</strong><small>{assignedRoles.map(role => roles[role]?.name || role).join(" · ")}</small></span></div>
      <form action={signOut}><button className={styles.signOut}><Icon name="logout" />Sign out</button></form>
    </div>
  </>;
  return <div className={`${styles.shell} ${hanken.className}`}>
    <aside className={styles.rail} aria-label="Quick navigation">
      <Link href="/bookings" className={styles.appIcon} aria-label="Nippon Toyota"><Icon name="folder" /></Link>
      <Link href="/bookings" title="Booking files" aria-label="Booking files" className={page === "bookings" ? styles.railActive : undefined}><Icon name="folder" /></Link>
      {isCashier && <Link href="/cashier" title="Cashier counter" aria-label="Cashier counter" className={page === "cashier" ? styles.railActive : undefined}><Icon name="wallet" /></Link>}
      {isBO && <Link href="/back-office" title="Back Office desk" aria-label="Back Office desk" className={page === "back-office" ? styles.railActive : undefined}><Icon name="car" /></Link>}
      {isInsurance && <Link href="/insurance" title="Insurance desk" aria-label="Insurance desk" className={page === "insurance" ? styles.railActive : undefined}><Icon name="shield" /></Link>}
      {isAccounts && <Link href="/accounts" title="Accounts desk" aria-label="Accounts desk" className={page === "accounts" ? styles.railActive : undefined}><Icon name="card" /></Link>}
      {isAccessories && <Link href="/accessories" title="Accessories desk" aria-label="Accessories desk" className={page === "accessories" ? styles.railActive : undefined}><Icon name="tools" /></Link>}
      {isSecurity && <Link href="/security" title="Security desk" aria-label="Security desk" className={page === "security" ? styles.railActive : undefined}><Icon name="shield" /></Link>}
      {isAdmin && <Link href="/staff" title="Staff administration" aria-label="Staff administration" className={page === "staff" ? styles.railActive : undefined}><Icon name="users" /></Link>}
      <span className={styles.railBottom}>NT</span>
    </aside>
    <aside className={styles.sidebar}>{navigation}</aside>
    <div className={styles.main}>
      <header className={styles.topbar}>
        <MobileNavigation>{navigation}</MobileNavigation>
        <div className={styles.breadcrumb}><span>Nippon Toyota</span><span>/</span><strong>{page === "staff" ? "Staff access" : page === "bookings" ? "Bookings" : page === "cashier" ? "Cashier" : page === "back-office" ? "Back Office" : page === "insurance" ? "Insurance" : page === "accounts" ? "Accounts" : page === "accessories" ? "Accessories" : page === "security" ? "Security" : "Workspace"}</strong></div>
        <span className={styles.mode}><span />Local workspace</span>
        <span className={styles.topAvatar} title={profile.display_name}>{initials}</span>
      </header>
      <div className={styles.pageContent}>{children}</div>
      <SectionNavigation />
      <div className={styles.footnote}>FilesDigi <span>Sales booking & fulfilment</span></div>
    </div>
  </div>;
}
