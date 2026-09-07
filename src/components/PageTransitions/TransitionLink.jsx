"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

// ==========================================================
// READINESS HELPERS
// ==========================================================

function elementInInitialViewport(el) {
  const rect = el.getBoundingClientRect();

  return rect.top < window.innerHeight && rect.bottom > 0;
}

// --------------------------------------------------------
// WAIT FOR BROWSER PAINT
// --------------------------------------------------------

function waitForPaintFrames(count = 2) {
  return new Promise((resolve) => {
    let frames = 0;

    const nextFrame = () => {
      frames += 1;

      if (frames >= count) {
        resolve();
        return;
      }

      requestAnimationFrame(nextFrame);
    };

    requestAnimationFrame(nextFrame);
  });
}

// --------------------------------------------------------
// FONTS
// --------------------------------------------------------

function waitForFonts() {
  if (
    typeof document === "undefined" ||
    !document.fonts
  ) {
    return Promise.resolve();
  }

  return document.fonts.ready.catch(() => {});
}

// --------------------------------------------------------
// IMAGES
// --------------------------------------------------------

function waitForVisibleImages() {
  if (typeof document === "undefined") {
    return Promise.resolve();
  }

  const images = Array.from(document.images).filter((img) => {
    const isEager = img.loading !== "lazy";
    const isVisible = elementInInitialViewport(img);

    return (
      (isEager || isVisible) &&
      !img.complete
    );
  });

  if (!images.length) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          const done = () => resolve();

          img.addEventListener(
            "load",
            done,
            { once: true }
          );

          img.addEventListener(
            "error",
            done,
            { once: true }
          );

          // Safety fallback.
          setTimeout(done, 5000);
        })
    )
  );
}

// --------------------------------------------------------
// VIDEO
// --------------------------------------------------------

function waitForVisibleVideos() {
  if (typeof document === "undefined") {
    return Promise.resolve();
  }

  const videos = Array.from(
    document.querySelectorAll("video")
  ).filter((video) => {
    const hasSource = Boolean(
      video.currentSrc || video.src
    );

    const isVisible =
      elementInInitialViewport(video);

    return (
      hasSource &&
      isVisible &&
      video.readyState < 2
    );
  });

  if (!videos.length) {
    return Promise.resolve();
  }

  return Promise.all(
    videos.map(
      (video) =>
        new Promise((resolve) => {
          const done = () => resolve();

          video.addEventListener(
            "loadeddata",
            done,
            { once: true }
          );

          video.addEventListener(
            "error",
            done,
            { once: true }
          );

          // Safety fallback.
          setTimeout(done, 5000);
        })
    )
  );
}

// --------------------------------------------------------
// EXPLICIT "STILL LOADING" FLAGS
// --------------------------------------------------------

