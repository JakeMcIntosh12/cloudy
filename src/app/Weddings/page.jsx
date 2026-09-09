"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useLayoutEffect,
} from "react";

import Button from "@/components/UI/Button";
import SmudgyTitleReveal from "@/components/Animations/SmudgyTitleReveal";
import CustomVideoPlayer from "@/components/UI/CustomVideoPlayer";
import TransitionLink from "@/components/PageTransitions/TransitionLink";
import BlurFlicker from "@/components/Animations/BlurFlicker";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Navigation from "@/components/UI/Navigation";
import { groq } from "next-sanity";
import { client } from "@/lib/client";
import BottomContent from "@/components/Sections/SmallFooter";
import Hls from "hls.js";

gsap.registerPlugin(ScrollTrigger, SplitText);

/* ============================================================
   1. SANITY QUERY
============================================================ */

const WEDDINGS_QUERY = groq`
  *[_type == "wedding"] | order(year desc) {
    _id,
    title,
    year,
    "videos": videos[]{
      _key,
      "url": url
    }
  }
`;

/* ============================================================
   2. MEDIA URL HELPER
============================================================ */

const getMediaUrl = (media) => {
  if (!media) return null;

  if (typeof media === "string") {
    return media;
  }

  if (typeof media.url === "string") {
    return media.url;
  }

  if (typeof media.src === "string") {
    return media.src;
  }

  if (media.asset?.url) {
    return media.asset.url;
  }

  return null;
};

/* ============================================================
   3. HLS HELPERS
============================================================ */

const isHlsUrl = (url) => {
  if (!url || typeof url !== "string") return false;

  return (
    url.includes(".m3u8") ||
    url.includes("playlist.m3u8")
  );
};

const attachVideoSource = (video, url) => {
  if (!video || !url) return null;

  let hls = null;

  /*
   * Safari / browsers with native HLS support
   */
  if (
    video.canPlayType(
      "application/vnd.apple.mpegurl"
    )
  ) {
    video.src = url;
    video.load();

    return null;
  }

  /*
   * Chrome / Edge / Firefox using HLS.js
   */
  if (isHlsUrl(url) && Hls.isSupported()) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 30,
      maxBufferLength: 20,
      maxMaxBufferLength: 40,
    });

    hls.loadSource(url);
    hls.attachMedia(video);

    return hls;
  }

  /*
   * Normal MP4 / fallback
   */
  video.src = url;
  video.load();

  return null;
};

