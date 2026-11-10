"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";
import styles from "./workspace.module.css";

export function MobileNavigation({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)");
    const closeOnDesktop = () => { if (desktop.matches) dialog.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return <div className={styles.mobileNavigation}>
    <button className={styles.menuButton} type="button" aria-label="Open navigation" onClick={() => dialog.current?.showModal()}><Icon name="menu" /></button>
    <dialog ref={dialog} className={styles.drawer} aria-label="Workspace navigation">
      <button className={styles.closeButton} type="button" aria-label="Close navigation" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
      <div onClick={event => { if ((event.target as HTMLElement).closest("a")) dialog.current?.close(); }}>{children}</div>
    </dialog>
  </div>;
}
