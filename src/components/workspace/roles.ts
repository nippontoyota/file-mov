import type { IconName } from "./icon";

type RolePresentation = { name: string; icon: IconName; description: string; tools: { label: string; icon: IconName }[] };
// Presentation of the documented workflow, not an authorization/capability matrix.
// Operational tools remain unavailable until their milestone prerequisites are settled.
export const roles: Record<string, RolePresentation> = {
  Admin: { name: "Administrator", icon: "settings", description: "Create staff accounts and manage branch assignments. Business approvals require a separate role.", tools: [{ label: "Checklist configuration", icon: "approval" }] },
  SO: { name: "Sales Officer", icon: "folder", description: "Prepare assigned booking files, collect documents and submit work for review.", tools: [{ label: "Assigned bookings", icon: "folder" }, { label: "Amendments", icon: "history" }, { label: "Accessory bills", icon: "receipt" }] },
  TL: { name: "Team Leader", icon: "users", description: "Review your team's bookings before Sales Manager approval.", tools: [{ label: "Team bookings", icon: "folder" }, { label: "Booking reviews", icon: "approval" }, { label: "Returned files", icon: "handoff" }] },
  SM: { name: "Sales Manager", icon: "approval", description: "Review branch bookings after Team Leader approval and review proposed amendments.", tools: [{ label: "Branch bookings", icon: "folder" }, { label: "Booking approvals", icon: "approval" }, { label: "Amendment reviews", icon: "history" }] },
  BO: { name: "Back Office", icon: "handoff", description: "Coordinate approved files, preparation, insurance and registration evidence.", tools: [{ label: "Approved files", icon: "folder" }, { label: "Preparation & PDI", icon: "car" }, { label: "Department handoffs", icon: "handoff" }, { label: "Registration evidence", icon: "document" }] },
  Insurance: { name: "Insurance", icon: "shield", description: "Verify insurance work and return policy evidence to Back Office before invoicing.", tools: [{ label: "Insurance work", icon: "shield" }, { label: "Policy documents", icon: "document" }, { label: "Return to Back Office", icon: "handoff" }] },
  Accounts: { name: "Accounts", icon: "receipt", description: "Track invoicing, FASTag issuance, bill verification, financial closure and archive receipt.", tools: [{ label: "Invoice & road tax", icon: "receipt" }, { label: "FASTag issuance", icon: "car" }, { label: "Bill verification", icon: "approval" }, { label: "Closure & archive", icon: "archive" }] },
  Cashier: { name: "Cashier", icon: "wallet", description: "Record collection evidence and the approved FASTag handover action.", tools: [{ label: "Collection records", icon: "wallet" }, { label: "Accessory payments", icon: "receipt" }, { label: "FASTag handover", icon: "handoff" }] },
  Accessories: { name: "Accessories", icon: "tools", description: "Track requested preparation, available and pending work, bills and required signatures.", tools: [{ label: "Preparation requests", icon: "car" }, { label: "Pending accessory work", icon: "tools" }, { label: "Bills & signatures", icon: "receipt" }] },
  Security: { name: "Security", icon: "shield", description: "Process authorized gate-pass work and record the file return to Accounts.", tools: [{ label: "Gate passes", icon: "shield" }, { label: "File returns", icon: "handoff" }] },
};
