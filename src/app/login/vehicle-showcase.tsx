"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./page.module.css";

const vehicles = [
  { name: "Innova HyCross", image: "/images/toyota/innova-hycross.webp", className: styles.hycross },
  { name: "Fortuner", image: "/images/toyota/fortuner.png", className: styles.fortuner },
  { name: "Urban Cruiser Hyryder", image: "/images/toyota/hyryder.webp", className: styles.hyryder },
];
const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function VehicleShowcase() {
  const [active, setActive] = useState(0);
  const reduceMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => true);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !window.matchMedia(motionQuery).matches) setActive(current => (current + 1) % vehicles.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return <section className={styles.showcase} aria-label="Toyota vehicle showcase" aria-roledescription="carousel">
    <div className={styles.vehicleStage}>
      {vehicles.map((vehicle, i) => <div key={vehicle.name} className={`${styles.slide} ${i === active ? styles.activeSlide : ""}`} aria-hidden={i !== active} data-active={i === active}>
        <span className={styles.modelName} aria-hidden="true">{vehicle.name}</span>
        <div className={`${styles.carImage} ${vehicle.className}`}><Image src={vehicle.image} alt={`Toyota ${vehicle.name}`} fill sizes="(max-width: 760px) 100vw, 60vw" preload={i === 0} loading={i === 0 ? undefined : "eager"} className={styles.vehicleImage} /></div>
        {i === 0 && <svg className={styles.hycrossBody} viewBox="0 0 1109 483" aria-hidden="true">
          {/* The source has a white background. An opaque body layer hides the lettering;
              the filtered image underneath retains only a transparent black shadow. */}
          <defs>
            <filter id="hycross-shadow" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1" />
              <feComposite in2="SourceGraphic" operator="in" />
            </filter>
            <filter id="hycross-edge" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -100 -100 -100 0 298" />
              <feComposite in2="SourceGraphic" operator="in" />
            </filter>
            <clipPath id="hycross-body"><path d="M214 348Q210 324 217 293L216 243Q220 219 232 203Q232 169 279 155L364 139Q404 95 463 63Q497 44 674 43Q786 39 833 56Q855 65 876 113L890 132Q908 132 904 155L902 263Q898 316 878 332L851 339L677 391Q656 440 608 442Q568 445 552 410L326 393Q245 380 220 362Z" /></clipPath></defs>
          <image href={vehicle.image} width="1109" height="483" clipPath="url(#hycross-body)" filter="url(#hycross-edge)" />
        </svg>}
      </div>)}
    </div>
  </section>;
}
