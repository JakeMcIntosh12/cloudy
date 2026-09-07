"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";

import KRIVICLogo from "@/Assets/Logo/KRIVIC.svg";
import MorganBuildLogo from "@/Assets/Logo/MorganBuild.svg";
import CircaLogo from "@/Assets/Logo/circa-white.svg";
import Client4Logo from "@/Assets/Logo/TBC.svg";
import Client5Logo from "@/Assets/Logo/4Life-Constructions.svg";
import Client6Logo from "@/Assets/Logo/NBEE.svg";

function ClientsSection() {
  const trackRef = useRef(null);
  const blurTweenRef = useRef(null);
  const wheelRAFRef = useRef(null);

  // =========================================================
  // CLIENT LOGOS
  // =========================================================

  const clients = [
    {
      name: "KRIVIC",
      src: KRIVICLogo,
      logoClass:
        "w-[clamp(8rem,12vw,13rem)] h-[clamp(4rem,7vw,7rem)]",
    },
    {
      name: "Morgan Build",
      src: MorganBuildLogo,
      logoClass:
        "w-[clamp(10rem,16vw,18rem)] h-[clamp(5rem,9vw,9rem)]",
    },
    {
      name: "Circa",
      src: CircaLogo,
      logoClass:
        "w-[clamp(8rem,12vw,13rem)] h-[clamp(4rem,7vw,7rem)]",
    },
    {
      name: "TBC",
      src: Client4Logo,
      logoClass:
        "w-[clamp(9rem,13vw,14rem)] h-[clamp(5rem,8vw,8rem)]",
    },
    {
      name: "4Life Constructions",
      src: Client5Logo,
      logoClass:
        "w-[clamp(8rem,12vw,13rem)] h-[clamp(4rem,7vw,7rem)]",
    },
    {
      name: "NB",
      src: Client6Logo,
      logoClass:
        "w-[clamp(11rem,16vw,16rem)] h-[clamp(7rem,10vw,11rem)] scale-[1.35]",
    },
  ];

  // =========================================================
  // PRELOAD ALL LOGOS IMMEDIATELY
  // =========================================================
  //
  // These logos are local SVG assets, so we can request them
  // as soon as this component mounts rather than waiting for
  // the section to enter the viewport.
  //
  // The browser will cache these requests, meaning when the
  // actual <Image> elements render later, the assets should
  // already be available.
  //
  // =========================================================

  useEffect(() => {
    const preloadLogos = clients
      .map((client) => {
        if (!client.src) return null;

        const link = document.createElement("link");

        link.rel = "preload";
        link.as = "image";
        link.href = client.src.src || client.src;

        // SVG images don't need a fetch priority attribute in
        // every browser, but this helps browsers that support it.
        link.fetchPriority = "high";

        document.head.appendChild(link);

        return link;
      })
      .filter(Boolean);

    // Also warm the browser's image cache directly.
    const imagePreloads = clients
      .map((client) => {
        if (!client.src) return null;

        const image = new window.Image();

        image.decoding = "async";
        image.fetchPriority = "high";
        image.src = client.src.src || client.src;

        return image;
      })
      .filter(Boolean);

    return () => {
      preloadLogos.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });

      imagePreloads.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, []);

  // =========================================================
  // INFINITE CAROUSEL
  // =========================================================

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const ctx = gsap.context(() => {
      const items = track.children;
      const totalWidth = track.scrollWidth / 2;

      // =========================================================
      // INFINITE CAROUSEL
      // =========================================================

      const loop = gsap.to(items, {
        x: `-=${totalWidth}`,
        duration: 25,
        ease: "none",
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize((x) => {
            const val = parseFloat(x);
            return ((val % totalWidth) - totalWidth) % totalWidth;
          }),
        },
      });

      // Wrap the timeline's progress continuously so playing
      // in reverse never hits 0.
      loop.eventCallback("onUpdate", () => {
        if (loop.totalProgress() <= 0) {
          loop.totalProgress(loop.totalProgress() + 1);
        }
      });

      // =========================================================
      // SCROLL VELOCITY / DIZZINESS EFFECT
      // =========================================================

      let latestDelta = 0;

      const applyWheelEffect = () => {
        wheelRAFRef.current = null;

        const delta = latestDelta;

        if (!delta) return;

        // Scroll down = right to left
        // Scroll up = left to right
        const direction = delta > 0 ? 1 : -1;

        const speedBoost = Math.min(Math.abs(delta) / 20, 5);
        const targetTimeScale = direction * (1 + speedBoost);

        const blur = Math.min(Math.abs(delta) / 8, 20);

        if (blurTweenRef.current) {
          blurTweenRef.current.kill();
          blurTweenRef.current = null;
        }

        // -------------------------------------------------------
        // SPEED
        // -------------------------------------------------------

        gsap.to(loop, {
          timeScale: targetTimeScale,
          duration: 0.1,
          ease: "power2.out",
          overwrite: true,
        });

        // -------------------------------------------------------
        // BLUR
        // -------------------------------------------------------

        gsap.to(track, {
          filter: `blur(${blur}px)`,
          duration: 0.08,
          ease: "power2.out",
          overwrite: true,
        });

        // -------------------------------------------------------
        // RETURN TO NORMAL
        // -------------------------------------------------------

        const timeline = gsap.timeline();

        timeline
          .to(loop, {
            timeScale: direction,
            duration: 0.6,
            ease: "power2.out",
          })
          .to(
            track,
            {
              filter: "blur(0px)",
              duration: 0.3,
              ease: "power3.out",
            },
            "<",
          );

        blurTweenRef.current = timeline;
      };

      // =========================================================
      // THROTTLED WHEEL HANDLER
      // =========================================================

      const handleWheel = (event) => {
        latestDelta = event.deltaY;

        if (wheelRAFRef.current !== null) return;

        wheelRAFRef.current =
          requestAnimationFrame(applyWheelEffect);
      };

      window.addEventListener("wheel", handleWheel, {
        passive: true,
      });

      // =========================================================
      // CLEANUP
      // =========================================================

      return () => {
        window.removeEventListener("wheel", handleWheel);

        if (wheelRAFRef.current !== null) {
          cancelAnimationFrame(wheelRAFRef.current);
          wheelRAFRef.current = null;
        }

        if (blurTweenRef.current) {
          blurTweenRef.current.kill();
          blurTweenRef.current = null;
        }

        loop.kill();

        gsap.killTweensOf(track);
      };
    }, trackRef);

    return () => ctx.revert();
  }, []);

  // =========================================================
  // LOGO CARD
  // =========================================================

  const renderLogo = (client, i, set) => (
    <div
      key={`client-${set}-${i}`}
      className="
        w-[clamp(13rem,45vw,23rem)]
        h-[clamp(8rem,20vw,15rem)]
        shrink-0
        border
        border-eclipse
        bg-carbon-black
        flex
        items-center
        justify-center
        px-8
        py-6
      "
    >
      <div
        className={`
          relative
          ${client.logoClass}
        `}
      >
        <Image
          src={client.src}
          alt={`${client.name} logo`}
          fill
          priority
          loading="eager"
          decoding="async"
          fetchPriority="high"
          sizes="(max-width: 768px) 45vw, 23rem"
          className="object-contain brightness-0 invert"
        />
      </div>
    </div>
  );

  return (
    <div className="w-screen relative left-1/2 -translate-x-1/2 bg-black mt-[clamp(0.1rem,4vw,0.2rem)] overflow-hidden mb-10 md:mb-20">
      {/* HEADER */}

      <div className="flex flex-row items-center justify-between w-full text-zinc-300 px-4 md:px-8 opacity-0">
        <div className="font-mono tracking-tight text-[clamp(0.5rem,0.8vw,0.725rem)] flex items-center gap-[clamp(0.35rem,0.6vw,0.6rem)]">
          <div className="w-[clamp(0.35rem,0.5vw,0.5rem)] h-[clamp(0.35rem,0.5vw,0.5rem)] bg-zinc-300" />

          <h1>CLIENTS</h1>
        </div>

        <h1 className="font-mono tracking-tight text-[clamp(0.5rem,0.8vw,0.725rem)]">
          [CLOUD_4]
        </h1>
      </div>

      {/* CONTENT */}

      <div className="flex flex-col space-y-[clamp(1.5rem,4vw,4.5rem)] mt-[clamp(1.5rem,3.5vw,1.5rem)] mb-10 md:mb-30 mt-10 md:mt-0">
        {/* TITLE */}

        <h1 className="text-[clamp(1.35rem,3.6vw,2.65rem)] font-sans tracking-tight text-ghost-white max-w-[clamp(18rem,80vw,40rem)] leading-tight px-4 md:px-8 font-medium">
          OUR CURRENT ROSTER:
        </h1>

        {/* FULL BLEED HORIZONTAL LOGO TRACK */}

        <div className="relative w-full overflow-hidden">
          {/* Edge fade gradient masks */}

          <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-carbon-black to-transparent z-10 pointer-events-none" />

          <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-carbon-black to-transparent z-10 pointer-events-none" />

          <div
            ref={trackRef}
            className="flex flex-row space-x-[clamp(1rem,2vw,1.5rem)] w-max will-change-transform"
          >
            {/* Original Set */}

            {clients.map((client, i) =>
              renderLogo(client, i, 1),
            )}

            {/* Duplicated Set */}

            {clients.map((client, i) =>
              renderLogo(client, i, 2),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClientsSection;