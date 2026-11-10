import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { hanken } from "@/lib/fonts";

export const metadata: Metadata = { title: "FilesDigi · Nippon Toyota", description: "Staff booking and fulfilment workspace", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={hanken.className}>
    <a className="skip" href="#main">Skip to content</a>
    <header className="brand"><Link href="/workspace" aria-label="FilesDigi workspace"><span className="brandMark">N</span><span>NIPPON TOYOTA<small>FilesDigi / staff workspace</small></span></Link><span className="environment">Local workspace</span></header>
    <main id="main">{children}</main>
    <footer>Booking & fulfilment <span>Individual accounts. Accountable handoffs.</span></footer>
  </body></html>;
}
