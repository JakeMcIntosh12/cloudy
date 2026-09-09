"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";

import TransitionLink from "@/components/PageTransitions/TransitionLink";
import SmudgyTitleReveal from "@/components/Animations/SmudgyTitleReveal";

import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import Hls from "hls.js";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import Footer from "@/components/Sections/Footer";
import Navigation from "@/components/UI/Navigation";

import { client } from "@/lib/client";
import { groq } from "next-sanity";

gsap.registerPlugin(ScrollTrigger);

// ----------------------------------------------------------------------
// SANITY QUERY
// ----------------------------------------------------------------------

const WORKS_QUERY = groq`
  *[
    _type == "caseStudy"
    && defined(slug.current)
  ]
  | order(order asc)
  {
    _id,
    title,
    client,
    date,
    order,
    "slug": slug.current,

    heroVideos[]{
      _key,
      "url": videoUrl
    }
  }
`;

// ----------------------------------------------------------------------
// HERO VIDEO URL RESOLVER
// ----------------------------------------------------------------------

function getHeroVideoUrl(project) {
  const videos = Array.isArray(
    project?.heroVideos
  )
    ? project.heroVideos
    : [];

  const validVideo = videos.find((item) => {
    const candidate =
      item?.url ??
      item?.asset?.url ??
      item?.file?.asset?.url ??
      item?.video?.asset?.url;

    return (
      typeof candidate === "string" &&
      candidate.trim().length > 0
    );
  });

  if (!validVideo) {
    return null;
  }

  const resolvedUrl =
    validVideo.url ??
    validVideo.asset?.url ??
    validVideo.file?.asset?.url ??
    validVideo.video?.asset?.url;

  return resolvedUrl.trim();
}

// ----------------------------------------------------------------------
// HLS VIDEO ATTACHMENT
// ----------------------------------------------------------------------

function useHlsVideo(videoRef, source) {
  const hlsRef = useRef(null);

  useEffect(() => {
    const video =
      videoRef.current;

    if (!video || !source) {
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();

    video.removeAttribute("src");
    video.load();

    // Safari / browsers with native HLS support
    if (
      video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
    ) {
      video.src = source;
      video.load();

      return () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    // Chrome / Firefox / Edge via hls.js
    if (
      Hls.isSupported()
    ) {
      const hls =
        new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          capLevelToPlayerSize: false,
          startLevel: -1,
        });

      hlsRef.current = hls;

      hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => {
          // Let hls.js choose the appropriate
          // quality level automatically.
        }
      );

      hls.loadSource(source);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
        hlsRef.current = null;

        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [
    videoRef,
    source,
  ]);
}

// ----------------------------------------------------------------------
// VIEWPORT-AWARE VIDEO WIDTH
// ----------------------------------------------------------------------

function useIsMobileViewport() {
  const [isMobile, setIsMobile] =
    useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia
    ) {
      return;
    }

    const mediaQuery =
      window.matchMedia(
        "(max-width: 768px)"
      );

    const update = () =>
      setIsMobile(
        mediaQuery.matches
      );

    update();

    mediaQuery.addEventListener(
      "change",
      update
    );

    return () =>
      mediaQuery.removeEventListener(
        "change",
        update
      );
  }, []);

  return isMobile;
}

// ----------------------------------------------------------------------
// 1. ANALOG TV NOISE SHADER
// ----------------------------------------------------------------------

