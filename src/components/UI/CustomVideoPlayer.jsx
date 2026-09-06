"use client";

import React, {
useEffect,
useRef,
useState,
useCallback,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// =========================================================
// HELPER
// =========================================================

const formatTime = (seconds) => {
if (!Number.isFinite(seconds)) return "00:00";

const mins = Math.floor(seconds / 60);
const secs = Math.floor(seconds % 60);

return `${String(mins).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}`;
};

// =========================================================
// CUSTOM VIDEO PLAYER
// =========================================================

export default function CustomVideoPlayer({
src,
title = "",
isOpen,
onClose,
}) {
const overlayRef = useRef(null);
const playerRef = useRef(null);
const videoRef = useRef(null);
const progressRef = useRef(null);

// Video preload reference
const preloadVideoRef = useRef(null);

// Progress RAF reference
const progressFrameRef = useRef(null);

// Active GSAP timeline
const animationRef = useRef(null);

const [isPlaying, setIsPlaying] = useState(false);
const [isMuted, setIsMuted] = useState(false);
const [currentTime, setCurrentTime] = useState(0);
const [duration, setDuration] = useState(0);
const [isHovering, setIsHovering] = useState(false);

// =========================================================
// PRELOAD VIDEO
// =========================================================

useEffect(() => {
if (!src) return;


// Clean up previous preload
if (preloadVideoRef.current) {
  const previousVideo = preloadVideoRef.current;

  previousVideo.pause();
  previousVideo.removeAttribute("src");
  previousVideo.load();

  preloadVideoRef.current = null;
}

const preloadVideo = document.createElement("video");

preloadVideo.preload = "metadata";
preloadVideo.muted = true;
preloadVideo.playsInline = true;
preloadVideo.src = src;

preloadVideo.load();

preloadVideoRef.current = preloadVideo;

return () => {
  if (preloadVideoRef.current === preloadVideo) {
    preloadVideo.pause();
    preloadVideo.removeAttribute("src");
    preloadVideo.load();

    preloadVideoRef.current = null;
  }
};


}, [src]);

// =========================================================
// OPEN ANIMATION
// =========================================================

useGSAP(
() => {
if (!isOpen) return;


  const overlay = overlayRef.current;
  const player = playerRef.current;
  const video = videoRef.current;

  if (!overlay || !player) return;

  document.body.style.overflow = "hidden";

  // -----------------------------------------------------
  // GRAB INNER ELEMENTS FOR A STAGGERED CHROME REVEAL
  // Structure:
  // video, topGradient, topBar, bottomGradient, controls
  // -----------------------------------------------------

  const topGradient = player.children[1];
  const topBar = player.children[2];
  const bottomGradient = player.children[3];
  const controls = player.children[4];

  // -----------------------------------------------------
  // INITIAL STATE
  // -----------------------------------------------------

  gsap.set(overlay, {
    opacity: 0,
    filter: "brightness(3)",
  });

  gsap.set(player, {
    opacity: 0,
    scale: 0.72,
    y: 70,
    rotationX: -18,
    transformPerspective: 1400,
    transformOrigin: "50% 50%",
    filter: "blur(30px)",
    clipPath: "inset(50% 0% 50% 0%)",
    force3D: true,
  });

  if (topGradient) {
    gsap.set(topGradient, {
      scaleY: 0,
      transformOrigin: "top",
    });
  }

  if (bottomGradient) {
    gsap.set(bottomGradient, {
      scaleY: 0,
      transformOrigin: "bottom",
    });
  }

  if (topBar) {
    gsap.set(topBar, {
      opacity: 0,
      y: -24,
    });
  }

  if (controls) {
    gsap.set(controls, {
      opacity: 0,
      y: 28,
    });
  }

  // -----------------------------------------------------
  // DRAMATIC REVEAL TIMELINE
  // -----------------------------------------------------

  const tl = gsap.timeline();

  animationRef.current = tl;

  // FLASH + OVERLAY IN
  tl.to(overlay, {
    opacity: 1,
    filter: "brightness(1)",
    duration: 0.5,
    ease: "power2.out",
  })

    // CURTAIN / SLAM ENTRANCE
    .to(
      player,
      {
        opacity: 1,
        scale: 1,
        y: 0,
        rotationX: 0,
        filter: "blur(0px)",
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 1.1,
        ease: "expo.out",
        force3D: true,
      },
      "-=0.3"
    )

    // LETTERBOX BARS WIPE OPEN
    .to(
      [topGradient, bottomGradient].filter(Boolean),
      {
        scaleY: 1,
        duration: 0.7,
        ease: "power3.out",
      },
      "-=0.85"
    )

    // TOP BAR REVEAL
    .to(
      topBar,
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power3.out",
      },
      "-=0.55"
    )

    // CONTROLS REVEAL
    .to(
      controls,
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power3.out",
      },
      "-=0.55"
    )

    // FINAL IMPACT PUNCH
    .to(player, {
      scale: 1.015,
      duration: 0.12,
      ease: "power1.inOut",
      yoyo: true,
      repeat: 1,
    });

  // -----------------------------------------------------
  // START VIDEO
  // -----------------------------------------------------

  if (video) {
    video.currentTime = 0;

    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    }
  }
},
{
  dependencies: [isOpen],
  scope: overlayRef,
  revertOnUpdate: true,
}


);

