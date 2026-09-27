
// components/SmudgyTitleReveal.jsx
"use client";

import React, {
  useRef,
  useLayoutEffect,
  useMemo,
} from "react";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function SmudgyTitleReveal({
  text = "",
  className = "",
  fontClassName = "font-sans",
  tag: Tag = "h1",
}) {
  const containerRef = useRef(null);
  const charsRef = useRef([]);

  const words = useMemo(
    () => (text || "").split(" "),
    [text]
  );

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const validChars = charsRef.current.filter(Boolean);

      if (!validChars.length) return;

      const containerRect =
        containerRef.current.getBoundingClientRect();

      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      const charData = validChars.map((charEl) => {
        const rect = charEl.getBoundingClientRect();

        const charX =
          rect.left -
          containerRect.left +
          rect.width / 2;

        const charY =
          rect.top -
          containerRect.top +
          rect.height / 2;

        const dist = Math.hypot(
          charX - centerX,
          charY - centerY
        );

        return {
          el: charEl,
          dist,
        };
      });

      const sortedChars = charData
        .sort((a, b) => a.dist - b.dist)
        .map((item) => item.el);

      gsap.fromTo(
        sortedChars,
        {
          color: "rgb(113, 113, 122)",
        },
        {
          color: "rgb(255, 255, 255)",
          stagger: {
            each: 0.025,
            from: "start",
          },
          ease: "power1.inOut",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 90%",
            end: "top 60%",
            scrub: 0.9,
            pin: false,
            preventOverlaps: true,
            fastScrollEnd: true,
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [text]);

  charsRef.current = [];

  if (!text) return null;

  return (
    <div
      ref={containerRef}
      className={`inline-block w-full uppercase ${fontClassName}`}
    >
      <Tag
        className={`w-full flex flex-wrap gap-x-[0.25em] ${
          className ||
          "font-medium  text-[clamp(1rem,1.3vw,1.35rem)] text-ghost-white"
        }`}
      >
        {words.map((word, wordIdx) => (
          <span
            key={wordIdx}
            className="inline-block whitespace-nowrap"
          >
            {word.split("").map((char, charIdx) => (
              <span
                key={charIdx}
                ref={(el) => {
                  if (el) {
                    charsRef.current.push(el);
                  }
                }}
                className="inline-block text-eclipse will-change-[color]"
              >
                {char}
              </span>
            ))}
          </span>
        ))}
      </Tag>
    </div>
  );
}

