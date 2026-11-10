"use client";
import { useEffect, useRef, useState } from "react";
import { SearchSelect } from "@/components/search-select";
import { roles } from "./roles";
import { Icon } from "./icon";
import styles from "./workspace.module.css";

type Branch = { id: string; name: string };
type Team = { id: string; branch_id: string; name: string };
export function AccountFields({ branches, teams }: { branches: Branch[]; teams: Team[] }) {
  const fields = useRef<HTMLDivElement>(null);
  const [branch, setBranch] = useState(branches[0]?.id || "");
  const [role, setRole] = useState("BO");
  const [visible, setVisible] = useState(false);
  const needsTeam = role === "SO" || role === "TL";
  const available = teams.filter(team => team.branch_id === branch);
  useEffect(() => {
    const form = fields.current?.closest("form");
    const reset = () => { setBranch(branches[0]?.id || ""); setRole("BO"); setVisible(false); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [branches]);
  return <div ref={fields}>
    <label>Display name<input name="name" required maxLength={100} autoComplete="off" /></label>
    <label>Email<input name="email" type="email" required maxLength={254} autoComplete="off" /></label>
    <label htmlFor="staff-password">Initial password</label>
    <div className={styles.passwordControl}>
      <input id="staff-password" name="password" type={visible ? "text" : "password"} required minLength={6} maxLength={6} pattern="\S{6}" autoComplete="new-password" aria-describedby="password-hint" />
      <button type="button" aria-label={visible ? "Hide initial password" : "Show initial password"} aria-pressed={visible} onClick={() => setVisible(value => !value)}><Icon name={visible ? "lock" : "eye"} /></button>
    </div>
    <p className={styles.fieldHint} id="password-hint">6 characters, without spaces. Share directly with the staff member.</p>
    <label>Branch<SearchSelect name="branch" label="Branch" required value={branch} onChange={setBranch} options={branches.map(b=>({value:b.id,label:b.name}))} /></label>
    <label>Role<SearchSelect name="role" label="Role" required value={role} onChange={setRole} options={["SO", "TL", "SM", "BO", "Insurance", "Accounts", "Cashier", "Accessories", "Security"].map(r=>({value:r,label:roles[r]?.name || r}))} /></label>
    {needsTeam && <label>Team<SearchSelect key={`${branch}-${role}`} name="team" label="Team" required options={available.map(t=>({value:t.id,label:t.name}))} /></label>}
    {needsTeam && !available.length && <p className="notice">This branch has no teams yet. Add the actual team below before creating a Sales Officer or Team Leader account.</p>}
  </div>;
}
