
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

    // Disable the animation completely on mobile.
    if (window.innerWidth <= 768) return;

    const ctx = gsap.context(() => {
      const split = new SplitText(textRef.current, {
        type: "lines,words,chars",
        linesClass: "sky-line relative block overflow-hidden py-[0.05em]",
        wordsClass: "sky-word relative inline-block whitespace-nowrap",
        charsClass:
          "sky-char relative inline-block will-change-[transform,opacity,filter] transform-gpu",
      });

      const mm = gsap.matchMedia();

      mm.add(
        { isDesktop: "(min-width: 769px)", isMobile: "(max-width: 768px)" },
        (context) => {
          const { isDesktop } = context.conditions;

          const cfg = isDesktop
            ? {
                start: "top 82%",
                end: "top 20%",
                scrub: 0.6,
                stagger: 0.012,
                lineStagger: 0.08,
              }
            : {
                start: "top 88%",
                end: "top 35%",
                scrub: 0.5,
                stagger: 0.007,
                lineStagger: 0.06,
              };

          split.lines.forEach((line, li) => {
            const chars = line.querySelectorAll(".sky-char");

            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: containerRef.current,
                start: cfg.start,
                end: cfg.end,
                scrub: cfg.scrub,
                fastScrollEnd: true,
              },
            });

            tl.fromTo(
              chars,
              {
                opacity: 0,
                yPercent: 120,
                scaleY: 0.1,
                scaleX: 0.9,
                filter: "blur(10px)",
                transformOrigin: "50% 100%",
                force3D: true,
              },
              {
                opacity: 1,
                yPercent: 0,
                scaleY: 1,
                scaleX: 1,
                filter: "blur(0px)",
                stagger: cfg.stagger,
                ease: "power3.out",
                force3D: true,
              },
              li * cfg.lineStagger
            );
          });
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

