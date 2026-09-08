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
import Button from "@/components/UI/Button";
import Footer from "@/components/Sections/Footer";
import SmudgyTextReveal from "@/components/Animations/SmudgyTextReveal";
import SmudgyTitleReveal from "@/components/Animations/SmudgyTitleReveal";
import ServicesSection from "@/components/Sections/ServicesSection";
import ClientsSection from "@/components/Sections/ClientsSection";
import Testimonials from "@/components/Sections/Testimonials";
import BlurFlicker from "@/components/Animations/BlurFlicker";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { client } from "@/lib/client";

gsap.registerPlugin(ScrollTrigger);

// ----------------------------------------------------------------------
// SANITY WORKS QUERY
//
// We are showcasing CMS works 1–5.
// The five selected projects are shuffled before being displayed.
// This does NOT affect the total counter.
// ----------------------------------------------------------------------

const SELECTED_WORKS_QUERY = `
  *[
    _type == "caseStudy" &&
    defined(slug.current)
  ]
  | order(_createdAt asc)
  [0...5]
  {
    _id,
    client,
    title,
    date,
    "slug": slug.current,

    heroVideos[]{
      _key,
      "src": select(
        sourceType == "cloudinary" => url,
        sourceType == "sanity" => video.asset->url,
        null
      )
    },
  }
`;

// ----------------------------------------------------------------------
// TOTAL WORKS COUNT QUERY
//
// This counts ALL case studies in the CMS.
// It is completely independent from the 5 projects shown above.
// ----------------------------------------------------------------------

const TOTAL_WORKS_COUNT_QUERY = `
  count(
    *[
      _type == "caseStudy" &&
      defined(slug.current)
    ]
  )
`;

// ----------------------------------------------------------------------
// SANITY ABOUT CONTENT QUERY
//
// Pulls the brief intro text from the global About Content document.
// ----------------------------------------------------------------------

const ABOUT_CONTENT_QUERY = `
  *[
    _type == "aboutContent"
  ][0]
  {
    briefIntroText
  }
`;

