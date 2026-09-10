
"use client";

import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ArrowLeft } from "lucide-react";

gsap.registerPlugin(ScrollTrigger, SplitText);

const services = [
  {
    id: "01",
    title: "PRE-PRODUCTION",
    description:
      "We design the framework before we ever touch a camera. This is the strategic architecture—mapping the narrative, sourcing locations, and engineering the precise visual blueprint. We eliminate guesswork to ensure that when production begins, every single frame is optimized for maximum commercial impact",
  },
  {
    id: "02",
    title: "PRODUCTION",
    description:
      "High-end execution on set. We deploy cinema-grade optics, controlled lighting, and deliberate movement to translate structural design and space into raw, high-authority visual media. Every setup is deliberate, capturing scale, texture, and technical craftsmanship without compromise.",
  },
  {
    id: "03",
    title: "POST-PRODUCTION",
    description:
      "Where raw footage is sculpted into a final commercial asset. Precise rhythmic pacing, seamless sound design, and custom architectural color grading elevate the visual tone, giving the final cut an unmistakable cinematic weight that commands authority.",
  },
];

function ServiceItem({ service }) {
  const containerRef = useRef(null);
  const lineRef = useRef(null);
  const numberRef = useRef(null);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const arrowRef = useRef(null);

  useGSAP(
    () => {
      // Split Title for Extruded Elevation Reveal
      const splitTitle = new SplitText(titleRef.current, {
        type: "chars",
        charsClass:
          "sky-char relative inline-block will-change-[transform,opacity,filter] transform-gpu",
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 82%",
          end: "bottom 60%",
          toggleActions: "play none none reverse",
        },
      });

      // 1. Index number exposure step
      tl.fromTo(
        numberRef.current,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.4, ease: "power1.inOut" }
      )
        // 2. EXTRUDED ELEVATION REVEAL (TITLES)
        .fromTo(
          splitTitle.chars,
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
            stagger: 0.015,
            duration: 0.7,
            ease: "power3.out",
            force3D: true,
          },
          "-=0.2"
        )
        // 3. Arrow latch
        .fromTo(
          arrowRef.current,
          { opacity: 0, x: -15, scaleX: 0.7 },
          { opacity: 0.8, x: 0, scaleX: 1, duration: 0.4, ease: "power2.out" },
          "-=0.4"
        )
        // 4. Description unmask
        .fromTo(
          descRef.current,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
          "-=0.3"
        );

      // Bottom line scrubbed on scroll
      gsap.fromTo(
        lineRef.current,
        { scaleX: 0, transformOrigin: "left center" },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 85%",
            end: "bottom 70%",
            scrub: 0.6,
          },
        }
      );

      return () => splitTitle.revert();
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      id="services"
      className="flex flex-col space-y-8 md:space-y-6 w-full pointer-events-none"
    >
      {/* HEADER & CONTENT ROW */}
      <div className="flex flex-row items-start justify-between w-full">
        {/* NUMBERING */}
        <div className="shrink-0 w-12 md:w-20 pt-[clamp(0.2rem,0.5vw,0.6rem)]">
          <span
            ref={numberRef}
            className="inline-block font-sans font-medium tracking-tighter text-zinc-100 text-[clamp(1.075rem,2.5vw,4.5rem)] select-none"
          >
            {service.id}
          </span>
        </div>

        {/* SHARED COLUMN FOR TITLE + DESCRIPTION */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex flex-row items-start justify-between w-full">
            {/* TITLE WITH EXTRUDED ELEVATION CONTAINER */}
            <div className="flex items-start w-full md:translate-x-40 overflow-hidden py-1">
              <h3
                ref={titleRef}
                className="text-[clamp(2rem,4.5vw+0.4rem,4rem)] font-sans uppercase tracking-tighter text-ghost-white font-medium leading-[1.05]"
              >
                {service.title}
              </h3>
            </div>

            {/* ARROW */}
            <div
              ref={arrowRef}
              className="hidden md:flex items-center shrink-0 pl-4 pt-2 text-white md:text-12"
            >
              ( <ArrowLeft className="rotate-0 w-8 h-8" /> )
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="w-full md:translate-x-40 pt-4 md:pt-20">
            <p
              ref={descRef}
              className="text-zinc-500 font-geist-mono uppercase w-[clamp(350px,50vw,500px)] max-w-full pb-2 text-[clamp(0.7rem,0.65rem+0.35vw,0.9rem)] leading-relaxed will-change-transform"
            >
              {service.description}
            </p>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH UNDERLINE (SCRUBBED ON SCROLL) */}
      <div
        ref={lineRef}
        className="w-full bg-zinc-800/80 h-[1.5px] mt-[clamp(1.25rem,3vw,2rem)]"
      />
    </div>
  );
}

export default function ServicesSection() {
  return (
    <div className="w-full h-auto bg-black text-ghost-white mt-[clamp(3rem,8vw,4rem)]">
      {/* HEADER */}
      <div className="flex flex-row items-center justify-between w-full">
        <div className="font-mono tracking-tight text-[clamp(0.5rem,0.8vw,0.625rem)] flex items-center gap-2">
          <div className="w-2 h-2 bg-ghost-white" />
          <h2>OUR SERVICES</h2>
        </div>

        <span className="font-mono tracking-tight text-[clamp(0.5rem,0.8vw,0.625rem)]">
          [CLOUD_3]
        </span>
      </div>

      {/* MAPPED SERVICES */}
      <div className="flex flex-col space-y-[clamp(2rem,5vw,4.5rem)] mt-[clamp(3.5rem,8vw,8rem)] w-full">
        {services.map((service) => (
          <ServiceItem key={service.id} service={service} />
        ))}
      </div>
    </div>
  );
}

