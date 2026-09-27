// app/template.js
"use client";

import { useEffect } from "react";
import gsap from "gsap";

export default function Template({ children }) {
  useEffect(() => {
    const overlay = document.querySelector(".page-transition-overlay");
    if (!overlay) return;

    // Lock to solid black instantly, then fade opacity on GPU layer
    gsap.timeline()
      .set(overlay, { 
        "--wipe": "150%", // Ensures 100% solid coverage across the entire viewport
        opacity: 1 
      })
      .to(overlay, {
        opacity: 0,
        duration: 0.66,
        ease: "power2.out",
        onComplete: () => {
          gsap.set(overlay, { "--wipe": "0%", opacity: 0 });
        },
      });
  }, []);

  return <div>{children}</div>;
}