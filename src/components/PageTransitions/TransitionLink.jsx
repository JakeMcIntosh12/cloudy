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
// FONTS
// --------------------------------------------------------

function waitForFonts() {
  if (typeof document === "undefined" || !document.fonts) {
    return Promise.resolve();
  }

  return document.fonts.ready.catch(() => {});
}

// --------------------------------------------------------
// IMAGES
// --------------------------------------------------------


function waitForVisibleImages() {
  const images = Array.from(document.images).filter((img) => {
    const isEager = img.loading !== "lazy";
    const isVisible = elementInInitialViewport(img);

    return (isEager || isVisible) && !img.complete;
  });

  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        })
    )
  );
}

// --------------------------------------------------------
// VIDEO
// --------------------------------------------------------


function waitForVisibleVideos() {
  const videos = Array.from(
    document.querySelectorAll("video")
  ).filter((video) => {
    const hasSource = Boolean(video.currentSrc || video.src);
    const isVisible = elementInInitialViewport(video);

    return hasSource && isVisible && video.readyState < 2;
  });

  return Promise.all(
    videos.map(
      (video) =>
        new Promise((resolve) => {
          video.addEventListener("loadeddata", resolve, {
            once: true,
          });

          video.addEventListener("error", resolve, {
            once: true,
          });
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
      const stillLoading = document.querySelector(
        '[aria-busy="true"], [data-page-loading="true"]'
      );

      if (!stillLoading || performance.now() > deadline) {
        resolve();
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

// --------------------------------------------------------
// COMBINED "IS THE PAGE REALLY READY" CHECK
// --------------------------------------------------------

async function waitForPageFullyLoaded({ startTime, maxWaitMs }) {
  const deadline = startTime + maxWaitMs;

  const remaining = () =>
    Math.max(0, deadline - performance.now());

  const withDeadline = (promise) =>
    Promise.race([
      promise,
      new Promise((resolve) => setTimeout(resolve, remaining())),
    ]);

  // Data-loading flags first — no point checking image/video
  // readiness while the real content behind them hasn't rendered yet.
  await withDeadline(waitForNoLoadingFlags(deadline));


  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));

  await withDeadline(
    Promise.all([
      waitForFonts(),
      waitForVisibleImages(),
      waitForVisibleVideos(),
    ])
  );
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

  const isTransitioning = useRef(false);

  const handleTransition = (e) => {
    e.preventDefault();

    if (isTransitioning.current) return;

    // Run any custom click handler
    if (onClick) {
      onClick(e);
    }

    // Don't transition to the current page
    if (href === pathname) return;

    const overlay = document.querySelector(
      ".page-transition-overlay"
    );

    if (!overlay) {
      window.scrollTo(0, 0);
      router.push(href);
      return;
    }

    isTransitioning.current = true;

    // =======================================================
    // RESET OVERLAY
    // =======================================================

    gsap.killTweensOf(overlay);

    gsap.set(overlay, {
      "--wipe": "0%",
      opacity: 0,
    });

    // =======================================================
    // WIPE IN
    // =======================================================

    const tl = gsap.timeline();

    tl.to(overlay, {
      opacity: 1,
      "--wipe": "125%",
      duration: 0.75,
      ease: "power4.inOut",
    });

    // =======================================================
    // NAVIGATE
    // =======================================================

    tl.call(() => {
      window.scrollTo(0, 0);

      router.push(href);

      // Strip query/hash so this still matches on links like
      // "/Work/slug?ref=list".
      const targetPath = href.split(/[?#]/)[0];

      // =====================================================
      // WAIT FOR NEW ROUTE + REAL READINESS
      // =====================================================

      const startTime = performance.now();

      const waitForPageReady = () => {
        // ---------------------------------------------------
        // SAFETY FALLBACK
        // ---------------------------------------------------

        if (performance.now() - startTime > maxWaitMs) {
          finishTransition();
          return;
        }

        // ---------------------------------------------------
        // WAIT FOR ROUTE
        // ---------------------------------------------------

        if (window.location.pathname !== targetPath) {
          requestAnimationFrame(waitForPageReady);
          return;
        }

        // ---------------------------------------------------
        // WAIT FOR REAL READINESS: fonts, in-view images/video,
        // and any explicit data-loading flags on the new page.
        // ---------------------------------------------------

        waitForPageFullyLoaded({
          startTime,
          maxWaitMs,
        }).then(finishTransition);
      };

      // =====================================================
      // FINISH TRANSITION
      // =====================================================

      const finishTransition = () => {
        if (!isTransitioning.current) {
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

            isTransitioning.current = false;

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