function waitForNoLoadingFlags(deadline) {
  return new Promise((resolve) => {
    const check = () => {
      const stillLoading =
        document.querySelector(
          '[aria-busy="true"], [data-page-loading="true"]'
        );

      if (
        !stillLoading ||
        performance.now() > deadline
      ) {
        resolve();
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

// ==========================================================
// COMBINED PAGE READINESS
// ==========================================================

async function waitForPageFullyLoaded({
  startTime,
  maxWaitMs,
}) {
  const deadline =
    startTime + maxWaitMs;

  const remaining = () =>
    Math.max(
      0,
      deadline - performance.now()
    );

  const withDeadline = (promise) =>
    Promise.race([
      promise,
      new Promise((resolve) =>
        setTimeout(
          resolve,
          remaining()
        )
      ),
    ]);

  // --------------------------------------------------------
  // 1. WAIT FOR EXPLICIT PAGE LOADING FLAGS
  // --------------------------------------------------------

  await withDeadline(
    waitForNoLoadingFlags(deadline)
  );

  // --------------------------------------------------------
  // 2. WAIT FOR DOM TO SETTLE
  // --------------------------------------------------------

  await waitForPaintFrames(2);

  // --------------------------------------------------------
  // 3. WAIT FOR FONTS / INITIAL IMAGES / VIDEOS
  // --------------------------------------------------------

  await withDeadline(
    Promise.all([
      waitForFonts(),
      waitForVisibleImages(),
      waitForVisibleVideos(),
    ])
  );

  // --------------------------------------------------------
  // 4. IMPORTANT:
  // LET REACT + THREE.JS + THE BROWSER PAINT
  // --------------------------------------------------------

  await waitForPaintFrames(3);
}

// ==========================================================
// TRANSITION LINK
// ==========================================================

export default function TransitionLink({
  href,
  children,
  className,
  onClick,
  maxWaitMs = 8000,
}) {
  const router = useRouter();
  const pathname = usePathname();

  const isTransitioning =
    useRef(false);

  const handleTransition = (e) => {
    e.preventDefault();

    if (isTransitioning.current) {
      return;
    }

    // ------------------------------------------------------
    // CUSTOM CLICK HANDLER
    // ------------------------------------------------------

    if (onClick) {
      onClick(e);
    }

    // ------------------------------------------------------
    // CURRENT PAGE
    // ------------------------------------------------------

    if (href === pathname) {
      return;
    }

    const overlay =
      document.querySelector(
        ".page-transition-overlay"
      );

    // ------------------------------------------------------
    // NO OVERLAY FALLBACK
    // ------------------------------------------------------

    if (!overlay) {
      window.scrollTo(0, 0);
      router.push(href);
      return;
    }

    isTransitioning.current = true;

    // ======================================================
    // RESET OVERLAY
    // ======================================================

    gsap.killTweensOf(overlay);

    gsap.set(overlay, {
      "--wipe": "0%",
      opacity: 0,
    });

    // ======================================================
    // WIPE IN
    // ======================================================

    const tl = gsap.timeline();

    tl.to(overlay, {
      opacity: 1,
      "--wipe": "125%",
      duration: 0.75,
      ease: "power4.inOut",
    });

    // ======================================================
    // NAVIGATE
    // ======================================================

    tl.call(() => {
      window.scrollTo(0, 0);

      router.push(href);

      const targetPath =
        href.split(/[?#]/)[0];

      const startTime =
        performance.now();

      // ====================================================
      // WAIT FOR NEW ROUTE
      // ====================================================

      const waitForPageReady = () => {
        // --------------------------------------------------
        // SAFETY FALLBACK
        // --------------------------------------------------

        if (
          performance.now() - startTime >
          maxWaitMs
        ) {
          finishTransition();
          return;
        }

        // --------------------------------------------------
        // WAIT UNTIL ROUTE HAS ACTUALLY CHANGED
        // --------------------------------------------------

        if (
          window.location.pathname !==
          targetPath
        ) {
          requestAnimationFrame(
            waitForPageReady
          );

          return;
        }

        // --------------------------------------------------
        // WAIT FOR PAGE READINESS
        // --------------------------------------------------

        waitForPageFullyLoaded({
          startTime,
          maxWaitMs,
        }).then(() => {
          finishTransition();
        });
      };

      // ====================================================
      // FINISH TRANSITION
      // ====================================================

      const finishTransition = () => {
        if (
          !isTransitioning.current
        ) {
          return;
        }

        gsap.killTweensOf(overlay);

        gsap.to(overlay, {
          "--wipe": "0%",
          opacity: 0,
          duration: 0.75,
          ease: "power4.inOut",
          overwrite: true,

          onComplete: () => {
            gsap.set(overlay, {
              "--wipe": "0%",
              opacity: 0,
            });

            isTransitioning.current =
              false;

            ScrollTrigger.refresh();
          },
        });
      };

      waitForPageReady();
    });
  };

  return (
    <Link
      href={href}
      onClick={handleTransition}
      className={className}
    >
      {children}
    </Link>
  );
}