// =========================================================
// CLEANUP WHEN CLOSED
// =========================================================

useEffect(() => {
if (isOpen) return;


// Stop video
if (videoRef.current) {
  videoRef.current.pause();
}

// Kill active animation
if (animationRef.current) {
  animationRef.current.kill();
  animationRef.current = null;
}

// Cancel pending RAF
if (progressFrameRef.current) {
  cancelAnimationFrame(progressFrameRef.current);
  progressFrameRef.current = null;
}

document.body.style.overflow = "";


}, [isOpen]);

// =========================================================
// CLOSE ANIMATION
// =========================================================

const closePlayer = useCallback(() => {
const overlay = overlayRef.current;
const player = playerRef.current;


if (!overlay || !player) {
  onClose();
  return;
}

// Stop playback immediately
if (videoRef.current) {
  videoRef.current.pause();
}

// Kill any previous timeline
if (animationRef.current) {
  animationRef.current.kill();
  animationRef.current = null;
}

const tl = gsap.timeline({
  onComplete: () => {
    animationRef.current = null;
    onClose();
  },
});

animationRef.current = tl;

tl.to(player, {
  opacity: 0,
  scale: 0.94,
  y: 25,
  filter: "blur(10px)",
  duration: 0.35,
  ease: "power3.in",
  force3D: true,
}).to(
  overlay,
  {
    opacity: 0,
    duration: 0.25,
    ease: "power2.in",
  },
  "-=0.1"
);


}, [onClose]);

// =========================================================
// ESC KEY
// =========================================================

useEffect(() => {
if (!isOpen) return;


const handleKeyDown = (event) => {
  if (event.key === "Escape") {
    closePlayer();
    return;
  }

  if (
    event.code === "Space" &&
    event.target === document.body
  ) {
    event.preventDefault();

    const video = videoRef.current;

    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }
};

window.addEventListener("keydown", handleKeyDown);

return () => {
  window.removeEventListener("keydown", handleKeyDown);
};


}, [isOpen, closePlayer]);

// =========================================================
// VIDEO METADATA
// =========================================================

const handleLoadedMetadata = useCallback(() => {
const video = videoRef.current;

if (!video) return;

setDuration(video.duration);


}, []);

// =========================================================
// OPTIMIZED TIME UPDATE
// =========================================================

const handleTimeUpdate = useCallback(() => {
const video = videoRef.current;


if (!video) return;

// Prevent React from rendering excessively
if (progressFrameRef.current) return;

progressFrameRef.current = requestAnimationFrame(() => {
  if (videoRef.current) {
    setCurrentTime(videoRef.current.currentTime);
  }

  progressFrameRef.current = null;
});


}, []);

// =========================================================
// PLAY / PAUSE EVENTS
// =========================================================

const handlePlay = useCallback(() => {
setIsPlaying(true);
}, []);

const handlePause = useCallback(() => {
setIsPlaying(false);
}, []);

// =========================================================
// RAF CLEANUP
// =========================================================

useEffect(() => {
return () => {
if (progressFrameRef.current) {
cancelAnimationFrame(progressFrameRef.current);
progressFrameRef.current = null;
}
};
}, []);

// =========================================================
// PLAY / PAUSE
// =========================================================

const togglePlay = useCallback(() => {
const video = videoRef.current;


if (!video) return;

if (video.paused) {
  video.play().catch(() => {});
} else {
  video.pause();
}


}, []);

