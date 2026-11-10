import type { SVGProps } from "react";

const paths = {
  eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  home: "m3 10 9-7 9 7v10H15v-7H9v7H3Z",
  folder: "M3 6h6l2 3h10v11H3ZM3 6V4h6l2 2h9v3",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6",
  document: "M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h6",
  approval: "M8 3h8v4H8ZM8 5H5v16h14V5h-3M8 14l3 3 5-6",
  handoff: "M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4",
  car: "m5 6-2 7v6h3v-2h12v2h3v-6l-2-7Zm-2 7h18M6 14v1M18 14v1M6 6l1-3h10l1 3",
  receipt: "M5 3h14v18l-3-2-4 2-4-2-3 2ZM8 7h8M8 11h8M8 15h4",
  wallet: "M20 8V5H4a2 2 0 0 0 0 4h17v11H4a2 2 0 0 1-2-2V7M21 12h-6v5h6M17 14.5h.01",
  tools: "M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4Z",
  archive: "M3 3h18v5H3ZM5 8v13h14V8M9 12h6",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2",
  invite: "M3 5h18v14H3Zm0 0 9 8 9-8",
  settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
  logout: "M9 4H3v16h6M9 12h12m-5-5 5 5-5 5",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  lock: "M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3M12 14v3",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  branch: "M3 21V5l9-3v19M12 8h9v13M1 21h22M6 7h3M6 11h3M6 15h3M15 11h3M15 15h3",
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
