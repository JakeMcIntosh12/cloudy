
"use client";

import React, { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

// ------------------------------------------------------------------
// Simplex noise (Ashima Arts, public domain-style utility) + domain
// warp. This is what produces the flowing, non-repeating "heat" look
// instead of the blocky re-seeded feTurbulence noise.
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
    // Stretch horizontally: mirage shimmer travels in thin
    // horizontal layers, not uniform blobs.
    vec2 uv = vec2(
      vUv.x * 3.0,
      vUv.y * 14.0
    );

    // Domain warp.
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

    // Encode as displacement map:
    // 0.5 = no displacement.
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

function NoisePlane() {
  const matRef = useRef(null);
  const { viewport } = useThree();

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value =
        state.clock.elapsedTime;
    }
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />

      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
        }}
      />
    </mesh>
  );
}

// ------------------------------------------------------------------
// R3F NOISE RENDERER
// ------------------------------------------------------------------

function MirageNoiseRenderer({ glRef, onFrame }) {
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current += 1;

    // ~15fps
    if (
      frameCount.current % 4 === 0 &&
      glRef.current
    ) {
      onFrame(
        glRef.current.domElement.toDataURL("image/png")
      );
    }
  });

  return <NoisePlane />;
}

// ------------------------------------------------------------------
// CANVAS WRAPPER
// ------------------------------------------------------------------

function MirageNoiseSource({ onFrame }) {
  const glRef = useRef(null);

  return (
    <Canvas
      dpr={1}
      orthographic={false}
      gl={{
        preserveDrawingBuffer: true,
        alpha: true,
        antialias: false,
      }}
      onCreated={({ gl }) => {
        glRef.current = gl;
      }}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <MirageNoiseRenderer
        glRef={glRef}
        onFrame={onFrame}
      />
    </Canvas>
  );
}

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------

export default function ScrollMirageEdge() {
  const containerRef = useRef(null);
  const feImageRef = useRef(null);

  const fadeTweenRef = useRef(null);
  const timeoutRef = useRef(null);

  const lastScrollRef = useRef(0);
  const tickingRef = useRef(false);
  const isVisibleRef = useRef(false);

  const setBlur = useRef(null);
  const setSaturate = useRef(null);
  const setScale = useRef(null);
  const setGlassOpacity = useRef(null);

  const handleNoiseFrame = useCallback((dataUrl) => {
    if (feImageRef.current) {
      feImageRef.current.setAttribute(
        "href",
        dataUrl
      );

      feImageRef.current.setAttribute(
        "xlink:href",
        dataUrl
      );
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    lastScrollRef.current = window.scrollY;

    // --------------------------------------------------
    // INITIAL STATE
    // --------------------------------------------------

    gsap.set(container, {
      opacity: 0,
      "--glass-blur": "0px",
      "--glass-saturate": "100%",
      "--glass-scale": 0,
      "--glass-opacity": 0,
    });

    // --------------------------------------------------
    // SMOOTH GLASS CONTROLS
    // --------------------------------------------------

    setBlur.current = gsap.quickTo(
      container,
      "--glass-blur",
      {
        duration: 0.45,
        ease: "power2.out",
      }
    );

    setSaturate.current = gsap.quickTo(
      container,
      "--glass-saturate",
      {
        duration: 0.45,
        ease: "power2.out",
      }
    );

    setScale.current = gsap.quickTo(
      container,
      "--glass-scale",
      {
        duration: 0.45,
        ease: "power2.out",
      }
    );

    setGlassOpacity.current = gsap.quickTo(
      container,
      "--glass-opacity",
      {
        duration: 0.45,
        ease: "power2.out",
      }
    );

    // --------------------------------------------------
    // SCROLL
    // --------------------------------------------------

    const handleScroll = () => {
      if (!container) return;

      // Cancel fade-out if scrolling begins again
      if (fadeTweenRef.current) {
        fadeTweenRef.current.kill();
        fadeTweenRef.current = null;
      }

      // --------------------------------------------------
      // SMOOTH FADE IN
      // --------------------------------------------------

      if (!isVisibleRef.current) {
        isVisibleRef.current = true;

        gsap.to(container, {
          opacity: 1,
          duration: 0.6,
          ease: "power3.out",
          overwrite: false,
        });
      }

      // --------------------------------------------------
      // MEASURE SCROLL VELOCITY
      // --------------------------------------------------

      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          const currentScroll =
            window.scrollY;

          const speed = Math.abs(
            currentScroll -
              lastScrollRef.current
          );

          lastScrollRef.current =
            currentScroll;

          const velocity = Math.min(
            speed / 15,
            1
          );

          // ------------------------------------------------
          // STRONGER OPTICAL EFFECT
          // ------------------------------------------------

          const targetBlur =
            3 + velocity * 5;

          const targetSaturate =
            110 + velocity * 45;

          const targetScale =
            22 + velocity * 43;

          const targetOpacity =
            0.75 + velocity * 0.25;

          setBlur.current(targetBlur);
          setSaturate.current(targetSaturate);
          setScale.current(targetScale);
          setGlassOpacity.current(
            targetOpacity
          );

          tickingRef.current = false;
        });

        tickingRef.current = true;
      }

      // --------------------------------------------------
      // DETECT SCROLL STOP
      // --------------------------------------------------

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (!container) return;

        isVisibleRef.current = false;

        if (fadeTweenRef.current) {
          fadeTweenRef.current.kill();
        }

        // Smoothly remove the actual optical effect.
        setBlur.current(0);
        setSaturate.current(100);
        setScale.current(0);
        setGlassOpacity.current(0);

        // Smoothly fade the entire lens away.
        fadeTweenRef.current = gsap.to(
          container,
          {
            opacity: 0,
            duration: 1.4,
            ease: "power3.inOut",

            overwrite: false,

            onComplete: () => {
              fadeTweenRef.current = null;
            },
          }
        );
      }, 180);
    };

    window.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (fadeTweenRef.current) {
        fadeTweenRef.current.kill();
      }

      gsap.killTweensOf(container);
    };
  }, []);

  return (
    <>
      {/* --------------------------------------------------
          OFFSCREEN R3F NOISE SOURCE
      -------------------------------------------------- */}

      <div
        style={{
          position: "fixed",
          width: "256px",
          height: "64px",
          top: 0,
          left: 0,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <MirageNoiseSource
          onFrame={handleNoiseFrame}
        />
      </div>

      {/* --------------------------------------------------
          SVG DISPLACEMENT FILTER
      -------------------------------------------------- */}

      <svg className="hidden">
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

      {/* --------------------------------------------------
          BOTTOM GLASS / MIRAGE
      -------------------------------------------------- */}

      <div
        ref={containerRef}
        className="fixed bottom-0 left-0 w-full h-[100px] pointer-events-none z-[999]"
        style={{
          opacity: 0,

          "--glass-blur": "0px",
          "--glass-saturate": "100%",
          "--glass-scale": 0,
          "--glass-opacity": 0,
        }}
      >
        <div
          className="w-full h-full"
          style={{
            backdropFilter:
              "blur(var(--glass-blur)) saturate(var(--glass-saturate)) url(#scroll-mirage-distortion)",

            WebkitBackdropFilter:
              "blur(var(--glass-blur)) saturate(var(--glass-saturate)) url(#scroll-mirage-distortion)",

            maskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 30%, black 100%)",

            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 30%, black 100%)",
          }}
        />
      </div>
    </>
  );
}