// =========================================================
// MUTE
// =========================================================

const toggleMute = useCallback(() => {
const video = videoRef.current;


if (!video) return;

video.muted = !video.muted;

setIsMuted(video.muted);


}, []);

// =========================================================
// PROGRESS
// =========================================================

const handleProgressClick = useCallback(
(event) => {
const video = videoRef.current;
const bar = progressRef.current;


  if (!video || !bar || !duration) return;

  const rect = bar.getBoundingClientRect();

  const percentage =
    (event.clientX - rect.left) / rect.width;

  video.currentTime =
    Math.max(0, Math.min(1, percentage)) * duration;
},
[duration]


);

// =========================================================
// FULLSCREEN
// =========================================================

const handleFullscreen = useCallback(() => {
const player = playerRef.current;


if (!player) return;

if (document.fullscreenElement) {
  document.exitFullscreen?.();
  return;
}

player.requestFullscreen?.();


}, []);

// =========================================================
// DON'T RENDER
// =========================================================

if (!isOpen || !src) return null;

const progress =
duration > 0
? (currentTime / duration) * 100
: 0;

// =========================================================
// RENDER
// =========================================================

return (
<div
ref={overlayRef}
className="fixed inset-0 z-[100001] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 md:p-8"
onMouseDown={(event) => {
if (event.target === overlayRef.current) {
closePlayer();
}
}}
>
<div
ref={playerRef}
className="relative w-full max-w-[1500px] aspect-video bg-black overflow-hidden shadow-2xl"
style={{
willChange: "transform, opacity, filter",
}}
onMouseEnter={() => setIsHovering(true)}
onMouseLeave={() => setIsHovering(false)}
>
{/* =================================================
VIDEO
================================================= */}


    <video
      ref={videoRef}
      src={src}
      playsInline
      preload="auto"
      className="absolute inset-0 w-full h-full object-contain"
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onPlay={handlePlay}
      onPause={handlePause}
      onClick={togglePlay}
    />

    {/* =================================================
        TOP GRADIENT
    ================================================= */}

    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

    {/* =================================================
        TOP BAR
    ================================================= */}

    <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex items-start justify-between z-10">
      <div className="flex flex-col gap-1">
        <span className="font-geist-mono text-[9px] md:text-[10px] tracking-widest uppercase text-zinc-400">
          Now Playing
        </span>

        <span className="font-geist-mono text-xs md:text-sm uppercase tracking-tight text-white">
          {title}
        </span>
      </div>

      <button
        type="button"
        onClick={closePlayer}
        className="w-9 h-9 md:w-11 md:h-11 border border-white/30 text-white flex items-center justify-center hover:bg-white hover:text-black transition-colors duration-300"
        aria-label="Close video"
      >
        <span className="text-lg leading-none">
          ×
        </span>
      </button>
    </div>

    {/* =================================================
        BOTTOM GRADIENT
    ================================================= */}

    <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />

    {/* =================================================
        CONTROLS
    ================================================= */}

    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 z-10">

      {/* PROGRESS */}

      <div
        ref={progressRef}
        onClick={handleProgressClick}
        className="relative w-full h-[2px] bg-white/25 cursor-pointer mb-5 group"
      >
        <div
          className="absolute left-0 top-0 h-full bg-white"
          style={{
            width: `${progress}%`,
          }}
        />

        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            left: `${progress}%`,
          }}
        />
      </div>

      {/* CONTROL ROW */}

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-4 md:gap-6">
          <button
            type="button"
            onClick={togglePlay}
            className="font-geist-mono text-[10px] md:text-xs uppercase tracking-widest text-white hover:text-zinc-400 transition-colors"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>

          <span className="font-geist-mono text-[9px] md:text-[10px] text-zinc-400 tracking-wider">
            {formatTime(currentTime)} /{" "}
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <button
            type="button"
            onClick={toggleMute}
            className="font-geist-mono text-[10px] md:text-xs uppercase tracking-widest text-white hover:text-zinc-400 transition-colors"
          >
            {isMuted ? "Sound On" : "Mute"}
          </button>

          <button
            type="button"
            onClick={handleFullscreen}
            className="font-geist-mono text-[10px] md:text-xs uppercase tracking-widest text-white hover:text-zinc-400 transition-colors"
          >
            Fullscreen
          </button>
        </div>

      </div>
    </div>
  </div>
</div>


);
}
