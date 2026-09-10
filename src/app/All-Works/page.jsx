"use client"
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
// BUNNY POSTER URL
// ----------------------------------------------------------------------

function getBunnyPosterUrl(hlsUrl) {
  if (
    typeof hlsUrl !== "string" ||
    !hlsUrl.trim()
  ) {
    return null;
  }

  if (
    hlsUrl.includes("playlist.m3u8")
  ) {
    return hlsUrl.replace(
      "playlist.m3u8",
      "thumbnail.jpg"
    );
  }

  const lastSlash =
    hlsUrl.lastIndexOf("/");

  if (lastSlash === -1) {
    return null;
  }

  return `${hlsUrl.slice(
    0,
    lastSlash
  )}/thumbnail.jpg`;
}

// ----------------------------------------------------------------------
// HLS CONCURRENCY QUEUE
// ----------------------------------------------------------------------

const MAX_CONCURRENT_HLS = 4;

let activeHlsCount = 0;

const hlsQueue = [];

function scheduleHlsLoad(
  task,
  isPriority = false
) {
  const run = () => {
    activeHlsCount++;

    Promise.resolve()
      .then(task)
      .finally(() => {
        activeHlsCount--;

        if (hlsQueue.length) {
          const next =
            hlsQueue.shift();

          next();
        }
      });
  };

  if (
    isPriority ||
    activeHlsCount <
      MAX_CONCURRENT_HLS
  ) {
    run();
  } else {
    hlsQueue.push(run);
  }
}

// ----------------------------------------------------------------------
// HLS VIDEO ATTACHMENT
// ----------------------------------------------------------------------
//
// Desktop browsers use hls.js for .m3u8 playback. The important fixes here
// are:
//   - do not start playback on HAVE_CURRENT_DATA only
//   - give hls.js a much healthier forward buffer
//   - explicitly recover network/media errors
//   - retry playback only when data is actually available
//   - ignore stale HLS instances after a source changes
//
// The visual/UI behaviour is unchanged.
// ----------------------------------------------------------------------