/* ============================================================
   4. ANALOG TV NOISE SHADER
============================================================ */

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
        sin(dot(st.xy, vec2(12.9898, 78.233))) *
        43758.5453123
      );
    }

    void main() {
      vec2 st = vUv;

      float grain = random(
        st * 400.0 +
        vec2(uTime * 15.0, uTime * 25.0)
      );

      float scanline = sin(st.y * 800.0) * 0.08;

      float r = random(
        st * 400.0 +
        vec2(uTime * 15.0 + 0.02, uTime * 25.0)
      );

      float b = random(
        st * 400.0 +
        vec2(uTime * 15.0 - 0.02, uTime * 25.0)
      );

      vec3 color = vec3(r, grain, b) - scanline;

      gl_FragColor = vec4(color, uOpacity);
    }
  `,
};

function TVNoisePlane({ opacityRef }) {
  const materialRef = useRef(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
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
      }),
    []
  );

  useFrame((_, delta) => {
    if (!materialRef.current) return;

    materialRef.current.uniforms.uTime.value += delta;

    if (opacityRef.current !== undefined) {
      materialRef.current.uniforms.uOpacity.value =
        opacityRef.current.value;
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />

      <primitive
        object={material}
        ref={materialRef}
        attach="material"
      />
    </mesh>
  );
}

const R3FTVNoise = forwardRef((props, ref) => {
  const opacityRef = useRef({ value: 0 });

  useImperativeHandle(ref, () => ({
    triggerNoise: () => {
      gsap.killTweensOf(opacityRef.current);

      gsap
        .timeline()
        .set(opacityRef.current, {
          value: 0.85,
        })
        .to(opacityRef.current, {
          value: 0,
          duration: 0.32,
          ease: "power3.out",
        });
    },
  }));

  return (
    <div className="absolute inset-0 pointer-events-none mix-blend-screen z-20 overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 1] }}
        gl={{
          preserveDrawingBuffer: true,
          alpha: true,
          antialias: false,
          powerPreference: "low-power",
        }}
        className="w-full h-full pointer-events-none"
      >
        <TVNoisePlane opacityRef={opacityRef} />
      </Canvas>
    </div>
  );
});

R3FTVNoise.displayName = "R3FTVNoise";

/* ============================================================
   5. SMALL BUTTON
============================================================ */

const SmallButton = forwardRef(
  ({ isOpen = false }, ref) => {
    const buttonRef = useRef(null);

    useImperativeHandle(ref, () => ({
      triggerBlur: () => {
        if (!buttonRef.current) return;

        gsap.killTweensOf(buttonRef.current);

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
    }));

    return (
      <div
        ref={buttonRef}
        className={`font-mono tracking-tight text-[clamp(0.6875rem,0.9vw,0.75rem)] border transition-colors duration-300 rounded-full w-[clamp(6.5rem,10vw,6.6875rem)] h-[clamp(1.75rem,2.5vw,2rem)] px-3 py-1 flex items-center justify-center text-center cursor-pointer select-none ${
          isOpen
            ? "bg-ghost-white text-carbon-black border-ghost-white hover:bg-zinc-300"
            : "bg-carbon-black text-ghost-white border-eclipse hover:bg-carbon-black hover:text-ghost-white hover:border-eclipse"
        }`}
      >
        {isOpen ? "CLOSE" : "WATCH FILM"}
      </div>
    );
  }
);

SmallButton.displayName = "SmallButton";

/* ============================================================
   6. WEDDING CARD
============================================================ */

function WorkCard({
  wedding,
  containerClassName,
  heightClassName,
  onHoverChange,
  onOpen,
}) {
  const [currentTime, setCurrentTime] =
    useState("00:00");

  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const noiseRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const previewVideo = wedding?.videos?.[0];
  const previewUrl = getMediaUrl(previewVideo);

  /*
   * Attach the video source correctly.
   *
   * This is the important fix for Bunny .m3u8 videos.
   */
  useEffect(() => {
    const video = videoRef.current;

    if (!video || !previewUrl) return;

    /*
     * Clean up any previous HLS instance.
     */
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();

    /*
     * Remove any previous source.
     */
    video.removeAttribute("src");
    video.load();

    /*
     * Attach the new source.
     */
    const hls = attachVideoSource(
      video,
      previewUrl
    );

    hlsRef.current = hls;

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [previewUrl]);

  const handleLoadedMetadata = (e) => {
    const videoEl = e.currentTarget;

    if (
      videoEl &&
      Number.isFinite(videoEl.duration) &&
      videoEl.duration > 0
    ) {
      videoEl.currentTime =
        Math.random() * videoEl.duration;
    }
  };

  const handleTimeUpdate = (e) => {
    const videoEl = e.currentTarget;

    if (!videoEl) return;

    const seconds = videoEl.currentTime;

    if (isNaN(seconds)) {
      setCurrentTime("00:00");
      return;
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    setCurrentTime(
      `${mins < 10 ? "0" : ""}${mins}:${
        secs < 10 ? "0" : ""
      }${secs}`
    );
  };

  const handleMouseEnter = () => {
    onHoverChange(true);

    if (!containerRef.current) return;

    if (noiseRef.current?.triggerNoise) {
      noiseRef.current.triggerNoise();
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
      overwrite: "auto",
    });

    if (videoRef.current) {
      videoRef.current
        .play()
        .catch(() => {});
    }

    if (buttonRef.current?.triggerBlur) {
      buttonRef.current.triggerBlur();
    }
  };

  const handleMouseLeave = () => {
    onHoverChange(false);

    if (!containerRef.current) return;

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
      overwrite: "auto",
    });

    gsap.to(topR, {
      opacity: 0,
      scale: 0.9,
      x: 12,
      y: -12,
      duration: 0.75,
      ease: "power4.inOut",
      overwrite: "auto",
    });

    gsap.to(botL, {
      opacity: 0,
      scale: 0.9,
      x: -12,
      y: 12,
      duration: 0.75,
      ease: "power4.inOut",
      overwrite: "auto",
    });

    gsap.to(botR, {
      opacity: 0,
      scale: 0.9,
      x: 12,
      y: 12,
      duration: 0.75,
      ease: "power4.inOut",
      overwrite: "auto",
    });

    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  if (!previewUrl) return null;

  return (
    <div
      onClick={() => onOpen(wedding)}
      className={`flex flex-col space-y-2 w-full block group cursor-pointer ${
        containerClassName || ""
      }`}
    >
      {/* DATE / TIME */}

      <div className="flex flex-row items-center justify-between w-full px-1">
        <h1 className="font-geist-mono tracking-tight text-[clamp(0.6875rem,0.9vw,0.75rem)] text-zinc-500">
          {wedding.year || "—"}
        </h1>

        <h2 className="font-geist-mono font-medium tracking-tight text-[clamp(0.8125rem,1.2vw,1rem)] text-zinc-500">
          {currentTime}
        </h2>
      </div>

      {/* VIDEO */}

      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`relative overflow-hidden cursor-pointer aspect-video ${
          heightClassName || ""
        }`}
      >
        <video
          ref={videoRef}
          loop
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={
            handleLoadedMetadata
          }
          onTimeUpdate={handleTimeUpdate}
          className="w-full h-full object-cover brightness-90 contrast-105 transition-[filter] duration-500 ease-out"
        />

        <div className="absolute inset-0 bg-black/40 pointer-events-none transition-opacity duration-300 group-hover:opacity-10" />

        <R3FTVNoise ref={noiseRef} />

        {/* CORNER BRACKETS */}

        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          <div className="corner-tl absolute top-4 left-4 w-8 h-8 border-t border-l border-white opacity-0 scale-90 -translate-x-3 -translate-y-3 mix-blend-difference" />

          <div className="corner-tr absolute top-4 right-4 w-8 h-8 border-t border-r border-white opacity-0 scale-90 translate-x-3 -translate-y-3 mix-blend-difference" />

          <div className="corner-bl absolute bottom-4 left-4 w-8 h-8 border-b border-l border-white opacity-0 scale-90 -translate-x-3 translate-y-3 mix-blend-difference" />

          <div className="corner-br absolute bottom-4 right-4 w-8 h-8 border-b border-r border-white opacity-0 scale-90 translate-x-3 translate-y-3 mix-blend-difference" />
        </div>
      </div>

      {/* WEDDING INFO */}

      <div className="flex flex-row items-baseline justify-between w-full px-1 pt-2 text-ghost-white">
        <div className="flex flex-col">
          <SmudgyTitleReveal
            text={
              wedding.title?.toUpperCase() ||
              "UNTITLED WEDDING"
            }
          />
        </div>

        <SmallButton ref={buttonRef} />
      </div>
    </div>
  );
}

/* ============================================================
   7. LIST ROW
============================================================ */

function ListItemRow({
  wedding,
  onHoverStart,
  onHoverEnd,
  onOpen,
}) {
  const rowRef = useRef(null);
  const titleRef = useRef(null);
  const yearRef = useRef(null);

  const activateRow = useCallback(() => {
    onHoverStart(wedding);

    gsap.to(rowRef.current, {
      backgroundColor: "#ffffff",
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });

    gsap.to(titleRef.current, {
      x: 12,
      color: "#000000",
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto",
    });

    gsap.to(yearRef.current, {
      x: -8,
      color: "#000000",
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, [onHoverStart, wedding]);

  const deactivateRow = useCallback(() => {
    onHoverEnd();

    gsap.to(rowRef.current, {
      backgroundColor: "transparent",
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });

    gsap.to(titleRef.current, {
      x: 0,
      color: "#f8f8f8",
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto",
    });

    gsap.to(yearRef.current, {
      x: 0,
      color: "#71717a",
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, [onHoverEnd]);

  return (
    <div
      ref={rowRef}
      onMouseEnter={activateRow}
      onMouseLeave={deactivateRow}
      onClick={() => onOpen(wedding)}
      className="list-item-row cursor-pointer"
    >
      <div className="relative grid grid-cols-2 items-center py-4 px-2">
        {/* COUPLE */}

        <span
          ref={titleRef}
          className="font-serif text-sm md:text-xl font-light uppercase text-ghost-white inline-block"
        >
          {wedding.title ||
            "UNTITLED WEDDING"}
        </span>

        {/* YEAR */}

        <span
          ref={yearRef}
          className="font-geist-mono text-sm md:text-base text-right text-zinc-500 inline-block"
        >
          {wedding.year || "—"}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   8. MAIN WEDDINGS PAGE
============================================================ */

export default function WeddingsSection() {
  const cursorRef = useRef(null);
  const containerRef = useRef(null);
  const listPreviewRef = useRef(null);
  const listContainerRef = useRef(null);

  const bgVideoRef = useRef(null);
  const bgHlsRef = useRef(null);

  const introRef = useRef(null);

  const [weddings, setWeddings] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [fetchError, setFetchError] =
    useState(null);

  const [viewMode, setViewMode] =
    useState("grid");

  const [visibleCount, setVisibleCount] =
    useState(13);

  const [hoveredProject, setHoveredProject] =
    useState(null);

  const [displayProject, setDisplayProject] =
    useState(null);

  const [
    isHoveringVideo,
    setIsHoveringVideo,
  ] = useState(false);

  /* VIDEO PLAYER STATE */

  const [selectedWedding, setSelectedWedding] =
    useState(null);

  const [isPlayerOpen, setIsPlayerOpen] =
    useState(false);

  /* ============================================================
     FETCH WEDDINGS
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    async function fetchWeddings() {
      try {
        setIsLoading(true);
        setFetchError(null);

        const data = await client.fetch(
          WEDDINGS_QUERY,
          {},
          {
            next: {
              revalidate: 60,
            },
          }
        );

        if (cancelled) return;

        const formattedWeddings =
          Array.isArray(data)
            ? data
                .map((wedding) => ({
                  ...wedding,

                  videos:
                    Array.isArray(
                      wedding.videos
                    )
                      ? wedding.videos
                          .map((video) => ({
                            ...video,
                            url: getMediaUrl(
                              video
                            ),
                          }))
                          .filter(
                            (video) =>
                              video.url
                          )
                      : [],
                }))
                .filter(
                  (wedding) =>
                    wedding.title &&
                    wedding.videos?.length >
                      0
                )
            : [];

        console.log(
          "WEDDINGS FROM SANITY:",
          formattedWeddings
        );

        setWeddings(
          formattedWeddings
        );
      } catch (error) {
        console.error(
          "Failed to fetch weddings from Sanity:",
          error
        );

        if (!cancelled) {
          setWeddings([]);

          setFetchError(
            "Unable to load weddings."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchWeddings();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
     INTRO SPLIT TEXT REVEAL
  ============================================================ */

  useLayoutEffect(() => {
    if (!introRef.current) return;

    const ctx = gsap.context(() => {
      const split = new SplitText(
        introRef.current,
        {
          type: "lines",
          linesClass:
            "intro-split-line",
        }
      );

      gsap.set(split.lines, {
        yPercent: 110,
        opacity: 0,
      });

      split.lines.forEach((line) => {
        const wrapper =
          document.createElement("div");

        wrapper.className =
          "overflow-hidden";

        line.parentNode.insertBefore(
          wrapper,
          line
        );

        wrapper.appendChild(line);
      });

      gsap.to(split.lines, {
        yPercent: 0,
        opacity: 1,
        duration: 0.9,
        stagger: 0.08,
        ease: "power4.out",

        scrollTrigger: {
          trigger: introRef.current,
          start: "top 80%",
          toggleActions:
            "play none none reset",
        },
      });
    }, introRef);

    return () => ctx.revert();
  }, []);

  const activeProjects = useMemo(() => {
    return weddings.slice(
      0,
      visibleCount
    );
  }, [
    weddings,
    visibleCount,
  ]);

  /* ============================================================
     PLAYER
  ============================================================ */

  const openPlayer = useCallback(
    (wedding) => {
      setSelectedWedding(wedding);
      setIsPlayerOpen(true);
    },
    []
  );

  const closePlayer = useCallback(() => {
    setIsPlayerOpen(false);

    setTimeout(() => {
      setSelectedWedding(null);
    }, 300);
  }, []);

  /* ============================================================
     VIEW TOGGLE
  ============================================================ */

  const handleToggleView = (mode) => {
    if (mode === viewMode) return;

    if (containerRef.current) {
      gsap.to(containerRef.current, {
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
      });
    } else {
      setViewMode(mode);
    }
  };

  /* ============================================================
     LOAD MORE
  ============================================================ */

  const handleLoadMore = () => {
    setVisibleCount((prev) =>
      Math.min(
        prev + 5,
        weddings.length
      )
    );
  };

  /* ============================================================
     SCROLL TRIGGER REFRESH
  ============================================================ */

  useEffect(() => {
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 150);

    return () =>
      clearTimeout(timer);
  }, [
    viewMode,
    visibleCount,
    weddings,
  ]);

  /* ============================================================
     HOVERED PROJECT
  ============================================================ */

  useEffect(() => {
    if (hoveredProject) {
      setDisplayProject(
        hoveredProject
      );
    }
  }, [hoveredProject]);

  /* ============================================================
     FULLSCREEN HOVER VIDEO
  ============================================================ */

  useEffect(() => {
    const video = bgVideoRef.current;

    const url = getMediaUrl(
      displayProject?.videos?.[0]
    );

    if (!video || !url) return;

    /*
     * Destroy old HLS instance.
     */

    if (bgHlsRef.current) {
      bgHlsRef.current.destroy();
      bgHlsRef.current = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();

    /*
     * Native HLS.
     */

    if (
      video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
    ) {
      video.src = url;
      video.load();

      video
        .play()
        .catch(() => {});

      return () => {
        video.pause();
        video.removeAttribute(
          "src"
        );
        video.load();
      };
    }

    /*
     * HLS.js.
     */

    if (
      isHlsUrl(url) &&
      Hls.isSupported()
    ) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
      });

      bgHlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => {
          if (hoveredProject) {
            video
              .play()
              .catch(() => {});
          }
        }
      );

      return () => {
        hls.destroy();

        if (
          bgHlsRef.current === hls
        ) {
          bgHlsRef.current = null;
        }

        video.pause();
        video.removeAttribute(
          "src"
        );
        video.load();
      };
    }

    /*
     * Normal MP4 fallback.
     */

    video.src = url;
    video.load();

    video
      .play()
      .catch(() => {});

    return () => {
      video.pause();
      video.removeAttribute(
        "src"
      );
      video.load();
    };
  }, [
    displayProject,
    hoveredProject,
  ]);

  /* ============================================================
     LIST STAGGER
  ============================================================ */

  useEffect(() => {
    if (
      viewMode !== "list" ||
      !listContainerRef.current
    ) {
      return;
    }

    const ctx = gsap.context(() => {
      const listItems =
        listContainerRef.current.querySelectorAll(
          ".list-item-row"
        );

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
            start: "top 85%",
            toggleActions:
              "play none none reset",
          },
        }
      );
    }, listContainerRef);

    return () => ctx.revert();
  }, [
    viewMode,
    activeProjects,
  ]);

  /* ============================================================
     CURSOR & PREVIEW TRACKING
  ============================================================ */

  useEffect(() => {
    const cursor =
      cursorRef.current;

    const preview =
      listPreviewRef.current;

    const ctx = gsap.context(() => {
      if (cursor) {
        gsap.set(cursor, {
          xPercent: -50,
          yPercent: -50,
        });
      }

      if (preview) {
        gsap.set(preview, {
          xPercent: -50,
          yPercent: -50,
          x:
            window.innerWidth / 2,
          y:
            window.innerHeight / 2,
        });
      }

      const xToCursor = cursor
        ? gsap.quickTo(
            cursor,
            "x",
            {
              duration: 0.2,
              ease: "power3",
            }
          )
        : null;

      const yToCursor = cursor
        ? gsap.quickTo(
            cursor,
            "y",
            {
              duration: 0.2,
              ease: "power3",
            }
          )
        : null;

      const xToPreview = preview
        ? gsap.quickTo(
            preview,
            "x",
            {
              duration: 0.35,
              ease: "power3.out",
            }
          )
        : null;

      const yToPreview = preview
        ? gsap.quickTo(
            preview,
            "y",
            {
              duration: 0.35,
              ease: "power3.out",
            }
          )
        : null;

      const movePointer = (e) => {
        if (
          xToCursor &&
          yToCursor
        ) {
          xToCursor(
            e.clientX
          );

          yToCursor(
            e.clientY
          );
        }

        if (
          xToPreview &&
          yToPreview
        ) {
          xToPreview(
            e.clientX
          );

          yToPreview(
            e.clientY
          );
        }
      };

      window.addEventListener(
        "mousemove",
        movePointer
      );

      return () => {
        window.removeEventListener(
          "mousemove",
          movePointer
        );
      };
    });

    return () => ctx.revert();
  }, [viewMode]);

  /* ============================================================
     CURSOR VISIBILITY
  ============================================================ */

  useEffect(() => {
    const cursor =
      cursorRef.current;

    if (!cursor) return;

    gsap.to(cursor, {
      scale: isHoveringVideo
        ? 1
        : 0,

      opacity: isHoveringVideo
        ? 1
        : 0,

      duration:
        isHoveringVideo
          ? 0.25
          : 0.2,

      ease: isHoveringVideo
        ? "power2.out"
        : "power2.in",
    });
  }, [
    isHoveringVideo,
  ]);

  /* ============================================================
     PLAY VIDEO TAG
  ============================================================ */

  useEffect(() => {
    const preview =
      listPreviewRef.current;

    if (!preview) return;

    if (hoveredProject) {
      gsap.to(preview, {
        scale: 1,
        opacity: 1,
        duration: 0.35,
        ease: "power3.out",
      });
    } else {
      gsap.to(preview, {
        scale: 0.85,
        opacity: 0,
        duration: 0.25,
        ease: "power3.in",
      });
    }
  }, [
    hoveredProject,
  ]);

  /* ============================================================
     VIDEO HOVER
  ============================================================ */

  const handleHoverChange =
    useCallback(
      (isHovered) => {
        setIsHoveringVideo(
          isHovered
        );
      },
      []
    );

  /* ============================================================
     LENIS
  ============================================================ */

  useEffect(() => {
    const lenis = new Lenis({
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
      requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(
        frameId
      );

      lenis.destroy();
    };
  }, []);

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <>
      {/* CUSTOM VIDEO PLAYER */}

      <CustomVideoPlayer
        src={getMediaUrl(
          selectedWedding?.videos?.[0]
        )}
        title={
          selectedWedding?.title ||
          "Wedding Film"
        }
        isOpen={isPlayerOpen}
        onClose={closePlayer}
      />

      <div className="bg-black w-full min-h-screen py-6 px-4 md:py-2 md:px-4 relative overflow-hidden pb-2 md:pb-2">

        {/* FULL-BLEED HOVER VIDEO BACKGROUND */}

        <div
          className={`fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-500 ease-out ${
            hoveredProject
              ? "opacity-100"
              : "opacity-0"
          }`}
        >
          {displayProject && (
            <video
              key={
                displayProject._id
              }
              ref={bgVideoRef}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          <div className="absolute inset-0 bg-black/60" />
        </div>

        {/* NAVIGATION */}

        <Navigation />

        {/* INTRO */}

        <div className="flex w-full min-h-[55vh] items-center justify-start px-2 pt-10 md:pt-20">
          <h1
            ref={introRef}
            className="font-sans tracking-tight text-[clamp(2rem,6vw,3rem)] md:text-[clamp(0.8rem,4vw,3rem)] w-[clamp(15rem,75vw,46.875rem)] text-ghost-white leading-tight"
          >
            MOMENTS WORTH
            REMEMBERING
          </h1>
        </div>

        {/* CUSTOM CURSOR */}

        <div
          ref={cursorRef}
          className="fixed top-0 left-0 pointer-events-none z-[100] hidden md:block scale-0 opacity-0 mix-blend-difference text-white"
        >
          <span className="font-geist-mono text-xl font-medium tracking-tight">
            [ CLICK ]
          </span>
        </div>

        {/* FLOATING PLAY TAG */}

        <div
          ref={listPreviewRef}
          className="fixed top-0 left-0 pointer-events-none z-[100] hidden scale-85 opacity-0"
        >
          <span className="font-geist-mono text-[0.65rem] tracking-widest uppercase bg-ghost-white text-carbon-black px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
            Play Film
          </span>
        </div>

        {/* HEADER */}

        <div className="relative z-10 flex flex-col space-y-6 pt-14 md:pt-10 lg:pt-30">

          <div className="flex flex-row items-center justify-between w-full text-zinc-300">
            <div className="opacity-0 font-geist-mono font-medium tracking-tight text-[clamp(0.5rem,0.8vw,0.625rem)] flex items-center gap-2">
              <div className="w-2 h-2 bg-zinc-300" />
              <h1>WEDDINGS</h1>
            </div>

            <h1 className="font-geist-mono font-semibold tracking-tight text-ghost-white text-[clamp(0.5rem,0.8vw,0.825rem)]">
              [CLOUD_9]
            </h1>
          </div>

          {/* WORKS HEADER */}

          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between w-full text-ghost-white gap-6 sm:gap-0 pb-6">

            <div className="flex flex-row items-start gap-4 sm:gap-6 font-monot">
              <h1 className="text-[clamp(5rem,15vw,16.875rem)] tracking-[-8%] font-light leading-none uppercase">
                WORKS
              </h1>

              <sup className="text-[clamp(1rem,2vw,1.875rem)] pt-1 sm:pt-6 leading-none font-sans font-medium tracking-tight">
                [
                {activeProjects.length <
                10
                  ? `0${activeProjects.length}`
                  : activeProjects.length}
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
                  className={`transition-colors cursor-pointer ${
                    viewMode === "grid"
                      ? "text-white font-bold"
                      : "text-zinc-500 hover:text-white"
                  }`}
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
                  className={`transition-colors cursor-pointer ${
                    viewMode === "list"
                      ? "text-white font-bold"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  LIST
                </button>

              </div>
            </div>
          </div>

          {/* CONTENT */}

          <div
            ref={containerRef}
            className="w-full transition-all duration-300"
          >

            {isLoading ? (
              <div className="w-full py-20 flex justify-center">
                <p className="font-geist-mono text-xs tracking-widest uppercase text-zinc-500" />
              </div>
            ) : fetchError ? (
              <div className="w-full py-20 flex justify-center">
                <p className="font-geist-mono text-xs tracking-widest uppercase text-zinc-500">
                  {fetchError}
                </p>
              </div>
            ) : activeProjects.length ===
              0 ? (
              <div className="w-full py-20 flex justify-center">
                <p className="font-geist-mono text-xs tracking-widest uppercase text-zinc-500">
                  No weddings available.
                </p>
              </div>
            ) : viewMode ===
              "grid" ? (

              /* 5-VIDEO EDITORIAL GRID */

              <div className="flex flex-col space-y-8 lg:space-y-58 pt-6">

                {/* VIDEO 01 + VIDEO 02 */}

                {activeProjects.length >=
                  2 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 w-full gap-8 lg:gap-0 text-lavender">

                    <WorkCard
                      wedding={
                        activeProjects[0]
                      }
                      heightClassName="w-full aspect-video lg:aspect-none h-[17.5rem] lg:h-[30rem]"
                      onHoverChange={
                        handleHoverChange
                      }
                      onOpen={
                        openPlayer
                      }
                    />

                    <WorkCard
                      wedding={
                        activeProjects[1]
                      }
                      heightClassName="w-full aspect-video lg:aspect-none h-[17.5rem] lg:h-[30rem]"
                      onHoverChange={
                        handleHoverChange
                      }
                      onOpen={
                        openPlayer
                      }
                    />

                  </div>
                )}

                {/* VIDEO 03 — FEATURED / FULL WIDTH */}

                {activeProjects.length >=
                  3 && (
                  <WorkCard
                    wedding={
                      activeProjects[2]
                    }
                    heightClassName="w-screen left-1/2 -translate-x-1/2 h-[60vh] lg:h-screen"
                    onHoverChange={
                      handleHoverChange
                    }
                    onOpen={
                      openPlayer
                    }
                  />
                )}

                {/* VIDEO 04 + VIDEO 05 — ASYMMETRIC */}

                {activeProjects.length >=
                  5 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 w-full gap-8 lg:gap-12 text-lavender pb-12 lg:pb-24 items-start">

                    <WorkCard
                      wedding={
                        activeProjects[3]
                      }
                      heightClassName="w-full aspect-video lg:aspect-none h-[17.5rem] lg:h-[36rem]"
                      onHoverChange={
                        handleHoverChange
                      }
                      onOpen={
                        openPlayer
                      }
                    />

                    <WorkCard
                      wedding={
                        activeProjects[4]
                      }
                      containerClassName="lg:translate-y-24"
                      heightClassName="w-full aspect-video lg:aspect-none h-[17.5rem] lg:h-[26rem]"
                      onHoverChange={
                        handleHoverChange
                      }
                      onOpen={
                        openPlayer
                      }
                    />

                  </div>
                )}

                {/* REMAINING WEDDINGS */}

                {activeProjects.length >
                  5 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 w-full gap-8 lg:gap-12 text-lavender">

                    {activeProjects
                      .slice(5)
                      .map(
                        (
                          wedding
                        ) => (
                          <WorkCard
                            key={
                              wedding._id
                            }
                            wedding={
                              wedding
                            }
                            heightClassName="w-full aspect-video lg:aspect-none h-[17.5rem] lg:h-[30rem]"
                            onHoverChange={
                              handleHoverChange
                            }
                            onOpen={
                              openPlayer
                            }
                          />
                        )
                      )}

                  </div>
                )}

              </div>
            ) : (

              /* LIST VIEW */

              <div
                ref={
                  listContainerRef
                }
                className="relative w-full pt-8 pb-16"
              >

                {/* TABLE HEADER */}

                <div className="grid grid-cols-2 items-center text-zinc-500 font-geist-mono text-xs uppercase tracking-wider pb-4 border-b border-zinc-800">

                  <span className="text-left">
                    COUPLE
                  </span>

                  <span className="text-right">
                    YEAR
                  </span>

                </div>

                {/* LIST ROWS */}

                <div className="flex flex-col divide-y divide-zinc-800/60">

                  {activeProjects.map(
                    (wedding) => (
                      <ListItemRow
                        key={
                          wedding._id
                        }
                        wedding={
                          wedding
                        }
                        onHoverStart={
                          setHoveredProject
                        }
                        onHoverEnd={() =>
                          setHoveredProject(
                            null
                          )
                        }
                        onOpen={
                          openPlayer
                        }
                      />
                    )
                  )}

                </div>

                {/* LOAD MORE */}

                {visibleCount <
                  weddings.length && (
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
            )}

          </div>
        </div>

        {/* BOTTOM CONTENT */}

        <BottomContent />

      </div>
    </>
  );
}