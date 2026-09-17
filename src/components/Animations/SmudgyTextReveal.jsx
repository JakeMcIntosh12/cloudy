"use client";

import React, { useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

export default function ExtrudedElevationReveal({
  text = "",
  variant = "intro",
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    if (!textRef.current) return;

    const ctx = gsap.context(() => {
      const split = new SplitText(textRef.current, {
        type: "lines",
        linesClass: "sky-line relative block",
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 75%",
          end: "top 45%",
          scrub: 0.9,
          pin: false,
          preventOverlaps: true,
          fastScrollEnd: true,
        },
      });

      tl.fromTo(
        split.lines,
        {
          color: "rgb(30, 30, 34)",
          y: 80,
          filter: "blur(8px)",
        },
        {
          color: "rgb(255, 255, 255)",
          y: 0,
          filter: "blur(0px)",
          stagger: 0.12,
          ease: "power1.inOut",
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [text]);

  if (!text) return null;

  const widthClass =
    variant === "footer"
      ? "lg:max-w-[420px] xl:max-w-[520px] 2xl:max-w-[650px]"
      : "lg:max-w-[820px]";

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${widthClass} overflow-hidden`}
    >
      <p
        ref={textRef}
        className="
          w-full
          leading-[105%]
          font-medium
          text-[1.8rem]
          sm:text-[1.75rem]
          md:text-[2rem]
          lg:text-[2.25rem]
          xl:text-[2.75rem]
          2xl:text-[3.20rem]
          tracking-tight
          uppercase
          select-none
          text-white
        "
      >
        {text}
      </p>
    </div>
  );
}