function useHlsVideo(
  videoRef,
  source,
  isPriority = false
) {
  const hlsRef = useRef(null);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !source) {
      return;
    }

    let cancelled = false;

    const clearRetryTimer = () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const cleanupMedia = () => {
      clearRetryTimer();

      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (_) {}
        hlsRef.current = null;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    cleanupMedia();

    // --------------------------------------------------
    // SAFARI / NATIVE HLS
    // --------------------------------------------------

    if (
      video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
    ) {
      video.src = source;
      video.load();

      const tryPlayWhenReady = () => {
        if (cancelled) {
          return;
        }

        if (
          video.readyState >= 3 &&
          !video.ended
        ) {
          video.play().catch(() => {});
        }
      };

      video.addEventListener(
        "canplay",
        tryPlayWhenReady
      );

      video.addEventListener(
        "canplaying",
        tryPlayWhenReady
      );

      return () => {
        cancelled = true;

        video.removeEventListener(
          "canplay",
          tryPlayWhenReady
        );

        video.removeEventListener(
          "canplaying",
          tryPlayWhenReady
        );

        cleanupMedia();
      };
    }

    // --------------------------------------------------
    // HLS.JS
    // --------------------------------------------------

    if (!Hls.isSupported()) {
      return () => {
        cancelled = true;
        cleanupMedia();
      };
    }

    let localHls = null;

    scheduleHlsLoad(
      () => {
        if (cancelled) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          if (cancelled) {
            resolve();
            return;
          }

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,

            // Keep enough data ahead of the playhead so desktop
            // playback does not immediately run into the next fragment.
            backBufferLength: 60,
            maxBufferLength: 60,
            maxMaxBufferLength: 120,

            // Avoid starting at an unnecessarily high rendition.
            startLevel: 0,
            capLevelToPlayerSize: true,

            // Be conservative around tiny gaps and transient stalls.
            maxBufferHole: 0.5,
            highBufferWatchdogPeriod: 2,

            // Give fragment loading a few chances before declaring
            // the stream unavailable.
            fragLoadingMaxRetry: 6,
            fragLoadingRetryDelay: 500,
            fragLoadingMaxRetryTimeout: 8000,

            // Media element recovery.
            nudgeOffset: 0.1,
            nudgeMaxRetry: 5,
          });

          localHls = hls;
          hlsRef.current = hls;

          let settled = false;

          const finish = () => {
            if (settled) {
              return;
            }

            settled = true;
            resolve();
          };

          const tryPlay = () => {
            if (
              cancelled ||
              hlsRef.current !== hls
            ) {
              return;
            }

            // HAVE_FUTURE_DATA. Starting at >= 3 is important:
            // HAVE_CURRENT_DATA can be only one frame / one tiny
            // fragment ahead, which is exactly how the desktop
            // 3-second stop was being produced.
            if (
              video.readyState >= 3 &&
              video.buffered.length > 0 &&
              !video.ended
            ) {
              video.play().catch(() => {});
            }
          };

          const scheduleRetry = () => {
            if (
              cancelled ||
              hlsRef.current !== hls
            ) {
              return;
            }

            clearRetryTimer();

            retryTimerRef.current =
              window.setTimeout(() => {
                retryTimerRef.current = null;
                tryPlay();
              }, 250);
          };

          hls.on(
            Hls.Events.MANIFEST_PARSED,
            () => {
              finish();
              scheduleRetry();
            }
          );

          hls.on(
            Hls.Events.FRAG_BUFFERED,
            () => {
              tryPlay();
            }
          );

          hls.on(
            Hls.Events.BUFFER_APPENDED,
            () => {
              if (video.paused) {
                tryPlay();
              }
            }
          );

          hls.on(
            Hls.Events.ERROR,
            (_, data) => {
              if (
                !data?.fatal ||
                cancelled ||
                hlsRef.current !== hls
              ) {
                return;
              }

              if (
                data.type ===
                Hls.ErrorTypes.NETWORK_ERROR
              ) {
                // Keep the same player alive and resume loading.
                hls.startLoad();
                scheduleRetry();
                return;
              }

              if (
                data.type ===
                Hls.ErrorTypes.MEDIA_ERROR
              ) {
                hls.recoverMediaError();
                scheduleRetry();
                return;
              }

              finish();
            }
          );

          const onCanPlay = () => {
            tryPlay();
          };

          const onWaiting = () => {
            scheduleRetry();
          };

          video.addEventListener(
            "canplay",
            onCanPlay
          );

          video.addEventListener(
            "canplaying",
            onCanPlay
          );

          video.addEventListener(
            "waiting",
            onWaiting
          );

          hls.attachMedia(video);
          hls.loadSource(source);

          // Keep these listeners tied to this exact HLS instance.
          const originalDestroy = hls.destroy.bind(hls);

          hls.destroy = (...args) => {
            video.removeEventListener(
              "canplay",
              onCanPlay
            );

            video.removeEventListener(
              "canplaying",
              onCanPlay
            );

            video.removeEventListener(
              "waiting",
              onWaiting
            );

            clearRetryTimer();

            originalDestroy(...args);
          };

          tryPlay();
        });
      },
      isPriority
    );

    return () => {
      cancelled = true;
      clearRetryTimer();

      if (
        hlsRef.current === localHls ||
        localHls === null
      ) {
        if (hlsRef.current) {
          try {
            hlsRef.current.destroy();
          } catch (_) {}
          hlsRef.current = null;
        }
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [
    videoRef,
    source,
    isPriority,
  ]);
}

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

  const [videoReady, setVideoReady] =
    useState(false);

  const containerRef =
    useRef(null);

  const buttonRef =
    useRef(null);

  const videoRef =
    useRef(null);

  const isHoveredRef =
    useRef(false);

  const didSeekRef =
    useRef(false);

  const intentionalPauseRef =
    useRef(false);

  const mobileVideoHeight =
    useMemo(
      () =>
        getMobileVideoHeight(
          video
        ),
      [video]
    );

  const rawUrl = useMemo(
    () =>
      getHeroVideoUrl(video),
    [video]
  );

  const posterUrl = useMemo(
    () =>
      getBunnyPosterUrl(
        rawUrl
      ),
    [rawUrl]
  );

  // --------------------------------------------------
  // RESET VIDEO STATE WHEN PROJECT CHANGES
  // --------------------------------------------------

  useEffect(() => {
    setHasVideoError(false);
    setVideoUrl(null);
    setVideoReady(false);
    setCurrentTime("00:00");
    didSeekRef.current = false;
  }, [rawUrl]);

  // --------------------------------------------------
  // HLS PLAYBACK
  // --------------------------------------------------

  useHlsVideo(
    videoRef,
    videoUrl,
    priority
  );

  // Only the intentionally prioritized cards preload.
  // Non-priority cards wait until hover, preventing a page full
  // of desktop HLS players from competing for bandwidth.
  useEffect(() => {
    if (!priority || !rawUrl || videoUrl) {
      return;
    }

    setVideoUrl(rawUrl);
  }, [
    priority,
    rawUrl,
    videoUrl,
  ]);

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
        setVideoReady(false);
        didSeekRef.current = false;

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
  // VIDEO ERROR FALLBACK
  // --------------------------------------------------

  const handleVideoError =
    useCallback(() => {
      if (!rawUrl) {
        return;
      }

      setHasVideoError(true);
      setVideoReady(false);
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
        didSeekRef.current = true;

        videoEl.currentTime =
          Math.random() *
          videoEl.duration;
      } else {
        didSeekRef.current = false;
      }
    };

  // --------------------------------------------------
  // REVEAL VIDEO
  // --------------------------------------------------

  const revealVideo =
    useCallback(() => {
      const videoEl =
        videoRef.current;

      if (!videoEl) {
        return;
      }

      requestAnimationFrame(
        () => {
          requestAnimationFrame(
            () => {
              setVideoReady(true);

              if (
                isHoveredRef.current
              ) {
                videoEl
                  .play()
                  .catch(
                    () => {}
                  );
              }
            }
          );
        }
      );
    }, []);

  // --------------------------------------------------
  // VIDEO READY
  // --------------------------------------------------

  const handleVideoReady =
    useCallback(() => {
      if (didSeekRef.current) {
        return;
      }

      revealVideo();
    }, [revealVideo]);

  // --------------------------------------------------
  // SEEK COMPLETE
  // --------------------------------------------------

  const handleSeeked =
    useCallback(() => {
      if (!didSeekRef.current) {
        return;
      }

      didSeekRef.current = false;

      revealVideo();
    }, [revealVideo]);

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
  // SELF-HEALING PAUSE
  // --------------------------------------------------

  const handleVideoPause =
    useCallback(() => {
      if (
        intentionalPauseRef.current ||
        !isHoveredRef.current
      ) {
        return;
      }

      const videoEl =
        videoRef.current;

      if (!videoEl) {
        return;
      }

      if (videoEl.readyState >= 3) {
        videoEl.play().catch(() => {});
      }
    }, []);

  // --------------------------------------------------
  // HOVER ENTER
  // --------------------------------------------------

  const handleMouseEnter =
    async () => {
      isHoveredRef.current =
        true;

      intentionalPauseRef.current =
        false;

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

      if (
        videoRef.current &&
        videoReady
      ) {
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
      isHoveredRef.current =
        false;

      intentionalPauseRef.current =
        true;

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
        {/* BUNNY POSTER */}

        {posterUrl && (
          <img
            src={posterUrl}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority={
              priority
                ? "high"
                : "auto"
            }
            className={`
              absolute
              inset-0
              w-full
              h-full
              object-cover
              brightness-90
              contrast-105
              transition-opacity
              duration-700
              ease-out
              pointer-events-none
              ${
                videoReady
                  ? "opacity-0"
                  : "opacity-100"
              }
            `}
          />
        )}

        {/* HLS VIDEO */}

        {videoUrl ? (
          <video
            ref={videoRef}
            loop
            muted
            playsInline
            preload="auto"
            fetchPriority={
              priority
                ? "high"
                : "auto"
            }
            onError={
              handleVideoError
            }
            onLoadedMetadata={
              handleLoadedMetadata
            }
            onLoadedData={
              handleVideoReady
            }
            onSeeked={
              handleSeeked
            }
            onTimeUpdate={
              handleTimeUpdate
            }
            onWaiting={
              handleVideoPause
            }
            onStalled={
              handleVideoPause
            }
            onPause={
              handleVideoPause
            }
            className={`
              absolute
              inset-0
              w-full
              h-full
              object-cover
              brightness-90
              contrast-105
              transition-opacity
              duration-700
              ease-out
              ${
                videoReady
                  ? "opacity-100"
                  : "opacity-0"
              }
            `}
          />
        ) : (
          !posterUrl && (
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
          )
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

  // --------------------------------------------------
  // PERSISTENT BACKGROUND VIDEO
  // --------------------------------------------------

  const bgVideoRef =
    useRef(null);

  const bgHlsRef =
    useRef(null);

  const bgSourceRef =
    useRef(null);

  const bgProjectIdRef =
    useRef(null);

  const bgPlayRequestedRef =
    useRef(false);

  const bgIntentionalPauseRef =
    useRef(false);

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

  // --------------------------------------------------
  // HOVER CAPABILITY
  // --------------------------------------------------

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

          bgIntentionalPauseRef.current =
            true;

          if (
            bgVideoRef.current
          ) {
            bgVideoRef.current.pause();
          }

          if (
            bgHlsRef.current
          ) {
            bgHlsRef.current.destroy();
            bgHlsRef.current = null;
          }

          bgSourceRef.current =
            null;

          bgProjectIdRef.current =
            null;

          bgPlayRequestedRef.current =
            false;
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

  // --------------------------------------------------
  // FETCH PROJECTS
  // --------------------------------------------------

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

  // --------------------------------------------------
  // CLIENT FILTERS
  // --------------------------------------------------

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

  // --------------------------------------------------
  // FILTERED PROJECTS
  // --------------------------------------------------

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

  // --------------------------------------------------
  // ACTIVE PROJECTS
  // --------------------------------------------------

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

  // --------------------------------------------------
  // GRID REVEAL
  // --------------------------------------------------

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

  // --------------------------------------------------
  // VIEW TOGGLE
  // --------------------------------------------------

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

  // --------------------------------------------------
  // CLIENT FILTER
  // --------------------------------------------------

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

  // --------------------------------------------------
  // LOAD MORE
  // --------------------------------------------------

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

  // --------------------------------------------------
  // REFRESH SCROLLTRIGGER
  // --------------------------------------------------

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

  // --------------------------------------------------
  // UPDATE DISPLAY PROJECT
  // --------------------------------------------------

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

  // ------------------------------------------------------------------
  // PERSISTENT LIST BACKGROUND VIDEO
  // ------------------------------------------------------------------

  useEffect(() => {
    if (
      viewMode !== "list" ||
      !canHover
    ) {
      return;
    }

    const video =
      bgVideoRef.current;

    if (!video) {
      return;
    }

    const source =
      getHeroVideoUrl(displayProject);

    const projectId =
      displayProject?._id ||
      null;

    let cancelled = false;
    let retryTimer = null;
    let localHls = null;

    const clearRetry = () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const tryPlay = () => {
      if (
        cancelled ||
        !bgPlayRequestedRef.current
      ) {
        return;
      }

      if (
        video.readyState >= 3 &&
        video.buffered.length > 0 &&
        !video.ended
      ) {
        video.play().catch(() => {});
      }
    };

    const scheduleRetry = (delay = 250) => {
      if (cancelled) {
        return;
      }

      clearRetry();

      retryTimer =
        window.setTimeout(() => {
          retryTimer = null;
          tryPlay();
        }, delay);
    };

    // --------------------------------------------------
    // NOTHING TO PLAY
    // --------------------------------------------------

    if (!source) {
      bgPlayRequestedRef.current = false;

      if (bgHlsRef.current) {
        try {
          bgHlsRef.current.destroy();
        } catch (_) {}
        bgHlsRef.current = null;
      }

      bgSourceRef.current = null;
      bgProjectIdRef.current = null;

      video.pause();
      video.removeAttribute("src");
      video.load();

      return () => {
        cancelled = true;
        clearRetry();
      };
    }

    // --------------------------------------------------
    // SAME PROJECT
    // --------------------------------------------------

    if (
      bgSourceRef.current === source &&
      bgProjectIdRef.current === projectId
    ) {
      bgIntentionalPauseRef.current = false;
      bgPlayRequestedRef.current = true;

      tryPlay();
      scheduleRetry(100);

      return () => {
        cancelled = true;
        clearRetry();
      };
    }

    // --------------------------------------------------
    // NEW PROJECT
    // --------------------------------------------------

    bgSourceRef.current = source;
    bgProjectIdRef.current = projectId;

    bgIntentionalPauseRef.current = false;
    bgPlayRequestedRef.current = true;

    if (bgHlsRef.current) {
      try {
        bgHlsRef.current.destroy();
      } catch (_) {}
      bgHlsRef.current = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();

    // --------------------------------------------------
    // SAFARI / NATIVE HLS
    // --------------------------------------------------

    if (
      video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
    ) {
      video.src = source;
      video.load();

      const onReady = () => {
        tryPlay();
      };

      const onWaiting = () => {
        scheduleRetry(350);
      };

      video.addEventListener(
        "canplay",
        onReady
      );

      video.addEventListener(
        "canplaying",
        onReady
      );

      video.addEventListener(
        "waiting",
        onWaiting
      );

      tryPlay();

      return () => {
        cancelled = true;
        clearRetry();

        video.removeEventListener(
          "canplay",
          onReady
        );

        video.removeEventListener(
          "canplaying",
          onReady
        );

        video.removeEventListener(
          "waiting",
          onWaiting
        );
      };
    }

    // --------------------------------------------------
    // HLS.JS
    // --------------------------------------------------

    if (!Hls.isSupported()) {
      return () => {
        cancelled = true;
        clearRetry();
      };
    }

    const hls =
      new Hls({
        enableWorker: true,
        lowLatencyMode: false,

        backBufferLength: 60,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,

        capLevelToPlayerSize: true,
        startLevel: 0,

        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,

        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 8000,

        nudgeOffset: 0.1,
        nudgeMaxRetry: 5,
      });

    localHls = hls;
    bgHlsRef.current = hls;

    const onManifestParsed = () => {
      scheduleRetry(150);
    };

    const onFragBuffered = () => {
      tryPlay();
    };

    const onBufferAppended = () => {
      if (
        video.paused &&
        bgPlayRequestedRef.current
      ) {
        tryPlay();
      }
    };

    const onError = (_, data) => {
      if (
        !data?.fatal ||
        cancelled ||
        bgHlsRef.current !== hls
      ) {
        return;
      }

      if (
        data.type ===
        Hls.ErrorTypes.NETWORK_ERROR
      ) {
        hls.startLoad();
        scheduleRetry(500);
        return;
      }

      if (
        data.type ===
        Hls.ErrorTypes.MEDIA_ERROR
      ) {
        hls.recoverMediaError();
        scheduleRetry(500);
        return;
      }
    };

    const onCanPlay = () => {
      tryPlay();
    };

    const onWaiting = () => {
      scheduleRetry(350);
    };

    hls.on(
      Hls.Events.MANIFEST_PARSED,
      onManifestParsed
    );

    hls.on(
      Hls.Events.FRAG_BUFFERED,
      onFragBuffered
    );

    hls.on(
      Hls.Events.BUFFER_APPENDED,
      onBufferAppended
    );

    hls.on(
      Hls.Events.ERROR,
      onError
    );

    video.addEventListener(
      "canplay",
      onCanPlay
    );

    video.addEventListener(
      "canplaying",
      onCanPlay
    );

    video.addEventListener(
      "waiting",
      onWaiting
    );

    hls.attachMedia(video);
    hls.loadSource(source);

    return () => {
      cancelled = true;
      clearRetry();

      video.removeEventListener(
        "canplay",
        onCanPlay
      );

      video.removeEventListener(
        "canplaying",
        onCanPlay
      );

      video.removeEventListener(
        "waiting",
        onWaiting
      );

      if (
        bgHlsRef.current === localHls
      ) {
        try {
          hls.destroy();
        } catch (_) {}

        bgHlsRef.current = null;
      }
    };
  }, [
    displayProject,
    viewMode,
    canHover,
  ]);

  // ------------------------------------------------------------------
  // BACKGROUND VIDEO SELF-HEALING PAUSE
  // ------------------------------------------------------------------

  const handleBgVideoPause =
    useCallback(() => {
      if (
        bgIntentionalPauseRef.current
      ) {
        return;
      }

      if (
        !bgPlayRequestedRef.current
      ) {
        return;
      }

      const video =
        bgVideoRef.current;

      if (!video) {
        return;
      }

      video
        .play()
        .catch(() => {});
    }, []);

  // ------------------------------------------------------------------
  // BACKGROUND VIDEO STALL RECOVERY
  // ------------------------------------------------------------------

  useEffect(() => {
    const video =
      bgVideoRef.current;

    if (!video) {
      return;
    }

    const handleWaiting =
      () => {
        if (
          viewMode !== "list" ||
          !canHover ||
          !hoveredProject
        ) {
          return;
        }

        const retry =
          () => {
            if (
              !video.paused &&
              video.readyState >=
                3
            ) {
              return;
            }

            if (
              bgPlayRequestedRef.current
            ) {
              video
                .play()
                .catch(() => {});
            }
          };

        setTimeout(
          retry,
          80
        );
      };

    const handleStalled =
      () => {
        if (
          viewMode !== "list" ||
          !canHover ||
          !hoveredProject
        ) {
          return;
        }

        if (
          bgPlayRequestedRef.current
        ) {
          setTimeout(
            () => {
              video
                .play()
                .catch(() => {});
            },
            100
          );
        }
      };

    video.addEventListener(
      "waiting",
      handleWaiting
    );

    video.addEventListener(
      "stalled",
      handleStalled
    );

    return () => {
      video.removeEventListener(
        "waiting",
        handleWaiting
      );

      video.removeEventListener(
        "stalled",
        handleStalled
      );
    };
  }, [
    viewMode,
    canHover,
    hoveredProject,
  ]);

  // ------------------------------------------------------------------
  // LENIS
  // ------------------------------------------------------------------

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

  // ------------------------------------------------------------------
  // CLEAN UP BACKGROUND PLAYER ON UNMOUNT
  // ------------------------------------------------------------------

  useEffect(() => {
    return () => {
      bgIntentionalPauseRef.current =
        true;

      bgPlayRequestedRef.current =
        false;

      if (
        bgHlsRef.current
      ) {
        bgHlsRef.current.destroy();
        bgHlsRef.current = null;
      }

      if (
        bgVideoRef.current
      ) {
        bgVideoRef.current.pause();

        bgVideoRef.current.removeAttribute(
          "src"
        );

        bgVideoRef.current.load();
      }

      bgSourceRef.current =
        null;

      bgProjectIdRef.current =
        null;
    };
  }, []);

  // ------------------------------------------------------------------
  // LIST REVEAL
  // ------------------------------------------------------------------

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

  if (isLoading) {
    return (
      <div className="bg-black w-full min-h-screen flex items-center justify-center">
        <span className="font-geist-mono text-xs text-zinc-500 uppercase tracking-widest" />
      </div>
    );
  }

  return (
    <div className="bg-black w-full min-h-screen px-4 py-6 md:px-4 md:pt-22 relative overflow-x-hidden">

      {/* --------------------------------------------------------------
          PERSISTENT BACKGROUND VIDEO

          IMPORTANT:
          There is only ONE video element.

          It does NOT have a React key tied to the project.
          The HLS source changes inside the same element.
         -------------------------------------------------------------- */}

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
          <video
            ref={bgVideoRef}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            onPause={
              handleBgVideoPause
            }
            className="
              absolute
              inset-0
              w-full
              h-full
              object-cover
            "
          />

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
                        project
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
                            } else {
                              setHoveredProject(
                                null
                              );
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
                      } else {
                        setHoveredProject(
                          null
                        );
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
                        } else {
                          setHoveredProject(
                            null
                          );
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
                          } else {
                            setHoveredProject(
                              null
                            );
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
                      } else {
                        setHoveredProject(
                          null
                        );
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
                        } else {
                          setHoveredProject(
                            null
                          );
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
                            } else {
                              setHoveredProject(
                                null
                              );
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
                            } else {
                              setHoveredProject(
                                null
                              );
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
                            } else {
                              setHoveredProject(
                                null
                              );
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