// ----------------------------------------------------------------------
// 1. ANALOG TV NOISE SHADER MATERIAL & R3F MESH
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
        sin(
          dot(
            st.xy,
            vec2(12.9898, 78.233)
          )
        ) * 43758.5453123
      );
    }

    void main() {
      vec2 st = vUv;

      float grain = random(
        st * 400.0 +
        vec2(
          uTime * 15.0,
          uTime * 25.0
        )
      );

      float scanline =
        sin(st.y * 800.0) * 0.08;

      float r = random(
        st * 400.0 +
        vec2(
          uTime * 15.0 + 0.02,
          uTime * 25.0
        )
      );

      float b = random(
        st * 400.0 +
        vec2(
          uTime * 15.0 - 0.02,
          uTime * 25.0
        )
      );

      vec3 color =
        vec3(r, grain, b) -
        scanline;

      gl_FragColor =
        vec4(color, uOpacity);
    }
  `,
};

// ----------------------------------------------------------------------
// TV NOISE PLANE
// ----------------------------------------------------------------------

function TVNoisePlane({ opacityRef }) {
  const materialRef = useRef(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: {
            value: 0,
          },

          uOpacity: {
            value: 0,
          },
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
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value +=
        delta;

      if (
        opacityRef.current !== undefined
      ) {
        materialRef.current.uniforms.uOpacity.value =
          opacityRef.current.value;
      }
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

// ----------------------------------------------------------------------
// TV NOISE WRAPPER
// ----------------------------------------------------------------------

const R3FTVNoise = forwardRef(
  (props, ref) => {
    const opacityRef = useRef({
      value: 0,
    });

    useImperativeHandle(
      ref,
      () => ({
        triggerNoise: () => {
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

                ease:
                  "power3.out",
              }
            );
        },
      })
    );

    return (
      <div className="absolute inset-0 pointer-events-none mix-blend-screen z-20 overflow-hidden">
        <Canvas
          camera={{
            position: [0, 0, 1],
          }}
          gl={{
            preserveDrawingBuffer: true,

            alpha: true,

            antialias: false,

            powerPreference:
              "low-power",
          }}
          className="w-full h-full pointer-events-none"
        >
          <TVNoisePlane
            opacityRef={opacityRef}
          />
        </Canvas>
      </div>
    );
  }
);

R3FTVNoise.displayName =
  "R3FTVNoise";

// ----------------------------------------------------------------------
// 2. SMALL BUTTON COMPONENT
// ----------------------------------------------------------------------

const SmallButton = forwardRef(
  (_, ref) => {
    const buttonRef = useRef(null);

    useImperativeHandle(
      ref,
      () => ({
        triggerBlur: () => {
          if (!buttonRef.current) {
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
        className="font-mono tracking-tight text-[clamp(0.5875rem,0.9vw,0.65rem)] border transition-colors duration-300 rounded-full w-[clamp(5.5rem,10vw,6.0875rem)] h-[clamp(1.75rem,2.5vw,2rem)] px-3 py-1 flex items-center justify-center text-center cursor-pointer select-none bg-black text-ghost-white border-eclipse "
      >
        WATCH FILM
      </div>
    );
  }
);

SmallButton.displayName =
  "SmallButton";

// ----------------------------------------------------------------------
// 3. HELPERS
// ----------------------------------------------------------------------

const formatTime = (seconds) => {
  if (isNaN(seconds)) {
    return "00:00";
  }

  const mins = Math.floor(
    seconds / 60
  );

  const secs = Math.floor(
    seconds % 60
  );

  return `${
    mins < 10 ? "0" : ""
  }${mins}:${
    secs < 10 ? "0" : ""
  }${secs}`;
};

// ----------------------------------------------------------------------
// NORMALIZE SANITY PROJECT
// ----------------------------------------------------------------------

const normalizeProject = (
  project,
  index
) => {
  if (!project) {
    return null;
  }

  const firstHeroVideo =
    project.heroVideos?.find(
      (video) =>
        typeof video?.src ===
          "string" &&
        video.src.length > 0
    );

  return {
    id:
      project._id ||
      index + 1,

    date:
      project.date ||
      "",

    url:
      firstHeroVideo?.src ||
      null,

    title:
      project.client ||
      "",

    subtitle:
      project.title ||
      "",

    slug:
      project.slug ||
      "",
  };
};

// ----------------------------------------------------------------------
// 4. WORK CARD COMPONENT
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// 4. WORK CARD COMPONENT
// ----------------------------------------------------------------------

function WorkCard({
  video,
  containerClassName,
  heightClassName,
  onHoverChange,
}) {
  const [
    currentTime,
    setCurrentTime,
  ] = useState("00:00");

  const containerRef =
    useRef(null);

  const buttonRef =
    useRef(null);

  const noiseRef =
    useRef(null);

  const videoRef =
    useRef(null);

  // --------------------------------------------------
  // VIDEO METADATA
  // --------------------------------------------------

  const handleLoadedMetadata =
    (e) => {
      const videoEl =
        e.currentTarget;

      if (
        videoEl &&
        videoEl.duration
      ) {
        videoEl.currentTime =
          Math.random() *
          videoEl.duration;
      }
    };

  // --------------------------------------------------
  // VIDEO TIMER
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
    () => {
      onHoverChange(true);

      if (
        !containerRef.current
      ) {
        return;
      }

      if (
        noiseRef.current
          ?.triggerNoise
      ) {
        noiseRef.current.triggerNoise();
      }

      const brackets =
        containerRef.current.querySelectorAll(
          ".corner-tl, .corner-tr, .corner-bl, .corner-br"
        );

      gsap.to(
        brackets,
        {
          opacity: 1,

          scale: 1,

          x: 0,

          y: 0,

          duration: 0.35,

          ease: "power2.out",

          overwrite: "auto",
        }
      );

      // ------------------------------------------------
      // PLAY VIDEO ON HOVER
      // ------------------------------------------------

      if (
        videoRef.current
      ) {
        videoRef.current
          .play()
          .catch(() => {});
      }

      if (
        buttonRef.current
          ?.triggerBlur
      ) {
        buttonRef.current.triggerBlur();
      }
    };

  // --------------------------------------------------
  // HOVER LEAVE
  // --------------------------------------------------

  const handleMouseLeave =
    () => {
      onHoverChange(false);

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
      });

      gsap.to(topR, {
        opacity: 0,

        scale: 0.9,

        x: 12,

        y: -12,

        duration: 0.75,

        ease: "power4.inOut",
      });

      gsap.to(botL, {
        opacity: 0,

        scale: 0.9,

        x: -12,

        y: 12,

        duration: 0.75,

        ease: "power4.inOut",
      });

      gsap.to(botR, {
        opacity: 0,

        scale: 0.9,

        x: 12,

        y: 12,

        duration: 0.75,

        ease: "power4.inOut",
      });

      // ------------------------------------------------
      // PAUSE VIDEO WHEN LEAVING
      // ------------------------------------------------

      if (
        videoRef.current
      ) {
        videoRef.current.pause();
      }
    };

  // --------------------------------------------------
  // SAFETY
  // --------------------------------------------------

  if (!video) {
    return null;
  }

  return (
    <TransitionLink
      href={`/Work/${video.slug}`}
      className={`flex flex-col space-y-2 w-full block group ${
        containerClassName || ""
      }`}
    >

      {/* TOP INFORMATION */}

      <div className="flex flex-row items-center justify-between w-full px-0 md:px-2">

        <h1 className="font-geist-mono tracking-tight text-[clamp(0.6875rem,0.9vw,0.75rem)] text-zinc-500">
          {video.date}
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
        className={`relative overflow-hidden cursor-none ${heightClassName}`}
      >

        {video.url ? (
          <video
            ref={videoRef}
            src={video.url}
            loop
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={
              handleLoadedMetadata
            }
            onTimeUpdate={
              handleTimeUpdate
            }
            className="w-full h-full object-cover brightness-90 contrast-105 transition-[filter] duration-500 ease-out group-hover:brightness-90"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">

            <span className="font-geist-mono text-[10px] text-zinc-600 uppercase tracking-widest">
              No Preview
            </span>

          </div>
        )}

        <div className="absolute inset-0 bg-black/40 pointer-events-none transition-opacity duration-300 group-hover:opacity-10" />

        <R3FTVNoise
          ref={noiseRef}
        />

        {/* CORNER BRACKETS */}

        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">

          <div className="corner-tl absolute top-4 left-4 w-8 h-8 border-t-1 border-l-1 border-white opacity-0 scale-90 -translate-x-3 -translate-y-3 mix-blend-difference" />

          <div className="corner-tr absolute top-4 right-4 w-8 h-8 border-t-1 border-r-1 border-white opacity-0 scale-90 translate-x-3 -translate-y-3 mix-blend-difference" />

          <div className="corner-bl absolute bottom-4 left-4 w-8 h-8 border-b-1 border-l-1 border-white opacity-0 scale-90 -translate-x-3 translate-y-3 mix-blend-difference" />

          <div className="corner-br absolute bottom-4 right-4 w-8 h-8 border-b-1 border-r-1 border-white opacity-0 scale-90 translate-x-3 translate-y-3 mix-blend-difference" />

        </div>

      </div>

      {/* BOTTOM INFORMATION */}

      <div className="flex flex-row items-baseline justify-between w-full px-0 md:px-2 pt-2 text-ghost-white">

        <div className="flex flex-col">

          <p className="font-geist-mono text-[clamp(0.75rem,1vw,0.575rem)] text-zinc-400 tracking-tight">
            {video.title}
          </p>

          <SmudgyTitleReveal
            text={video.subtitle}
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
// 5. MAIN PAGE COMPONENT
// ----------------------------------------------------------------------

export default function Page() {
  const cursorRef =
    useRef(null);

  const footerContainerRef =
    useRef(null);

  const [
    isHoveringVideo,
    setIsHoveringVideo,
  ] = useState(false);

  // --------------------------------------------------------------------
  // SANITY PROJECT STATE
  // --------------------------------------------------------------------

  const [
    selectedWorks,
    setSelectedWorks,
  ] = useState([]);

  const [
    totalWorks,
    setTotalWorks,
  ] = useState(0);

  const [
    isLoadingWorks,
    setIsLoadingWorks,
  ] = useState(true);

  // --------------------------------------------------------------------
  // SANITY ABOUT CONTENT STATE
  // --------------------------------------------------------------------

  const [
    aboutContent,
    setAboutContent,
  ] = useState(null);

  // --------------------------------------------------------------------
  // FETCH SELECTED WORKS + TOTAL WORK COUNT + ABOUT CONTENT
  // --------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function fetchWorks() {
      try {
        setIsLoadingWorks(true);

        const [
          selectedData,
          totalCount,
          aboutData,
        ] = await Promise.all([
          client.fetch(
            SELECTED_WORKS_QUERY,
            {},
            {
              next: {
                revalidate: 60,
              },
            }
          ),

          client.fetch(
            TOTAL_WORKS_COUNT_QUERY,
            {},
            {
              next: {
                revalidate: 60,
              },
            }
          ),

          client.fetch(
            ABOUT_CONTENT_QUERY,
            {},
            {
              next: {
                revalidate: 60,
              },
            }
          ),
        ]);

        if (cancelled) {
          return;
        }

        // --------------------------------------------------------------
        // ABOUT CONTENT
        // --------------------------------------------------------------

        setAboutContent(
          aboutData || null
        );

        // --------------------------------------------------------------
        // NORMALIZE ONLY THE 5 SHOWCASED PROJECTS
        // --------------------------------------------------------------

        const normalized =
          Array.isArray(selectedData)
            ? selectedData
                .map(
                  (
                    project,
                    index
                  ) =>
                    normalizeProject(
                      project,
                      index
                    )
                )
                .filter(Boolean)
            : [];

        // --------------------------------------------------------------
        // SHUFFLE THE 5 SELECTED PROJECTS
        // --------------------------------------------------------------

        for (
          let i =
            normalized.length - 1;
          i > 0;
          i--
        ) {
          const j =
            Math.floor(
              Math.random() *
                (i + 1)
            );

          [
            normalized[i],
            normalized[j],
          ] = [
            normalized[j],
            normalized[i],
          ];
        }

        setSelectedWorks(
          normalized
        );

        // --------------------------------------------------------------
        // TOTAL CMS PROJECT COUNT
        // --------------------------------------------------------------

        setTotalWorks(
          typeof totalCount ===
            "number"
            ? totalCount
            : 0
        );
      } catch (error) {
        console.error(
          "Failed to fetch works from Sanity:",
          error
        );

        if (!cancelled) {
          setSelectedWorks([]);
          setTotalWorks(0);
          setAboutContent(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWorks(false);
        }
      }
    }

    fetchWorks();

    return () => {
      cancelled = true;
    };
  }, []);

  // --------------------------------------------------------------------
  // REFRESH SCROLLTRIGGER WHEN CMS CONTENT ARRIVES
  // --------------------------------------------------------------------

  useEffect(() => {
    const timer =
      setTimeout(() => {
        ScrollTrigger.refresh();
      }, 150);

    return () =>
      clearTimeout(timer);
  }, [selectedWorks]);

  // --------------------------------------------------------------------
  // GSAP CUSTOM CURSOR TRACKER
  // --------------------------------------------------------------------

  useEffect(() => {
    const cursor =
      cursorRef.current;

    if (!cursor) {
      return;
    }

    const ctx =
      gsap.context(() => {
        gsap.set(cursor, {
          xPercent: -50,

          yPercent: -50,
        });

        const xTo =
          gsap.quickTo(
            cursor,
            "x",
            {
              duration: 0.2,

              ease: "power3",
            }
          );

        const yTo =
          gsap.quickTo(
            cursor,
            "y",
            {
              duration: 0.2,

              ease: "power3",
            }
          );

        const moveCursor =
          (e) => {
            xTo(e.clientX);

            yTo(e.clientY);
          };

        window.addEventListener(
          "mousemove",
          moveCursor
        );

        return () => {
          window.removeEventListener(
            "mousemove",
            moveCursor
          );
        };
      });

    return () =>
      ctx.revert();
  }, []);

  // --------------------------------------------------------------------
  // GSAP CURSOR SCALE STATE
  // --------------------------------------------------------------------

  useEffect(() => {
    const cursor =
      cursorRef.current;

    if (!cursor) {
      return;
    }

    gsap.to(cursor, {
      scale:
        isHoveringVideo
          ? 1
          : 0,

      opacity:
        isHoveringVideo
          ? 1
          : 0,

      duration:
        isHoveringVideo
          ? 0.25
          : 0.2,

      ease:
        isHoveringVideo
          ? "power2.out"
          : "power2.in",
    });
  }, [isHoveringVideo]);

  const handleHoverChange =
    useCallback(
      (isHovered) => {
        setIsHoveringVideo(
          isHovered
        );
      },
      []
    );

  // --------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------

  return (
    <div className="bg-black w-full min-h-screen py-6 px-4 md:px-6 flex flex-col space-y-16 lg:space-y-32 relative overflow-x-hidden">

      {/* CUSTOM CURSOR */}

      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-50 hidden md:block scale-0 opacity-0 mix-blend-difference text-white"
      >
        <span className="font-geist-mono text-xl font-medium tracking-tight">
          [ CLICK ]
        </span>
      </div>

      {/* FOREGROUND CONTENT */}

      <div className="relative z-10 flex flex-col space-y-16 lg:space-y-28 w-full">

        {/* NAV */}

        <div className="flex flex-row items-center justify-between w-full text-lavender">

          <div className="font-mono tracking-tight text-[clamp(0.625rem,1vw,0.75rem)] flex items-center gap-2">

            <div className="w-2 h-2 bg-ghost-white" />

            <h1>
              OUR IDENTITY
            </h1>

          </div>

          <h1 className="font-geist-mono font-medium tracking-tight text-[clamp(0.5rem,0.8vw,0.725rem)] text-ghost-white">
            [CLOUD_1]
          </h1>

        </div>

        {/* INTRO SECTION */}

        <div className="flex flex-col lg:flex-row items-start justify-between w-full text-ghost-white gap-12 lg:gap-8">

          <h1 className="font-geist-mono md:tracking-tight text-[clamp(0.55rem,1vw,0.775rem)] w-[43%] md:w-[15%] text-zinc-400 font-medium uppercase">
            Turning exceptional work into lasting impressions.
          </h1>

          <div className="flex flex-col items-start justify-end space-y-8 lg:space-y-12 w-full md:w-[50%] md:translate-x-[clamp(0rem,8vw,2rem)] lg:translate-x-[clamp(0rem,10vw,0.5rem)] font-medium">

            <SmudgyTextReveal
              text={
                aboutContent?.briefIntroText ||
                ""
              }
            />

            <BlurFlicker>
              <Button
                text="Meet Cloudhaus"
                href="/About"
              />
            </BlurFlicker>

          </div>

        </div>

        {/* HEADER & WORKS */}

        <div className="flex flex-col space-y-6 pt-14 md:pt-8 lg:pt-20">

          <div className="flex flex-row items-center justify-between w-full text-zinc-300">

            <div className="font-geist-mono font-medium tracking-tight text-[clamp(0.5rem,0.8vw,0.625rem)] flex items-center gap-2">

              <div className="w-2 h-2 bg-zinc-300" />

              <h1>
                SELECTED WORKS
              </h1>

            </div>

            <h1 className="font-geist-mono font-medium tracking-tight text-ghost-white text-[clamp(0.5rem,0.8vw,0.725rem)]">
              [CLOUD_2]
            </h1>

          </div>

          {/* WORKS HEADER ROW */}

          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between w-full text-ghost-white gap-4 sm:gap-0">

            <div className="flex flex-row items-start gap-4 sm:gap-6 font-monot">

              <h1 className="text-[clamp(5rem,15vw,18.875rem)] tracking-[-8%] font-light leading-none uppercase">
                Works
              </h1>

              <sup className="text-[clamp(1rem,2vw,1.875rem)] pt-1 sm:pt-6 leading-none font-sans font-medium tracking-tight">
                [
                {totalWorks < 10
                  ? `0${totalWorks}`
                  : totalWorks}
                ]
              </sup>

            </div>

            <div className="flex flex-col items-start sm:items-end justify-end sm:self-end w-full sm:w-auto">

              <BlurFlicker>
                <Button
                  text="VIEW ALL WORKS"
                  href="/All-Works"
                />
              </BlurFlicker>

            </div>

          </div>

          {/* WORKS GRID */}

          <div className="flex flex-col space-y-8 lg:space-y-58 pt-6">

            {/* LOADING */}

            {isLoadingWorks && (
              <div className="min-h-[17.5rem] lg:min-h-[30rem] flex items-center justify-center">

                <span className="font-geist-mono text-[10px] uppercase tracking-widest text-zinc-700">
                </span>

              </div>
            )}

            {/* ---------------------------------------------------------
                ROW 1
                SHOWCASED CMS WORK #1 + #2
            --------------------------------------------------------- */}

            {!isLoadingWorks &&
              selectedWorks.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 w-full gap-8 lg:gap-0 text-lavender">

                  {selectedWorks[0] && (
                    <WorkCard
                      video={
                        selectedWorks[0]
                      }
                      heightClassName="w-screen -ml-4 lg:ml-0 lg:w-full aspect-video"
                      onHoverChange={
                        handleHoverChange
                      }
                    />
                  )}

                  {selectedWorks[1] && (
                    <WorkCard
                      video={
                        selectedWorks[1]
                      }
                      heightClassName="w-screen -ml-4 lg:ml-0 lg:w-full aspect-video"
                      onHoverChange={
                        handleHoverChange
                      }
                    />
                  )}

                </div>
              )}

            {/* ---------------------------------------------------------
                ROW 2
                SHOWCASED CMS WORK #3
            --------------------------------------------------------- */}

            {!isLoadingWorks &&
              selectedWorks[2] && (
                <WorkCard
                  video={
                    selectedWorks[2]
                  }
                  heightClassName="w-screen left-1/2 -translate-x-1/2 h-[60vh] lg:h-screen"
                  onHoverChange={
                    handleHoverChange
                  }
                />
              )}

            {/* ---------------------------------------------------------
                ROW 3
                SHOWCASED CMS WORK #4 + #5
            --------------------------------------------------------- */}

            {!isLoadingWorks &&
              selectedWorks.length > 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 w-full gap-8 lg:gap-12 text-lavender pb-12 lg:pb-24 items-start">

                  {selectedWorks[3] && (
                    <WorkCard
                      video={
                        selectedWorks[3]
                      }
                      heightClassName="w-screen -ml-4 lg:ml-0 md:aspect-video h-[50vh] md:w-full"
                      onHoverChange={
                        handleHoverChange
                      }
                    />
                  )}

                  {selectedWorks[4] && (
                    <WorkCard
                      video={
                        selectedWorks[4]
                      }
                      containerClassName="lg:translate-y-24"
                      heightClassName="w-screen -ml-4 lg:ml-0 lg:w-full aspect-video"
                      onHoverChange={
                        handleHoverChange
                      }
                    />
                  )}

                </div>
              )}

            {/* EMPTY CMS STATE */}

            {!isLoadingWorks &&
              selectedWorks.length === 0 && (
                <div className="py-24 flex items-center justify-center">

                  <span className="font-geist-mono text-[10px] uppercase tracking-widest text-zinc-700">
                    No Works Found
                  </span>

                </div>
              )}

          </div>

        </div>

      </div>

      <ServicesSection />

      <Testimonials />

      {/* STICKY FOOTER WRAPPER */}

      <div
        ref={footerContainerRef}
        className="relative w-full"
      >

        <div className="relative z-10 bg-carbon-black">
          <ClientsSection />
        </div>

        <div className="sticky bottom-0 w-full z-0 overflow-hidden">
          <Footer />
        </div>

      </div>

    </div>
  );
}