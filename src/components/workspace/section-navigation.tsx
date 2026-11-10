"use client";
import { useEffect } from "react";

// Streamed pages can receive the fragment before its section exists in the DOM.
export function SectionNavigation() {
  useEffect(() => {
    const focusSection = () => {
      const section = document.getElementById(window.location.hash.slice(1));
      if (!section?.matches("section[tabindex='-1']")) return;
      section.focus({ preventScroll: true });
      section.scrollIntoView({ block: "start" });
    };
    focusSection();
    window.addEventListener("hashchange", focusSection);
    return () => window.removeEventListener("hashchange", focusSection);
  }, []);
  return null;
}