const noiseShaderDefinition = {
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  },

  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;

      gl_Position = vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform float uTime;
    uniform float uOpacity;

    varying vec2 vUv;

    float random(vec2 st) {
      return fract(
        sin(dot(st.xy, vec2(12.9898, 78.233)))
        * 43758.5453123
      );
    }

    void main() {
      vec2 st = vUv;

      float grain = random(
        st * 400.0
        + vec2(
          uTime * 15.0,
          uTime * 25.0
        )
      );

      float scanline =
        sin(st.y * 800.0) * 0.08;

      float r = random(
        st * 400.0
        + vec2(
          uTime * 15.0 + 0.02,
          uTime * 25.0
        )
      );

      float b = random(
        st * 400.0
        + vec2(
          uTime * 15.0 - 0.02,
          uTime * 25.0
        )
      );

      vec3 color =
        vec3(r, grain, b)
        - scanline;

      gl_FragColor =
        vec4(color, uOpacity);
    }
  `,
};

// ----------------------------------------------------------------------
// SHARED TV NOISE PLANE
// ----------------------------------------------------------------------

function TVNoisePlane({
  opacityRef,
}) {
  const materialRef =
    useRef(null);

  const shaderArgs = useMemo(() => {
    return {
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },

      vertexShader:
        noiseShaderDefinition.vertexShader,

      fragmentShader:
        noiseShaderDefinition.fragmentShader,

      transparent: true,
      depthTest: false,
      depthWrite: false,
    };
  }, []);

  useFrame((_, delta) => {
    if (!materialRef.current) {
      return;
    }

    materialRef.current.uniforms.uTime.value +=
      delta;

    if (
      opacityRef.current !==
      undefined
    ) {
      materialRef.current.uniforms.uOpacity.value =
        opacityRef.current.value;
    }
  });

  return (
    <mesh>
      <planeGeometry
        args={[2, 2]}
      />

      <shaderMaterial
        ref={materialRef}
        args={[shaderArgs]}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// ----------------------------------------------------------------------
// SHARED TV NOISE
// ----------------------------------------------------------------------

const SharedTVNoise = forwardRef(
  function SharedTVNoise(_, ref) {
    const opacityRef =
      useRef({
        value: 0,
      });

    const targetRef =
      useRef(null);

    const containerRef =
      useRef(null);

    const updatePosition =
      useCallback(() => {
        const target =
          targetRef.current;

        const container =
          containerRef.current;

        if (
          !target ||
          !container
        ) {
          if (container) {
            container.style.opacity =
              "0";
          }

          return;
        }

        const rect =
          target.getBoundingClientRect();

        if (
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          container.style.opacity =
            "0";

          return;
        }

        container.style.left =
          `${rect.left}px`;

        container.style.top =
          `${rect.top}px`;

        container.style.width =
          `${rect.width}px`;

        container.style.height =
          `${rect.height}px`;

        container.style.opacity =
          "1";
      }, []);

    useImperativeHandle(
      ref,
      () => ({
        setTarget: (element) => {
          targetRef.current =
            element;

          updatePosition();
        },

        clearTarget: () => {
          targetRef.current = null;

          if (
            containerRef.current
          ) {
            containerRef.current.style.opacity =
              "0";
          }
        },

        triggerNoise: () => {
          const target =
            targetRef.current;

          if (!target) {
            return;
          }

          updatePosition();

          gsap.killTweensOf(
            opacityRef.current
          );

          gsap
            .timeline()
            .set(
              opacityRef.current,
              {
                value: 0.85,
              }
            )
            .to(
              opacityRef.current,
              {
                value: 0,
                duration: 0.32,
                ease: "power3.out",
              }
            );
        },
      }),
      [updatePosition]
    );

    useEffect(() => {
      let frameId;

      const update = () => {
        updatePosition();

        frameId =
          requestAnimationFrame(
            update
          );
      };

      frameId =
        requestAnimationFrame(
          update
        );

      return () => {
        cancelAnimationFrame(
          frameId
        );

        gsap.killTweensOf(
          opacityRef.current
        );
      };
    }, [updatePosition]);

    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        className="
          fixed
          pointer-events-none
          mix-blend-screen
          z-20
          overflow-hidden
        "
        style={{
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          opacity: 0,
        }}
      >
        <Canvas
          camera={{
            position: [0, 0, 1],
          }}
          gl={{
            alpha: true,
            antialias: false,
            powerPreference:
              "low-power",
          }}
          dpr={[1, 1]}
          frameloop="always"
          className="w-full h-full pointer-events-none"
          style={{
            pointerEvents:
              "none",
          }}
        >
          <TVNoisePlane
            opacityRef={opacityRef}
          />
        </Canvas>
      </div>
    );
  }
);

SharedTVNoise.displayName =
  "SharedTVNoise";

// ----------------------------------------------------------------------
// 2. SMALL BUTTON
// ----------------------------------------------------------------------

const SmallButton = forwardRef(
  (
    { isOpen = false },
    ref
  ) => {
    const buttonRef =
      useRef(null);

    useImperativeHandle(
      ref,
      () => ({
        triggerBlur: () => {
          if (
            !buttonRef.current
          ) {
            return;
          }

          gsap.killTweensOf(
            buttonRef.current
          );

          gsap.fromTo(
            buttonRef.current,
            {
              filter:
                "blur(22px) brightness(1.5)",
              scale: 0.92,
              opacity: 0.5,
            },
            {
              filter:
                "blur(0px) brightness(1)",
              scale: 1,
              opacity: 1,
              duration: 0.45,
              ease: "back.out(1.7)",
            }
          );
        },
      })
    );

    return (
      <div
        ref={buttonRef}
        className={`
          font-mono
          tracking-tight
          text-[clamp(0.6875rem,0.9vw,0.75rem)]
          border
          transition-colors
          duration-300
          rounded-full
          w-[clamp(6.5rem,6vw,7.0875rem)]
          h-[clamp(1.75rem,2.5vw,2rem)]
          px-3
          py-1
          flex
          items-center
          justify-center
          text-center
          cursor-pointer
          select-none
          ${
            isOpen
              ? "bg-ghost-white text-black border-ghost-white hover:bg-zinc-300"
              : "bg-black text-ghost-white border-eclipse hover:bg-ghost-white hover:text-black hover:border-ghost-white"
          }
        `}
      >
        {isOpen
          ? "CLOSE"
          : "WATCH FILM"}
      </div>
    );
  }
);

SmallButton.displayName =
  "SmallButton";

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

const formatTime = (
  seconds
) => {
  if (isNaN(seconds)) {
    return "00:00";
  }

  const mins =
    Math.floor(
      seconds / 60
    );

  const secs =
    Math.floor(
      seconds % 60
    );

  return `${
    mins < 10 ? "0" : ""
  }${mins}:${
    secs < 10 ? "0" : ""
  }${secs}`;
};

// ----------------------------------------------------------------------
// MOBILE VIDEO HEIGHT
// ----------------------------------------------------------------------

const mobileVideoHeightVariants = [
  "max-md:h-[52vw]",
  "max-md:h-[58vw]",
  "max-md:h-[54vw]",
  "max-md:h-[60vw]",
];

const getMobileVideoHeight =
  (video) => {
    const source =
      video?._id ||
      video?.slug ||
      video?.title ||
      "";

    let hash = 0;

    for (
      let i = 0;
      i < source.length;
      i++
    ) {
      hash +=
        source.charCodeAt(i);
    }

    return mobileVideoHeightVariants[
      hash %
        mobileVideoHeightVariants.length
    ];
  };

// ----------------------------------------------------------------------
// 3. WORK CARD
// ----------------------------------------------------------------------

function WorkCard({
  video,
  containerClassName,
  heightClassName,
  onHoverChange,
  fullBleedVideo = false,
  priority = false,
}) {
  const [currentTime, setCurrentTime] =
    useState("00:00");

  const [videoUrl, setVideoUrl] =
    useState(null);

  const [hasVideoError, setHasVideoError] =
    useState(false);

  const containerRef =
    useRef(null);

  const buttonRef =
    useRef(null);

  const videoRef =
    useRef(null);

  const isMobile =
    useIsMobileViewport();

  const mobileVideoHeight =
    useMemo(
      () =>
        getMobileVideoHeight(
          video
        ),
      [video]
    );

  // --------------------------------------------------
  // RESOLVE HERO VIDEO
  // --------------------------------------------------

  const rawUrl = useMemo(
    () =>
      getHeroVideoUrl(video),
    [video]
  );

  // --------------------------------------------------
  // RESET VIDEO ERROR WHEN PROJECT CHANGES
  // --------------------------------------------------

  useEffect(() => {
    setHasVideoError(false);
    setVideoUrl(null);
  }, [rawUrl]);

  // --------------------------------------------------
  // HLS PLAYBACK
  // --------------------------------------------------

  useHlsVideo(
    videoRef,
    videoUrl
  );

  // --------------------------------------------------
  // LOAD VIDEO
  // --------------------------------------------------

  const loadVideo =
    useCallback(
      async () => {
        if (!rawUrl) {
          return null;
        }

        if (videoUrl) {
          return videoUrl;
        }

        setHasVideoError(false);
        setVideoUrl(
          rawUrl
        );

        return rawUrl;
      },
      [
        rawUrl,
        videoUrl,
      ]
    );

  // --------------------------------------------------
  // PRIORITY VIDEO PRELOAD HINT
  // --------------------------------------------------

  useEffect(() => {
    if (
      !priority ||
      !rawUrl ||
      typeof document ===
        "undefined"
    ) {
      return;
    }

    const marker = `link[data-video-preload="${rawUrl}"]`;

    if (
      document.head.querySelector(
        marker
      )
    ) {
      return;
    }

    const preloadLink =
      document.createElement(
        "link"
      );

    preloadLink.rel =
      "preload";

    preloadLink.as =
      "video";

    preloadLink.href =
      rawUrl;

    preloadLink.setAttribute(
      "data-video-preload",
      rawUrl
    );

    document.head.appendChild(
      preloadLink
    );

    return () => {
      preloadLink.remove();
    };
  }, [
    priority,
    rawUrl,
  ]);

  // --------------------------------------------------
  // VIDEO ERROR FALLBACK
  // --------------------------------------------------

  const handleVideoError =
    useCallback(() => {
      if (!rawUrl) {
        return;
      }

      setHasVideoError(true);
    }, [
      rawUrl,
    ]);

  // --------------------------------------------------
  // VIDEO METADATA
  // --------------------------------------------------

  const handleLoadedMetadata =
    (e) => {
      const videoEl =
        e.currentTarget;

      if (
        videoEl &&
        Number.isFinite(
          videoEl.duration
        ) &&
        videoEl.duration > 0
      ) {
        videoEl.currentTime =
          Math.random() *
          videoEl.duration;
      }
    };

  // --------------------------------------------------
  // VIDEO TIME
  // --------------------------------------------------

  const handleTimeUpdate =
    (e) => {
      const videoEl =
        e.currentTarget;

      if (videoEl) {
        setCurrentTime(
          formatTime(
            videoEl.currentTime
          )
        );
      }
    };

  // --------------------------------------------------
  // HOVER ENTER
  // --------------------------------------------------

  const handleMouseEnter =
    async () => {
      let source =
        videoUrl;

      if (!source) {
        source =
          await loadVideo();
      }

      onHoverChange(
        true,
        containerRef.current,
        video,
        source
      );

      if (
        !containerRef.current
      ) {
        return;
      }

      const brackets =
        containerRef.current.querySelectorAll(
          ".corner-tl, .corner-tr, .corner-bl, .corner-br"
        );

      gsap.to(brackets, {
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
        duration: 0.35,
        ease: "power2.out",
        overwrite:
          "auto",
      });

      if (videoRef.current) {
        videoRef.current
          .play()
          .catch(() => {});
      }

      buttonRef.current?.triggerBlur?.();
    };

  // --------------------------------------------------
  // HOVER LEAVE
  // --------------------------------------------------

  const handleMouseLeave =
    () => {
      onHoverChange(
        false,
        containerRef.current,
        video,
        videoUrl
      );

      if (
        videoRef.current
      ) {
        videoRef.current.pause();
      }

      if (
        !containerRef.current
      ) {
        return;
      }

      const topL =
        containerRef.current.querySelector(
          ".corner-tl"
        );

      const topR =
        containerRef.current.querySelector(
          ".corner-tr"
        );

      const botL =
        containerRef.current.querySelector(
          ".corner-bl"
        );

      const botR =
        containerRef.current.querySelector(
          ".corner-br"
        );

      gsap.to(topL, {
        opacity: 0,
        scale: 0.9,
        x: -12,
        y: -12,
        duration: 0.75,
        ease: "power4.inOut",
        overwrite:
          "auto",
      });

      gsap.to(topR, {
        opacity: 0,
        scale: 0.9,
        x: 12,
        y: -12,
        duration: 0.75,
        ease: "power4.inOut",
        overwrite:
          "auto",
      });

      gsap.to(botL, {
        opacity: 0,
        scale: 0.9,
        x: -12,
        y: 12,
        duration: 0.75,
        ease: "power4.inOut",
        overwrite:
          "auto",
      });

      gsap.to(botR, {
        opacity: 0,
        scale: 0.9,
        x: 12,
        y: 12,
        duration: 0.75,
        ease: "power4.inOut",
        overwrite:
          "auto",
      });
    };

  // --------------------------------------------------
  // LOAD ALL VIDEOS IMMEDIATELY
  // --------------------------------------------------

  useEffect(() => {
    if (!rawUrl) {
      return;
    }

    loadVideo();
  }, [
    rawUrl,
    loadVideo,
  ]);

  if (!video) {
    return null;
  }

  return (
    <TransitionLink
      href={`/Work/${video.slug}`}
      className={`
        work-card-reveal
        flex
        flex-col
        w-full
        ${containerClassName || ""}
      `}
    >
      {/* TOP META */}

      <div className="flex flex-row items-center justify-between w-full px-1 pb-2">
        <h1 className="font-geist-mono tracking-tight text-[clamp(0.6875rem,0.9vw,0.75rem)] text-zinc-500">
          {video.date || "—"}
        </h1>

        <h2 className="font-geist-mono font-medium tracking-tight text-[clamp(0.8125rem,1.2vw,1rem)] text-zinc-500">
          {currentTime}
        </h2>
      </div>

      {/* VIDEO */}

      <div
        ref={containerRef}
        onMouseEnter={
          handleMouseEnter
        }
        onMouseLeave={
          handleMouseLeave
        }
        className={`
          relative
          overflow-hidden
          cursor-pointer

          max-md:relative
          max-md:left-1/2
          max-md:-translate-x-1/2
          max-md:w-screen
          max-md:aspect-auto
          ${mobileVideoHeight}

          md:left-auto
          md:translate-x-0
          md:ml-0
          md:w-full

          ${
            fullBleedVideo
              ? "md:-mx-8 md:w-[calc(100%+4rem)]"
              : ""
          }

          ${heightClassName || ""}
        `}
      >
        {videoUrl ? (
          <video
            ref={videoRef}
            loop
            muted
            playsInline
            preload="auto"
            fetchPriority="auto"
            onError={
              handleVideoError
            }
            onLoadedMetadata={
              handleLoadedMetadata
            }
            onTimeUpdate={
              handleTimeUpdate
            }
            className="
              block
              w-full
              h-full
              object-cover
              brightness-90
              contrast-105
            "
          />
        ) : (
          <div className="w-full h-full min-h-[220px] bg-zinc-900 flex flex-col items-center justify-center gap-2">
            <span className="font-geist-mono text-xs text-zinc-500 uppercase">
              No Preview
            </span>

            <span className="font-geist-mono text-[9px] text-zinc-700 uppercase">
              {rawUrl
                ? "Video unavailable"
                : "No hero video"}
            </span>
          </div>
        )}

        {/* DARK OVERLAY */}

        <div className="absolute inset-0 bg-black/40 pointer-events-none transition-opacity duration-300 group-hover:opacity-10" />

        {/* CORNERS */}

        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          <div className="corner-tl absolute top-4 left-4 w-8 h-8 border-t border-l border-white opacity-0 scale-90 -translate-x-3 -translate-y-3 mix-blend-difference" />

          <div className="corner-tr absolute top-4 right-4 w-8 h-8 border-t border-r border-white opacity-0 scale-90 translate-x-3 -translate-y-3 mix-blend-difference" />

          <div className="corner-bl absolute bottom-4 left-4 w-8 h-8 border-b border-l border-white opacity-0 scale-90 -translate-x-3 translate-y-3 mix-blend-difference" />

          <div className="corner-br absolute bottom-4 right-4 w-8 h-8 border-b border-r border-white opacity-0 scale-90 translate-x-3 translate-y-3 mix-blend-difference" />
        </div>
      </div>

      {/* BOTTOM META */}

      <div className="flex flex-row items-baseline justify-between w-full px-1 pt-2 text-ghost-white">
        <div className="flex flex-col min-w-0">
          <p className="font-geist-mono text-[clamp(0.6875rem,1vw,0.75rem)] text-zinc-400 tracking-tight">
            {video.client || "—"}
          </p>

          <SmudgyTitleReveal
            text={
              video.title ||
              "Untitled Project"
            }
          />
        </div>

        <SmallButton
          ref={buttonRef}
        />
      </div>
    </TransitionLink>
  );
}

// ----------------------------------------------------------------------
// 4. LIST ITEM
// ----------------------------------------------------------------------

function ListItemRow({
  project,
  onHoverStart,
  onHoverEnd,
  hoverEnabled = true,
}) {
  const rowRef =
    useRef(null);

  const titleRef =
    useRef(null);

  const subtitleRef =
    useRef(null);

  const dateRef =
    useRef(null);

  const activateRow =
    useCallback(
      async () => {
        if (!hoverEnabled) {
          return;
        }

        onHoverStart(project);

        gsap.to(rowRef.current, {
          backgroundColor:
            "#ffffff",
          duration: 0.3,
          ease: "power2.out",
          overwrite:
            "auto",
        });

        gsap.to(titleRef.current, {
          x: 12,
          color: "#000000",
          duration: 0.35,
          ease: "power3.out",
          overwrite:
            "auto",
        });

        gsap.to(
          subtitleRef.current,
          {
            x: 8,
            color: "#000000",
            duration: 0.35,
            ease: "power3.out",
            overwrite:
              "auto",
          }
        );

        gsap.to(dateRef.current, {
          x: -8,
          color: "#000000",
          duration: 0.35,
          ease: "power3.out",
          overwrite:
            "auto",
        });
      },
      [
        hoverEnabled,
        onHoverStart,
        project,
      ]
    );

  const deactivateRow =
    useCallback(
      () => {
        if (!hoverEnabled) {
          return;
        }

        onHoverEnd();

        gsap.to(rowRef.current, {
          backgroundColor:
            "transparent",
          duration: 0.3,
          ease: "power2.out",
          overwrite:
            "auto",
        });

        gsap.to(titleRef.current, {
          x: 0,
          color: "#f8f8f8",
          duration: 0.35,
          ease: "power3.out",
          overwrite:
            "auto",
        });

        gsap.to(
          subtitleRef.current,
          {
            x: 0,
            color: "#a1a1a1",
            duration: 0.35,
            ease: "power3.out",
            overwrite:
              "auto",
          }
        );

        gsap.to(dateRef.current, {
          x: 0,
          color: "#71717a",
          duration: 0.35,
          ease: "power3.out",
          overwrite:
            "auto",
        });
      },
      [
        hoverEnabled,
        onHoverEnd,
      ]
    );

  return (
    <div
      ref={rowRef}
      onMouseEnter={
        activateRow
      }
      onMouseLeave={
        deactivateRow
      }
      className="list-item-row"
    >
      <TransitionLink
        href={`/Work/${project.slug}`}
        className="relative grid grid-cols-3 items-center py-4 px-2"
      >
        <span
          ref={titleRef}
          className="font-sans text-xs sm:text-sm md:text-sm font-light uppercase text-ghost-white inline-block"
        >
          {project.client}
        </span>

        <span
          ref={subtitleRef}
          className="font-sans text-xs sm:text-sm md:text-sm font-light uppercase tracking-wide text-zinc-400 inline-block truncate pr-4"
        >
          {project.title}
        </span>

        <span
          ref={dateRef}
          className="font-geist-mono text-xs sm:text-sm md:text-base text-right text-zinc-500 inline-block"
        >
          {project.date}
        </span>
      </TransitionLink>
    </div>
  );
}

// ----------------------------------------------------------------------
// 5. CLIENT FILTER
// ----------------------------------------------------------------------

function ClientFilter({
  clientFilters,
  selectedClient,
  onClientFilter,
}) {
  const [isOpen, setIsOpen] =
    useState(false);

  const filterRef =
    useRef(null);

  const optionsRef =
    useRef(null);

  const optionItemsRef =
    useRef([]);

  useEffect(() => {
    if (!optionsRef.current) {
      return;
    }

    const items =
      optionItemsRef.current.filter(
        Boolean
      );

    gsap.set(
      optionsRef.current,
      {
        width: 0,
        opacity: 0,
        overflow: "hidden",
      }
    );

    gsap.set(items, {
      opacity: 0,
      x: -18,
    });
  }, [clientFilters]);

  const openFilter =
    useCallback(() => {
      if (
        !clientFilters.length
      ) {
        return;
      }

      setIsOpen(true);

      requestAnimationFrame(
        () => {
          if (
            !optionsRef.current
          ) {
            return;
          }

          const items =
            optionItemsRef.current.filter(
              Boolean
            );

          gsap.killTweensOf([
            optionsRef.current,
            ...items,
          ]);

          gsap.to(
            optionsRef.current,
            {
              width: "auto",
              opacity: 1,
              duration: 0.55,
              ease: "power3.out",
              overwrite:
                "auto",
            }
          );

          gsap.to(items, {
            opacity: 1,
            x: 0,
            duration: 0.5,
            stagger: 0.055,
            ease: "power3.out",
            overwrite:
              "auto",
          });
        }
      );
    }, [clientFilters]);

  const closeFilter =
    useCallback(() => {
      if (
        !optionsRef.current
      ) {
        setIsOpen(false);
        return;
      }

      const items =
        optionItemsRef.current.filter(
          Boolean
        );

      gsap.killTweensOf([
        optionsRef.current,
        ...items,
      ]);

      gsap.to(items, {
        opacity: 0,
        x: -18,
        duration: 0.35,
        stagger: 0.025,
        ease: "power3.inOut",
        overwrite:
          "auto",
      });

      gsap.to(
        optionsRef.current,
        {
          width: 0,
          opacity: 0,
          duration: 0.5,
          delay: 0.04,
          ease: "power3.inOut",
          overwrite:
            "auto",
          onComplete: () => {
            setIsOpen(false);
          },
        }
      );
    }, []);

  const handleFilterClick =
    () => {
      if (
        window.innerWidth < 640
      ) {
        if (isOpen) {
          closeFilter();
        } else {
          openFilter();
        }
      }
    };

  const handleMouseEnter =
    () => {
      if (
        window.innerWidth >= 640
      ) {
        openFilter();
      }
    };

  const handleMouseLeave =
    () => {
      if (
        window.innerWidth >= 640
      ) {
        closeFilter();
      }
    };

  return (
    <div
      ref={filterRef}
      className="relative flex items-center w-fit"
      onMouseEnter={
        handleMouseEnter
      }
      onMouseLeave={
        handleMouseLeave
      }
    >
      <button
        type="button"
        onClick={
          handleFilterClick
        }
        className="font-geist-mono text-[0.65rem] md:text-xs tracking-widest uppercase text-zinc-500 hover:text-white transition-colors duration-300 cursor-pointer whitespace-nowrap"
      >
        FILTER
      </button>

      <div
        ref={optionsRef}
        className="flex items-center overflow-hidden whitespace-nowrap"
        style={{
          gap: "0.75rem",
          marginLeft:
            "0.75rem",
        }}
      >
        <button
          ref={(el) => {
            optionItemsRef.current[0] =
              el;
          }}
          onClick={() =>
            onClientFilter("ALL")
          }
          className={`
            font-geist-mono
            text-[0.65rem]
            md:text-xs
            tracking-widest
            uppercase
            transition-colors
            duration-300
            cursor-pointer
            ${
              selectedClient ===
              "ALL"
                ? "text-white font-bold"
                : "text-zinc-600 hover:text-zinc-300"
            }
          `}
        >
          ALL
        </button>

        {clientFilters.map(
          (
            clientName,
            index
          ) => (
            <React.Fragment
              key={clientName}
            >
              <span
                ref={(el) => {
                  optionItemsRef.current[
                    index * 2 +
                      1
                  ] = el;
                }}
                className="text-zinc-800 font-geist-mono text-[0.65rem] md:text-xs"
              >
                /
              </span>

              <button
                ref={(el) => {
                  optionItemsRef.current[
                    index * 2 +
                      2
                  ] = el;
                }}
                onClick={() =>
                  onClientFilter(
                    clientName
                  )
                }
                className={`
                  font-geist-mono
                  text-[0.65rem]
                  md:text-xs
                  tracking-widest
                  uppercase
                  transition-colors
                  duration-300
                  cursor-pointer
                  ${
                    selectedClient ===
                    clientName
                      ? "text-white font-bold"
                      : "text-zinc-600 hover:text-zinc-300"
                  }
                `}
              >
                {clientName}
              </button>
            </React.Fragment>
          )
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 6. MAIN WORKS
// ----------------------------------------------------------------------

export default function AllWorksSection() {
  const containerRef =
    useRef(null);

  const listContainerRef =
    useRef(null);

  const bgVideoRef =
    useRef(null);

  const noiseRef =
    useRef(null);

  const bgHlsRef =
    useRef(null);

  const [viewMode, setViewMode] =
    useState("grid");

  const [
    visibleCount,
    setVisibleCount,
  ] = useState(13);

  const [projects, setProjects] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    hoveredProject,
    setHoveredProject,
  ] = useState(null);

  const [
    displayProject,
    setDisplayProject,
  ] = useState(null);

  const [
    selectedClient,
    setSelectedClient,
  ] = useState("ALL");

  const [canHover, setCanHover] =
    useState(false);

  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      );

    const updateHoverCapability =
      () => {
        const enabled =
          mediaQuery.matches;

        setCanHover(enabled);

        if (!enabled) {
          setHoveredProject(
            null
          );

          setDisplayProject(
            null
          );

          if (
            bgVideoRef.current
          ) {
            bgVideoRef.current.pause();

            bgVideoRef.current.removeAttribute(
              "src"
            );

            bgVideoRef.current.load();
          }

          if (
            bgHlsRef.current
          ) {
            bgHlsRef.current.destroy();
            bgHlsRef.current = null;
          }
        }
      };

    updateHoverCapability();

    mediaQuery.addEventListener(
      "change",
      updateHoverCapability
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        updateHoverCapability
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchProjects() {
      try {
        setIsLoading(true);

        const data =
          await client.fetch(
            WORKS_QUERY,
            {},
            {
              next: {
                revalidate: 60,
              },
            }
          );

        console.log(
          "SANITY WORKS:",
          data
        );

        if (!cancelled) {
          setProjects(
            Array.isArray(data)
              ? data
              : []
          );
        }
      } catch (error) {
        console.error(
          "Failed to fetch Sanity projects:",
          error
        );

        if (!cancelled) {
          setProjects([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  const clientFilters =
    useMemo(() => {
      const clientCounts = {};

      projects.forEach(
        (project) => {
          const clientName =
            project.client?.trim();

          if (!clientName) {
            return;
          }

          const normalizedName =
            clientName.toLowerCase();

          if (
            !clientCounts[
              normalizedName
            ]
          ) {
            clientCounts[
              normalizedName
            ] = {
              name: clientName,
              count: 0,
            };
          }

          clientCounts[
            normalizedName
          ].count += 1;
        }
      );

      return Object.values(
        clientCounts
      )
        .filter(
          (client) =>
            client.count >= 2
        )
        .map(
          (client) =>
            client.name
        );
    }, [projects]);

  const filteredProjects =
    useMemo(() => {
      if (
        selectedClient ===
        "ALL"
      ) {
        return projects;
      }

      return projects.filter(
        (project) =>
          project.client
            ?.trim()
            .toLowerCase() ===
          selectedClient
            .trim()
            .toLowerCase()
      );
    }, [
      projects,
      selectedClient,
    ]);

  const activeProjects =
    useMemo(() => {
      return filteredProjects.slice(
        0,
        visibleCount
      );
    }, [
      filteredProjects,
      visibleCount,
    ]);

  useEffect(() => {
    setVisibleCount(13);
  }, [selectedClient]);

  // ------------------------------------------------------------------
  // GRID REVEAL
  //
  // IMPORTANT:
  // viewMode is intentionally NOT a dependency here.
  // This prevents switching LIST -> GRID from resetting every
  // WorkCard's animation state.
  // ------------------------------------------------------------------

  useEffect(() => {
    if (
      !containerRef.current ||
      !activeProjects.length
    ) {
      return;
    }

    const ctx =
      gsap.context(() => {
        const cards =
          containerRef.current.querySelectorAll(
            ".grid-view .work-card-reveal"
          );

        if (!cards.length) {
          return;
        }

        gsap.set(cards, {
          opacity: 0,
          y: 50,
          filter:
            "blur(10px)",
        });

        gsap.to(cards, {
          opacity: 1,
          y: 0,
          filter:
            "blur(0px)",
          duration: 0.9,
          stagger: 0.12,
          ease: "power4.out",
          delay: 0.1,
          overwrite:
            "auto",
        });
      }, containerRef);

    return () =>
      ctx.revert();
  }, [
    activeProjects,
    selectedClient,
  ]);

  const handleToggleView =
    (mode) => {
      if (
        mode === viewMode
      ) {
        return;
      }

      if (
        containerRef.current
      ) {
        gsap.to(
          containerRef.current,
          {
            opacity: 0,
            y: 10,
            duration: 0.25,
            ease: "power2.in",

            onComplete: () => {
              setViewMode(mode);

              gsap.to(
                containerRef.current,
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.35,
                  ease: "power2.out",
                }
              );
            },
          }
        );
      } else {
        setViewMode(mode);
      }
    };

  const handleClientFilter =
    (clientName) => {
      if (
        clientName ===
        selectedClient
      ) {
        return;
      }

      if (
        containerRef.current
      ) {
        gsap.to(
          containerRef.current,
          {
            opacity: 0,
            y: 10,
            duration: 0.25,
            ease: "power2.in",

            onComplete: () => {
              setSelectedClient(
                clientName
              );

              gsap.to(
                containerRef.current,
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.35,
                  ease: "power2.out",
                }
              );
            },
          }
        );
      } else {
        setSelectedClient(
          clientName
        );
      }
    };

  const handleLoadMore =
    () => {
      setVisibleCount(
        (prev) =>
          Math.min(
            prev + 5,
            filteredProjects.length
          )
      );
    };

  useEffect(() => {
    const timer =
      setTimeout(() => {
        ScrollTrigger.refresh();
      }, 150);

    return () =>
      clearTimeout(timer);
  }, [
    viewMode,
    visibleCount,
    activeProjects,
    selectedClient,
  ]);

  useEffect(() => {
    if (
      hoveredProject &&
      canHover
    ) {
      setDisplayProject(
        hoveredProject
      );
    }
  }, [
    hoveredProject,
    canHover,
  ]);

  // --------------------------------------------------
  // PLAY BACKGROUND VIDEO
  // --------------------------------------------------

  useEffect(() => {
    if (
      viewMode !== "list" ||
      !canHover
    ) {
      return;
    }

    const source =
      getHeroVideoUrl(
        displayProject
      );

    const video =
      bgVideoRef.current;

    if (
      !source ||
      !video
    ) {
      return;
    }

    if (bgHlsRef.current) {
      bgHlsRef.current.destroy();
      bgHlsRef.current = null;
    }

    video.pause();
    video.removeAttribute(
      "src"
    );
    video.load();

    // Safari / native HLS
    if (
      video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
    ) {
      video.src = source;
      video.load();

      const playPromise =
        video.play();

      if (
        playPromise !==
        undefined
      ) {
        playPromise.catch(
          () => {}
        );
      }

      return;
    }

    // Chrome / Edge / Firefox
    if (
      Hls.isSupported()
    ) {
      const hls =
        new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
        });

      bgHlsRef.current =
        hls;

      hls.loadSource(source);
      hls.attachMedia(video);

      hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => {
          const playPromise =
            video.play();

          if (
            playPromise !==
            undefined
          ) {
            playPromise.catch(
              () => {}
            );
          }
        }
      );
    }

    return () => {
      if (
        bgHlsRef.current
      ) {
        bgHlsRef.current.destroy();
        bgHlsRef.current = null;
      }

      video.pause();
      video.removeAttribute(
        "src"
      );
      video.load();
    };
  }, [
    displayProject,
    hoveredProject,
    viewMode,
    canHover,
  ]);

  useEffect(() => {
    if (
      viewMode !== "list" ||
      !listContainerRef.current
    ) {
      return;
    }

    const ctx =
      gsap.context(() => {
        const listItems =
          listContainerRef.current.querySelectorAll(
            ".list-item-row"
          );

        gsap.set(listItems, {
          opacity: 0,
          y: 40,
        });

        gsap.fromTo(
          listItems,
          {
            opacity: 0,
            y: 40,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",

            scrollTrigger: {
              trigger:
                listContainerRef.current,

              start:
                "top 85%",

              toggleActions:
                "play none none reset",
            },
          }
        );
      }, listContainerRef);

    return () =>
      ctx.revert();
  }, [
    viewMode,
    activeProjects,
    selectedClient,
  ]);

  useEffect(() => {
    const lenis =
      new Lenis({
        duration: 1.2,

        easing: (t) =>
          Math.min(
            1,
            1.001 -
              Math.pow(
                2,
                -10 * t
              )
          ),

        smoothWheel: true,
        touchMultiplier: 2,
      });

    let frameId;

    function raf(time) {
      lenis.raf(time);

      frameId =
        requestAnimationFrame(
          raf
        );
    }

    frameId =
      requestAnimationFrame(
        raf
      );

    return () => {
      cancelAnimationFrame(
        frameId
      );

      lenis.destroy();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-black w-full min-h-screen flex items-center justify-center">
        <span className="font-geist-mono text-xs text-zinc-500 uppercase tracking-widest" />
      </div>
    );
  }

  return (
    <div className="bg-black w-full min-h-screen px-4 py-6 md:px-4 md:pt-22 relative overflow-x-hidden">
      <SharedTVNoise
        ref={noiseRef}
      />

      {/* BACKGROUND VIDEO */}

      {canHover && (
        <div
          className={`
            fixed
            inset-0
            z-0
            pointer-events-none
            overflow-hidden
            transition-opacity
            duration-500
            ease-out
            ${
              hoveredProject &&
              viewMode === "list"
                ? "opacity-100"
                : "opacity-0"
            }
          `}
        >
          {displayProject && (
            <>
              {(() => {
                const source =
                  getHeroVideoUrl(
                    displayProject
                  );

                return source ? (
                  <video
                    key={
                      displayProject._id
                    }
                    ref={
                      bgVideoRef
                    }
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    fetchPriority="high"
                    className="
                      absolute
                      inset-0
                      w-full
                      h-full
                      object-cover
                    "
                  />
                ) : null;
              })()}
            </>
          )}

          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      <Navigation />

      <div className="relative z-10 flex flex-col space-y-6 pt-14 md:pt-8 lg:pt-20">
        <div className="flex flex-row items-center justify-between w-full text-zinc-300">
          <div className="opacity-0 font-geist-mono font-medium tracking-tight text-[clamp(0.5rem,0.8vw,0.625rem)] flex items-center gap-2">
            <div className="w-2 h-2 bg-zinc-300" />

            <h1>
              SELECTED WORKS
            </h1>
          </div>

          <h1 className="font-geist-mono font-semibold tracking-tight text-ghost-white text-[clamp(0.5rem,0.8vw,0.825rem)]">
            [CLOUD_9]
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between w-full text-ghost-white gap-6 sm:gap-0 pb-6">
          <div className="flex flex-row items-start gap-4 sm:gap-6">
            <h1 className="text-[clamp(5rem,15vw,16.875rem)] tracking-[-8%] font-monot leading-none uppercase">
              Works
            </h1>

            <sup className="text-[clamp(1rem,2vw,1.875rem)] pt-1 sm:pt-6 leading-none font-sans font-medium tracking-tight">
              [
              {projects.length <
              10
                ? `0${projects.length}`
                : projects.length}
              ]
            </sup>
          </div>

          <div className="flex flex-col items-start sm:items-end justify-end space-y-4 w-full sm:w-auto">
            <div className="flex items-center space-x-3 font-geist-mono text-sm md:text-lg tracking-widest uppercase">
              <button
                onClick={() =>
                  handleToggleView(
                    "grid"
                  )
                }
                className={`
                  transition-colors
                  cursor-pointer
                  ${
                    viewMode ===
                    "grid"
                      ? "text-white font-bold"
                      : "text-zinc-500 hover:text-white"
                  }
                `}
              >
                GRID
              </button>

              <span className="text-zinc-600">
                /
              </span>

              <button
                onClick={() =>
                  handleToggleView(
                    "list"
                  )
                }
                className={`
                  transition-colors
                  cursor-pointer
                  ${
                    viewMode ===
                    "list"
                      ? "text-white font-bold"
                      : "text-zinc-500 hover:text-white"
                  }
                `}
              >
                LIST
              </button>
            </div>

            {clientFilters.length >
              0 && (
              <ClientFilter
                clientFilters={
                  clientFilters
                }
                selectedClient={
                  selectedClient
                }
                onClientFilter={
                  handleClientFilter
                }
              />
            )}
          </div>
        </div>

        <div
          ref={containerRef}
          className="w-full transition-all duration-300"
        >
          {/* ==========================================================
              GRID VIEW

              IMPORTANT:
              This remains mounted even when LIST is selected.
              It is only hidden with CSS, so WorkCard video/HLS
              instances are preserved.
             ========================================================== */}

          <div
            className={`grid-view ${
              viewMode === "grid"
                ? "block"
                : "hidden"
            }`}
          >
            <div className="flex flex-col space-y-8 lg:space-y-14 pt-4 pb-32 md:pb-40">
              {activeProjects.length >
                0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 w-full gap-12 text-lavender">
                  {activeProjects
                    .slice(0, 3)
                    .map(
                      (
                        project,
                        index
                      ) => (
                        <WorkCard
                          key={
                            project._id
                          }
                          video={
                            project
                          }
                          priority
                          heightClassName="w-full aspect-video"
                          onHoverChange={(
                            isHovered,
                            element,
                            projectData,
                            source
                          ) => {
                            if (
                              isHovered
                            ) {
                              setHoveredProject(
                                projectData
                              );

                              noiseRef.current?.setTarget?.(
                                element
                              );

                              noiseRef.current?.triggerNoise?.();
                            } else {
                              setHoveredProject(
                                null
                              );

                              noiseRef.current?.clearTarget?.();
                            }
                          }}
                        />
                      )
                    )}
                </div>
              )}

              {activeProjects.length >=
                4 && (
                <div className="w-full">
                  <WorkCard
                    video={
                      activeProjects[3]
                    }
                    fullBleedVideo
                    heightClassName="w-full md:h-[90vh]"
                    onHoverChange={(
                      isHovered,
                      element,
                      projectData,
                      source
                    ) => {
                      if (
                        isHovered
                      ) {
                        setHoveredProject(
                          projectData
                        );

                        noiseRef.current?.setTarget?.(
                          element
                        );

                        noiseRef.current?.triggerNoise?.();
                      } else {
                        setHoveredProject(
                          null
                        );

                        noiseRef.current?.clearTarget?.();
                      }
                    }}
                  />
                </div>
              )}

              {activeProjects.length >=
                5 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 w-full gap-8 items-start py-2">
                  <div className="lg:col-span-5 lg:translate-x-10">
                    <WorkCard
                      video={
                        activeProjects[4]
                      }
                      heightClassName="w-full aspect-video"
                      onHoverChange={(
                        isHovered,
                        element,
                        projectData,
                        source
                      ) => {
                        if (
                          isHovered
                        ) {
                          setHoveredProject(
                            projectData
                          );

                          noiseRef.current?.setTarget?.(
                            element
                          );

                          noiseRef.current?.triggerNoise?.();
                        } else {
                          setHoveredProject(
                            null
                          );

                          noiseRef.current?.clearTarget?.();
                        }
                      }}
                    />
                  </div>

                  {activeProjects.length >=
                    6 && (
                    <div className="lg:col-span-5 lg:col-start-7 lg:translate-y-12">
                      <WorkCard
                        video={
                          activeProjects[5]
                        }
                        heightClassName="w-full aspect-video"
                        onHoverChange={(
                          isHovered,
                          element,
                          projectData,
                          source
                        ) => {
                          if (
                            isHovered
                          ) {
                            setHoveredProject(
                              projectData
                            );

                            noiseRef.current?.setTarget?.(
                              element
                            );

                            noiseRef.current?.triggerNoise?.();
                          } else {
                            setHoveredProject(
                              null
                            );

                            noiseRef.current?.clearTarget?.();
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeProjects.length >=
                7 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 w-full gap-6 text-lavender md:pt-30">
                  <WorkCard
                    video={
                      activeProjects[6]
                    }
                    heightClassName="w-full aspect-video"
                    onHoverChange={(
                      isHovered,
                      element,
                      projectData,
                      source
                    ) => {
                      if (
                        isHovered
                      ) {
                        setHoveredProject(
                          projectData
                        );

                        noiseRef.current?.setTarget?.(
                          element
                        );

                        noiseRef.current?.triggerNoise?.();
                      } else {
                        setHoveredProject(
                          null
                        );

                        noiseRef.current?.clearTarget?.();
                      }
                    }}
                  />

                  {activeProjects.length >=
                    8 && (
                    <WorkCard
                      video={
                        activeProjects[7]
                      }
                      heightClassName="w-full aspect-video"
                      onHoverChange={(
                        isHovered,
                        element,
                        projectData,
                        source
                      ) => {
                        if (
                          isHovered
                        ) {
                          setHoveredProject(
                            projectData
                          );

                          noiseRef.current?.setTarget?.(
                            element
                          );

                          noiseRef.current?.triggerNoise?.();
                        } else {
                          setHoveredProject(
                            null
                          );

                          noiseRef.current?.clearTarget?.();
                        }
                      }}
                    />
                  )}
                </div>
              )}

              {activeProjects.length >=
                9 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 w-full gap-6 md:gap-2 text-lavender md:pt-30">
                  {activeProjects
                    .slice(8, 11)
                    .map(
                      (
                        project
                      ) => (
                        <WorkCard
                          key={
                            project._id
                          }
                          video={
                            project
                          }
                          heightClassName="w-full aspect-video"
                          onHoverChange={(
                            isHovered,
                            element,
                            projectData,
                            source
                          ) => {
                            if (
                              isHovered
                            ) {
                              setHoveredProject(
                                projectData
                              );

                              noiseRef.current?.setTarget?.(
                                element
                              );

                              noiseRef.current?.triggerNoise?.();
                            } else {
                              setHoveredProject(
                                null
                              );

                              noiseRef.current?.clearTarget?.();
                            }
                          }}
                        />
                      )
                    )}
                </div>
              )}

              {activeProjects.length >=
                12 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 w-full gap-6 md:gap-3 text-lavender md:pt-30">
                  {activeProjects
                    .slice(11, 13)
                    .map(
                      (
                        project
                      ) => (
                        <WorkCard
                          key={
                            project._id
                          }
                          video={
                            project
                          }
                          heightClassName="w-full aspect-video"
                          onHoverChange={(
                            isHovered,
                            element,
                            projectData,
                            source
                          ) => {
                            if (
                              isHovered
                            ) {
                              setHoveredProject(
                                projectData
                              );

                              noiseRef.current?.setTarget?.(
                                element
                              );

                              noiseRef.current?.triggerNoise?.();
                            } else {
                              setHoveredProject(
                                null
                              );

                              noiseRef.current?.clearTarget?.();
                            }
                          }}
                        />
                      )
                    )}
                </div>
              )}

              {activeProjects.length >
                13 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                  {activeProjects
                    .slice(13)
                    .map(
                      (
                        project
                      ) => (
                        <WorkCard
                          key={
                            project._id
                          }
                          video={
                            project
                          }
                          heightClassName="w-full aspect-video"
                          onHoverChange={(
                            isHovered,
                            element,
                            projectData,
                            source
                          ) => {
                            if (
                              isHovered
                            ) {
                              setHoveredProject(
                                projectData
                              );

                              noiseRef.current?.setTarget?.(
                                element
                              );

                              noiseRef.current?.triggerNoise?.();
                            } else {
                              setHoveredProject(
                                null
                              );

                              noiseRef.current?.clearTarget?.();
                            }
                          }}
                        />
                      )
                    )}
                </div>
              )}

              {activeProjects.length ===
                0 && (
                <div className="flex items-center justify-center py-32">
                  <span className="font-geist-mono text-xs text-zinc-600 uppercase tracking-widest">
                    No projects found
                  </span>
                </div>
              )}

              {visibleCount <
                filteredProjects.length && (
                <div className="flex justify-center pt-12">
                  <button
                    onClick={
                      handleLoadMore
                    }
                    className="font-geist-mono text-xs tracking-widest uppercase border border-zinc-700 text-ghost-white hover:bg-ghost-white hover:text-carbon-black px-6 py-3 rounded-full transition-colors duration-300"
                  >
                    LOAD MORE
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ==========================================================
              LIST VIEW

              Also remains mounted. Only visibility changes.
             ========================================================== */}

          <div
            className={`list-view ${
              viewMode === "list"
                ? "block"
                : "hidden"
            }`}
          >
            <div
              ref={
                listContainerRef
              }
              className="relative w-full pt-8 pb-8"
            >
              <div className="grid grid-cols-3 items-center text-zinc-500 font-geist-mono text-[0.65rem] md:text-xs uppercase tracking-wider pb-4 border-b border-zinc-800">
                <span className="text-left">
                  CLIENT
                </span>

                <span className="text-start">
                  PROJECT
                </span>

                <span className="text-right">
                  YEAR
                </span>
              </div>

              <div className="flex flex-col divide-y divide-zinc-800/60">
                {activeProjects.map(
                  (
                    project
                  ) => (
                    <ListItemRow
                      key={
                        project._id
                      }
                      project={
                        project
                      }
                      hoverEnabled={
                        canHover
                      }
                      onHoverStart={(
                        projectData
                      ) => {
                        setHoveredProject(
                          projectData
                        );
                      }}
                      onHoverEnd={() =>
                        setHoveredProject(
                          null
                        )
                      }
                    />
                  )
                )}
              </div>

              {activeProjects.length ===
                0 && (
                <div className="flex items-center justify-center py-32">
                  <span className="font-geist-mono text-xs text-zinc-600 uppercase tracking-widest">
                    No projects found
                  </span>
                </div>
              )}

              {visibleCount <
                filteredProjects.length && (
                <div className="flex justify-center pt-12">
                  <button
                    onClick={
                      handleLoadMore
                    }
                    className="font-geist-mono text-xs tracking-widest uppercase border border-zinc-700 text-ghost-white hover:bg-ghost-white hover:text-carbon-black px-6 py-3 rounded-full transition-colors duration-300"
                  >
                    LOAD MORE
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}