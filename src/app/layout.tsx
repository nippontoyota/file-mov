import type { Metadata } from "next";
import "./globals.css";
import { hanken } from "@/lib/fonts";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = { title: "FilesDigi · Nippon Toyota", description: "Staff booking and fulfilment workspace", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={hanken.className}>
    <ToastProvider>
      <a className="skip" href="#main">Skip to content</a>
      <main id="main">{children}</main>
    </ToastProvider>
  </body></html>;
}
