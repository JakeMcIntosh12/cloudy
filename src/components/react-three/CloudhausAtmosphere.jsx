"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import gsap from "gsap";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

// ------------------------------------------------------------------
// SIMPLEX NOISE
// ------------------------------------------------------------------

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;

    gl_Position =
      projectionMatrix *
      modelViewMatrix *
      vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;

  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 1.0) * x);
  }

  vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;

    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);

    vec4 p =
      permute(
        permute(
          permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0)
          )
          + i.y + vec4(0.0, i1.y, i2.y, 1.0)
        )
        + i.x + vec4(0.0, i1.x, i2.x, 1.0)
      );

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;

    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;

    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 =
      b0.xzyw +
      s0.xzyw * sh.xxyy;

    vec4 a1 =
      b1.xzyw +
      s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(
      vec4(
        dot(p0, p0),
        dot(p1, p1),
        dot(p2, p2),
        dot(p3, p3)
      )
    );

    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(
      0.6 -
        vec4(
          dot(x0, x0),
          dot(x1, x1),
          dot(x2, x2),
          dot(x3, x3)
        ),
      0.0
    );

    m = m * m;

    return 42.0 *
      dot(
        m * m,
        vec4(
          dot(p0, x0),
          dot(p1, x1),
          dot(p2, x2),
          dot(p3, x3)
        )
      );
  }

  void main() {
    // Stretch horizontally so the distortion behaves like
    // atmospheric heat / glass rather than blobs.
    vec2 uv = vec2(
      vUv.x * 3.0,
      vUv.y * 14.0
    );

    // Domain warp
    float warpX =
      snoise(
        vec3(
          uv * 0.6,
          uTime * 0.05
        )
      );

    float warpY =
      snoise(
        vec3(
          uv * 0.6 + 5.2,
          uTime * 0.05
        )
      );

    float n1 =
      snoise(
        vec3(
          uv + vec2(warpX, warpY) * 0.6,
          uTime * 0.15
        )
      );

    float n2 =
      snoise(
        vec3(
          uv * 2.0 + vec2(warpY, warpX) * 0.4,
          uTime * 0.2 + 8.0
        )
      );

    // 0.5 = no displacement
    float dx = 0.5 + n1 * 0.5;
    float dy = 0.5 + n2 * 0.35;

    gl_FragColor = vec4(
      dx,
      dy,
      0.5,
      1.0
    );
  }
