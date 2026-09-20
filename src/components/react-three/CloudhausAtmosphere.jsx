"use client";
import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

function TopBlur() {
  const blurRef = useRef();
  const [scrollBlur, setScrollBlur] = useState(0);
  const lastScrollY = useRef(0);
  const blurTimeout = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);

      const newBlur = Math.min(scrollDelta * 6, 86);
      setScrollBlur(newBlur);

      lastScrollY.current = currentScrollY;

      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
      }

      blurTimeout.current = setTimeout(() => {
        setScrollBlur(0);
      }, 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
      }
    };
  }, []);

  useGSAP(() => {
    gsap.to(blurRef.current, {
      backdropFilter: "blur(25px)",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "+=400",
        scrub: true,
      },
    });
  });
  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-60 transition-all duration-200"
      style={{
        backdropFilter: `blur(${scrollBlur}px)`,
        WebkitBackdropFilter: `blur(${scrollBlur}px)`,
        maskImage:
          "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
      }}
    />
  );
}

export default TopBlur;