`;

// ------------------------------------------------------------------
// NOISE PLANE
// ------------------------------------------------------------------
//
// IMPORTANT FIX: this component now owns the render loop itself.
// The Canvas below runs frameloop="demand", meaning R3F does NOT
// automatically render every frame. Instead, we call invalidate()
// only while activeRef.current is true. The moment scrolling stops,
// we simply stop calling invalidate() and the renderer goes
// completely idle - no draw calls, no GPU work, nothing - instead
// of silently redrawing an unused frame 60x/second forever.

function NoisePlane({ activeRef }) {
  const matRef = useRef(null);
  const { viewport, invalidate } = useThree();

  useFrame((state) => {
    if (!activeRef.current) return;

    if (matRef.current) {
      matRef.current.uniforms.uTime.value =
        state.clock.elapsedTime;
    }

    // Schedule the next frame ONLY while active. This is what
    // keeps the demand-based loop alive during scrolling, and
    // what lets it die instantly once scrolling stops.
    invalidate();
  });

  return (
    <mesh
      scale={[
        viewport.width,
        viewport.height,
        1,
      ]}
    >
      <planeGeometry args={[1, 1]} />

      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: {
            value: 0,
          },
        }}
      />
    </mesh>
  );
}

// ------------------------------------------------------------------
// BRIDGE: exposes R3F's invalidate() to the vanilla scroll handler
// living outside the Canvas tree.
// ------------------------------------------------------------------

function InvalidateBridge({ invalidateRef }) {
  const { invalidate } = useThree();

  useEffect(() => {
    invalidateRef.current = invalidate;

    return () => {
      invalidateRef.current = null;
    };
  }, [invalidate]);

  return null;
}

// ------------------------------------------------------------------
// R3F NOISE RENDERER
// ------------------------------------------------------------------

function MirageNoiseRenderer({
  glRef,
  onFrame,
  activeRef,
  invalidateRef,
}) {
  const lastCaptureRef = useRef(0);

  useFrame((state) => {
    if (!activeRef.current) return;

    /*
      Capture roughly every 120ms instead of 100ms. toDataURL is a
      synchronous GPU->CPU readback + image encode - one of the
      more expensive things a browser can do on the main thread -
      so we deliberately keep this infrequent.
    */

    const now = state.clock.elapsedTime;

    if (now - lastCaptureRef.current < 0.12) {
      return;
    }

    lastCaptureRef.current = now;

    if (!glRef.current) return;

    try {
      /*
        JPEG encodes noticeably faster than PNG for this kind of
        noisy content, and the SVG displacement map doesn't need
        lossless precision - a bit of compression artifacting is
        invisible in the final blurred result.
      */
      const dataUrl = glRef.current.domElement.toDataURL(
        "image/jpeg",
        0.6
      );

      onFrame(dataUrl);
    } catch (error) {
      /*
        Some mobile browsers can reject framebuffer reads
        under memory/GPU pressure, or the context may have been
        lost. The effect simply skips that frame instead of
        breaking the page.
      */
    }
  });

  return (
    <>
      <InvalidateBridge invalidateRef={invalidateRef} />
      <NoisePlane activeRef={activeRef} />
    </>
  );
}

// ------------------------------------------------------------------
// CANVAS WRAPPER
// ------------------------------------------------------------------

function MirageNoiseSource({
  onFrame,
  activeRef,
  invalidateRef,
}) {
  const glRef = useRef(null);

  /*
    Use a much smaller DPR for the noise texture.

    The displacement map doesn't need retina resolution.
  */

  const getDpr = () => {
    if (typeof window === "undefined") {
      return 1;
    }

    const isTouchDevice =
      window.matchMedia(
        "(hover: none), (pointer: coarse)"
      ).matches;

    return isTouchDevice ? 0.4 : 1;
  };

  return (
    <Canvas
      dpr={getDpr()}
      orthographic={false}
      frameloop="demand"
      gl={{
        preserveDrawingBuffer: true,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={({ gl }) => {
        glRef.current = gl;

        /*
          Make absolutely certain this hidden renderer can
          never participate in pointer interaction.
        */

        gl.domElement.style.pointerEvents = "none";

        /*
          If the browser evicts this context under memory/context
          pressure, fail quietly instead of throwing. The effect
          just stops updating until (if ever) the context comes
          back.
        */

        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
          },
          false
        );
      }}
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <MirageNoiseRenderer
        glRef={glRef}
        onFrame={onFrame}
        activeRef={activeRef}
        invalidateRef={invalidateRef}
      />
    </Canvas>
  );
}

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------

export default function CloudhausAtmosphere() {
  const containerRef = useRef(null);
  const feImageRef = useRef(null);

  const fadeTweenRef = useRef(null);
  const timeoutRef = useRef(null);

  const lastScrollRef = useRef(0);
  const tickingRef = useRef(false);

  const isVisibleRef = useRef(false);
  const activeRef = useRef(false);
  const invalidateRef = useRef(null);

  const setBlur = useRef(null);
  const setSaturate = useRef(null);
  const setScale = useRef(null);
  const setGlassOpacity = useRef(null);

  /*
    FIX: don't create the hidden WebGL context (and compete with
    FilmGrain / the fog canvas for one of the browser's limited
    WebGL context slots) until the user actually scrolls. Pages
    nobody scrolls on never pay this cost at all, and we're not
    all spinning up contexts simultaneously at page load anymore.
  */
  const [isMounted, setIsMounted] = useState(false);

  // --------------------------------------------------------------
  // NOISE FRAME
  // --------------------------------------------------------------

  const handleNoiseFrame = useCallback((dataUrl) => {
    if (!feImageRef.current) return;

    feImageRef.current.setAttribute("href", dataUrl);
    feImageRef.current.setAttribute("xlink:href", dataUrl);
  }, []);

  // --------------------------------------------------------------
  // GSAP + SCROLL
  // --------------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const isTouchDevice =
      window.matchMedia(
        "(hover: none), (pointer: coarse)"
      ).matches;

    /*
      Mobile gets a lighter effect.

      More importantly, this means we aren't asking a phone
      to do the same amount of displacement work as desktop.
    */

    const intensity = isTouchDevice ? 0.65 : 1;

    lastScrollRef.current = window.scrollY;

    // ------------------------------------------------------------
    // INITIAL STATE
    // ------------------------------------------------------------

    gsap.set(container, {
      opacity: 0,
      "--glass-blur": "0px",
      "--glass-saturate": "100%",
      "--glass-scale": 0,
      "--glass-opacity": 0,
    });

    // ------------------------------------------------------------
    // QUICK TO
    // ------------------------------------------------------------

    setBlur.current = gsap.quickTo(container, "--glass-blur", {
      duration: 0.45,
      ease: "power2.out",
    });

    setSaturate.current = gsap.quickTo(container, "--glass-saturate", {
      duration: 0.45,
      ease: "power2.out",
    });

    setScale.current = gsap.quickTo(container, "--glass-scale", {
      duration: 0.5,
      ease: "power2.out",
    });

    setGlassOpacity.current = gsap.quickTo(container, "--glass-opacity", {
      duration: 0.45,
      ease: "power2.out",
    });

    // ------------------------------------------------------------
    // SCROLL
    // ------------------------------------------------------------

    const handleScroll = () => {
      // Lazily create the WebGL context on first real scroll.
      if (!isMounted) {
        setIsMounted(true);
      }

      /*
        Cancel the previous scroll-stop timer.
      */

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      /*
        Mark the WebGL renderer as active and kick the
        demand-based render loop awake. Without this call,
        frameloop="demand" means nothing renders at all.
      */

      activeRef.current = true;
      invalidateRef.current?.();

      /*
        Fade the entire lens in only once.
      */

      if (!isVisibleRef.current) {
        isVisibleRef.current = true;

        if (fadeTweenRef.current) {
          fadeTweenRef.current.kill();
        }

        fadeTweenRef.current = gsap.to(container, {
          opacity: 1,
          duration: 0.6,
          ease: "power3.out",
          overwrite: true,
        });
      }

      /*
        Throttle velocity calculations to one per animation
        frame.
      */

      if (!tickingRef.current) {
        tickingRef.current = true;

        requestAnimationFrame(() => {
          const currentScroll = window.scrollY;

          const speed = Math.abs(currentScroll - lastScrollRef.current);

          lastScrollRef.current = currentScroll;

          const velocity = Math.min(
            speed / (isTouchDevice ? 20 : 15),
            1
          );

          /*
            STRONG DESKTOP
            LIGHTER MOBILE
          */

          const targetBlur = (3 + velocity * 5) * intensity;

          const targetSaturate = 110 + velocity * 45 * intensity;

          const targetScale = (22 + velocity * 43) * intensity;

          const targetOpacity = 0.75 + velocity * 0.25;

          setBlur.current(targetBlur);

          setSaturate.current(targetSaturate);

          setScale.current(targetScale);

          setGlassOpacity.current(targetOpacity);

          tickingRef.current = false;
        });
      }

      /*
        ----------------------------------------------------------
        SCROLL STOP
        ----------------------------------------------------------
      */

      timeoutRef.current = setTimeout(() => {
        isVisibleRef.current = false;

        /*
          STOP THE EXPENSIVE NOISE CAPTURE.

          With frameloop="demand" this is now the difference
          between "idle" and "rendering" - the Canvas does zero
          GPU work from this point until the next scroll.
        */

        activeRef.current = false;

        /*
          Smoothly remove the distortion.
        */

        setBlur.current(0);
        setSaturate.current(100);
        setScale.current(0);
        setGlassOpacity.current(0);

        /*
          Smoothly fade the lens itself away.
        */

        if (fadeTweenRef.current) {
          fadeTweenRef.current.kill();
        }

        fadeTweenRef.current = gsap.to(container, {
          opacity: 0,
          duration: 1.4,
          ease: "power3.inOut",
          overwrite: true,
          onComplete: () => {
            fadeTweenRef.current = null;
          },
        });
      }, 180);
    };

    // Also go idle when the tab is backgrounded, so nothing
    // keeps rendering while the user isn't even looking at it.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        activeRef.current = false;
      }
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (fadeTweenRef.current) {
        fadeTweenRef.current.kill();
      }

      gsap.killTweensOf(container);

      activeRef.current = false;
    };
  }, [isMounted]);

  // --------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------

  return (
    <>
      {/* ==========================================================
          OFFSCREEN WEBGL NOISE SOURCE

          Not mounted until the first scroll event - see isMounted.
      ========================================================== */}

      {isMounted && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            width: "256px",
            height: "64px",
            top: 0,
            left: 0,
            opacity: 0,
            visibility: "hidden",
            pointerEvents: "none",
            zIndex: -1,
            overflow: "hidden",
            contain: "strict",
          }}
        >
          <MirageNoiseSource
            onFrame={handleNoiseFrame}
            activeRef={activeRef}
            invalidateRef={invalidateRef}
          />
        </div>
      )}

      {/* ==========================================================
          SVG DISPLACEMENT FILTER
      ========================================================== */}

      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          overflow: "hidden",
        }}
      >
        <defs>
          <filter
            id="scroll-mirage-distortion"
            x="-20%"
            y="-50%"
            width="140%"
            height="200%"
          >
            <feImage
              ref={feImageRef}
              x="0"
              y="0"
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              result="noiseMap"
            />

            <feDisplacementMap
              in="SourceGraphic"
              in2="noiseMap"
              scale="var(--glass-scale, 0)"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* ==========================================================
          BOTTOM MIRAGE EDGE
      ========================================================== */}

      <div
        ref={containerRef}
        aria-hidden="true"
        className="fixed bottom-0 left-0 w-full h-[100px] pointer-events-none z-[999]"
        style={{
          opacity: 0,
          "--glass-blur": "0px",
          "--glass-saturate": "100%",
          "--glass-scale": 0,
          "--glass-opacity": 0,
          contain: "layout paint style",
          isolation: "isolate",
          pointerEvents: "none",
        }}
      >
        <div
          className="w-full h-full pointer-events-none"
          style={{
            backdropFilter:
              "blur(var(--glass-blur)) saturate(var(--glass-saturate)) url(#scroll-mirage-distortion)",
            WebkitBackdropFilter:
              "blur(var(--glass-blur)) saturate(var(--glass-saturate)) url(#scroll-mirage-distortion)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 30%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 30%, black 100%)",
            transform: "translateZ(0)",
            willChange: "backdrop-filter",
          }}
        />
      </div>
    </>
  );
}