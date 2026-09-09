"use client";

import React, {
  useRef,
  useState,
  useSyncExternalStore,
  Suspense,
  useEffect,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Clouds, Cloud } from "@react-three/drei";
import * as THREE from "three";

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/* =========================================================
   VIEWPORT HEIGHT TRACKER

   Mobile browsers (iOS Safari, mobile Chrome) grow/shrink the
   *visible* viewport as the address bar/toolbar hides and
   shows during scroll. CSS units like 100dvh / height:100%
   on a position:fixed element don't always resync with that
   change fast enough - the fixed layer stays sized for the
   old (shorter) viewport, leaving a gap at the bottom, then
   "snaps" once layout catches up. Tracking the real visual
   viewport height in JS and pushing it as an explicit pixel
   height keeps the layer in sync with no visible seam.
========================================================= */

function useViewportHeight() {
  const [height, setHeight] = useState(() => {
    if (typeof window === "undefined") return 0;

    return (
      window.visualViewport?.height ??
      window.innerHeight
    );
  });

  useEffect(() => {
    const vv =
      typeof window !== "undefined"
        ? window.visualViewport
        : null;

    let rafId = null;

    const update = () => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;

        setHeight(
          vv?.height ??
            (typeof window !== "undefined"
              ? window.innerHeight
              : 0)
        );
      });
    };

    update();

    if (vv) {
      // fires as the browser chrome hides/shows mid-scroll,
      // which is exactly the moment that causes the gap
      vv.addEventListener("resize", update, {
        passive: true,
      });
      vv.addEventListener("scroll", update, {
        passive: true,
      });
    } else {
      // fallback for browsers without visualViewport support
      window.addEventListener("resize", update, {
        passive: true,
      });
      window.addEventListener("scroll", update, {
        passive: true,
      });
    }

    window.addEventListener(
      "orientationchange",
      update,
      { passive: true }
    );

    return () => {
      if (rafId) cancelAnimationFrame(rafId);

      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      } else {
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update);
      }

      window.removeEventListener(
        "orientationchange",
        update
      );
    };
  }, []);

  return height;
}

/* =========================================================
   ERROR BOUNDARY
========================================================= */

class WebGLSceneErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error) {
    console.error("WebGL scene error:", error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

const CLOUD_URL = "/textures/cloud.png";

/* =========================================================
   SHARED SCROLL STATE
========================================================= */

const scrollState = {
  current: 0,
  target: 0,
};

/* =========================================================
   CLOUD CLUSTER POSITIONS
   Shared between the visual clouds and the flash point light,
   so a strike always lands exactly inside a real cloud mass
   instead of floating in empty space.
========================================================= */

const CLOUD_CLUSTERS = [
  { pos: [-4.5, 5.2, -1.6], weight: 1.1 },
  { pos: [4.5, 5.2, -1.8], weight: 1.1 },
  { pos: [0, 5.8, -3.4], weight: 0.8 },
  { pos: [-5.0, -5.0, -1.2], weight: 0.7 },
  { pos: [5.0, -5.0, -1.4], weight: 0.7 },
  { pos: [0, -5.8, -3.2], weight: 0.6 },
];

function pickWeightedCluster() {
  const total = CLOUD_CLUSTERS.reduce(
    (sum, c) => sum + c.weight,
    0
  );

  let r = Math.random() * total;

  for (const cluster of CLOUD_CLUSTERS) {
    r -= cluster.weight;
    if (r <= 0) return cluster.pos;
  }

  return CLOUD_CLUSTERS[0].pos;
}

/* =========================================================
   WEBGL CONTEXT GUARD
========================================================= */

function WebGLContextGuard({ onLost, onRestored }) {
  const { gl } = useThree();

  useEffect(() => {
    if (!gl || !gl.domElement) return;

    const canvas = gl.domElement;

    const handleContextLost = (event) => {
      event.preventDefault();
      onLost?.();
    };

    const handleContextRestored = () => {
      onRestored?.();
    };

    canvas.addEventListener(
      "webglcontextlost",
      handleContextLost,
      false
    );

    canvas.addEventListener(
      "webglcontextrestored",
      handleContextRestored,
      false
    );

    return () => {
      canvas.removeEventListener(
        "webglcontextlost",
        handleContextLost,
        false
      );

      canvas.removeEventListener(
        "webglcontextrestored",
        handleContextRestored,
        false
      );
    };
  }, [gl, onLost, onRestored]);

  return null;
}

/* =========================================================
   LIGHTNING FLASH
   - fires a train of 1-3 short "return stroke" pulses per
     event (real lightning almost never fires just once)
   - drives a pointLight positioned inside a real cloud
     cluster, so the light reads as coming from within the
     clouds rather than as a flat global brightness bump
   - also gives ambient/directional a smaller, secondary
     bump so the rest of the scene still catches some of it
========================================================= */

function LightningFlash({
  ambientRef,
  directionalRef,
  pointLightRef,
}) {
  const nextFlashTime = useRef(
    3 + Math.random() * 6
  );

  const flashTime = useRef(0);
  const flashDuration = useRef(0);
  const pulses = useRef([]);
  const peakStrength = useRef(0);

  const baseColor = useRef(
    new THREE.Color(1, 1, 1)
  );

  const flashColor = useRef(
    new THREE.Color("#eaf2ff")
  );

  const scratchColor = useRef(
    new THREE.Color()
  );

  /* -------------------------------------------------------
     Fast triangular pop for a single pulse - at these
     durations (30-60ms, 2-4 frames) a simple rise/fall
     reads as a real strike without needing a fancier curve.
  ------------------------------------------------------- */
  const pulseShape = (t) => {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
    return 1 - Math.abs(clamped * 2 - 1);
  };

  const triggerFlash = () => {
    const strength =
      1.5 + Math.random() * 0.9;

    peakStrength.current = strength;

    const pulseCount =
      Math.random() < 0.3
        ? 1
        : Math.random() < 0.65
        ? 2
        : 3;

    const built = [];
    let cursor = 0;

    for (let i = 0; i < pulseCount; i++) {
      const duration =
        0.03 + Math.random() * 0.03;

      const pulseStrength =
        i === 0
          ? strength
          : strength *
            (0.35 + Math.random() * 0.55);

      built.push({
        start: cursor,
        duration,
        strength: pulseStrength,
      });

      cursor +=
        duration +
        0.05 +
        Math.random() * 0.13;
    }

    pulses.current = built;

    // small trailing after-glow once the last pulse ends
    flashDuration.current = cursor + 0.18;
    flashTime.current = 0.0001;

    if (pointLightRef.current) {
      const [x, y, z] = pickWeightedCluster();
      pointLightRef.current.position.set(x, y, z);
    }
  };

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;

    /* =======================================================
       WAIT FOR NEXT LIGHTNING EVENT
    ======================================================= */

    if (
      flashTime.current <= 0 &&
      elapsed >= nextFlashTime.current
    ) {
      triggerFlash();
    }

    /* =======================================================
       ACTIVE FLASH
    ======================================================= */

    if (flashTime.current > 0) {
      flashTime.current += delta;

      const time = flashTime.current;

      let intensity = 0;

      /* -------------------------------------------------------
         SUM CONTRIBUTIONS FROM EACH RETURN-STROKE PULSE
      ------------------------------------------------------- */

      for (const pulse of pulses.current) {
        const localTime = time - pulse.start;

        if (
          localTime >= 0 &&
          localTime < pulse.duration
        ) {
          intensity +=
            pulse.strength *
            pulseShape(localTime / pulse.duration);
        }
      }

      /* -------------------------------------------------------
         SOFT AFTERGLOW AFTER THE LAST PULSE
      ------------------------------------------------------- */

      const lastPulse =
        pulses.current[pulses.current.length - 1];

      const lastPulseEnd = lastPulse
        ? lastPulse.start + lastPulse.duration
        : 0;

      if (
        intensity === 0 &&
        time >= lastPulseEnd &&
        time < flashDuration.current
      ) {
        const remaining =
          1 -
          (time - lastPulseEnd) /
            (flashDuration.current - lastPulseEnd);

        intensity =
          peakStrength.current *
          0.12 *
          Math.max(0, remaining);
      }

      /* -------------------------------------------------------
         END EVENT
      ------------------------------------------------------- */

      if (time >= flashDuration.current) {
        flashTime.current = 0;

        nextFlashTime.current =
          elapsed + 1.6 + Math.random() * 3.5;
      }

      /* -------------------------------------------------------
         APPLY: POINT LIGHT INSIDE THE CLOUDS DOES THE HEAVY
         LIFTING, AMBIENT/DIRECTIONAL GIVE A SMALLER GLOBAL KICK
      ------------------------------------------------------- */

      if (pointLightRef.current) {
        pointLightRef.current.intensity =
          intensity * 22;

        scratchColor.current
          .copy(baseColor.current)
          .lerp(
            flashColor.current,
            Math.min(1, intensity * 0.8)
          );

        pointLightRef.current.color.copy(
          scratchColor.current
        );
      }

      if (ambientRef.current) {
        ambientRef.current.intensity =
          1.2 + intensity * 2.4;
      }

      if (directionalRef.current) {
        directionalRef.current.intensity =
          1.1 + intensity * 3.0;
      }

      return;
    }

    /* =======================================================
       NORMAL LIGHTING (ease everything back to rest)
    ======================================================= */

    if (pointLightRef.current) {
      pointLightRef.current.intensity +=
        (0 - pointLightRef.current.intensity) *
        Math.min(1, delta * 16);
    }

    if (ambientRef.current) {
      ambientRef.current.intensity +=
        (1.2 - ambientRef.current.intensity) *
        Math.min(1, delta * 12);
    }

    if (directionalRef.current) {
      directionalRef.current.intensity +=
        (1.1 - directionalRef.current.intensity) *
        Math.min(1, delta * 12);
    }
  });

  return null;
}

/* =========================================================
   RADIAL STEAM
========================================================= */

function RadialVaporRing({ flashLightRef }) {
  const containerRef = useRef();

  const smoothScroll = useRef(0);
  const smoothDepth = useRef(0);
  const docHeightRef = useRef(1);

  useEffect(() => {
    const updateDocHeight = () => {
      const lenisInstance =
        typeof window !== "undefined"
          ? window.__lenis
          : null;

      if (
        lenisInstance &&
        typeof lenisInstance.limit === "number" &&
        lenisInstance.limit > 0
      ) {
        docHeightRef.current =
          lenisInstance.limit;
        return;
      }

      if (typeof document !== "undefined") {
        const docElement =
          document.documentElement;

        const viewportHeight =
          (typeof window !== "undefined" &&
            window.visualViewport &&
            window.visualViewport.height) ||
          (typeof window !== "undefined"
            ? window.innerHeight
            : 0);

        docHeightRef.current = docElement
          ? Math.max(
              1,
              docElement.scrollHeight -
                viewportHeight
            )
          : 1;
      }
    };

    updateDocHeight();

    const vv =
      typeof window !== "undefined"
        ? window.visualViewport
        : null;

    if (vv) {
      vv.addEventListener(
        "resize",
        updateDocHeight,
        { passive: true }
      );
    } else {
      window.addEventListener(
        "resize",
        updateDocHeight,
        { passive: true }
      );
    }

    window.addEventListener(
      "orientationchange",
      updateDocHeight,
      { passive: true }
    );

    return () => {
      if (vv) {
        vv.removeEventListener(
          "resize",
          updateDocHeight
        );
      } else {
        window.removeEventListener(
          "resize",
          updateDocHeight
        );
      }

      window.removeEventListener(
        "orientationchange",
        updateDocHeight
      );
    };
  }, []);

  useFrame((state, delta) => {
    const container = containerRef.current;

    if (!container) return;

    const lenisInstance =
      typeof window !== "undefined"
        ? window.__lenis
        : null;

    const actualScrollY =
      lenisInstance
        ? lenisInstance.scroll
        : typeof window !== "undefined"
        ? window.scrollY
        : 0;

    /* =======================================================
       TARGET SCROLL
    ======================================================= */

    scrollState.target = actualScrollY;

    smoothScroll.current +=
      (scrollState.target - smoothScroll.current) *
      Math.min(1, delta * 15);

    scrollState.current = smoothScroll.current;

    /* =======================================================
       DOCUMENT PROGRESS
    ======================================================= */

    const rawProgress = THREE.MathUtils.clamp(
      scrollState.current / docHeightRef.current,
      0,
      1
    );

    const progress = THREE.MathUtils.smoothstep(
      rawProgress,
      0,
      0.85
    );

    /* =======================================================
       CONTROLLED CLOUD PULL
    ======================================================= */

    const maxPull = 2.8;
    const targetDepth = progress * maxPull;

    smoothDepth.current +=
      (targetDepth - smoothDepth.current) *
      Math.min(1, delta * 4);

    container.position.z = smoothDepth.current;

    /* =======================================================
       CONTROLLED ZOOM
    ======================================================= */

    const maxZoom = 0.65;
    const zoom = progress * maxZoom;
    const finalScale = 1 + zoom;

    container.scale.set(
      finalScale,
      finalScale,
      finalScale
    );

    /* =======================================================
       SUBTLE LATERAL MOVEMENT
    ======================================================= */

    const lateral = progress * Math.PI * 1.25;

    container.position.x = Math.sin(lateral) * 0.18;
    container.position.y = Math.cos(lateral * 0.7) * 0.08;

    /* =======================================================
       SUBTLE ROTATION
    ======================================================= */

    const time = state.clock.elapsedTime;

    container.rotation.z = Math.sin(time * 0.18) * 0.018;
    container.rotation.x = Math.cos(time * 0.16) * 0.014;
  });

  return (
    <group ref={containerRef}>
      {/* =====================================================
          FLASH LIGHT - lives inside the same group as the
          clouds so it animates (scroll pull/zoom/drift) right
          along with them, and always looks co-located with a
          real cloud mass instead of floating in open space.
      ===================================================== */}
      <pointLight
        ref={flashLightRef}
        intensity={0}
        distance={14}
        decay={2}
        color="#eaf2ff"
      />

      <Clouds
        limit={24}
        frustumCulled={false}
        texture={CLOUD_URL}
      >

        {/* =================================================
            TOP ATMOSPHERE
        ================================================= */}

        <group position={CLOUD_CLUSTERS[0].pos}>
          <Cloud
            seed={12}
            scale={3.2}
            volume={26}
            color="#ffffff"
            opacity={0.25}
            fade={65}
            speed={0.25}
            growth={3.5}
          />
        </group>

        <group position={CLOUD_CLUSTERS[1].pos}>
          <Cloud
            seed={34}
            scale={3.3}
            volume={20}
            color="#e8e8e8"
            opacity={0.22}
            fade={65}
            speed={0.30}
            growth={2.2}
          />
        </group>

        {/* =================================================
            TOP CENTER ATMOSPHERE
        ================================================= */}

        <group position={CLOUD_CLUSTERS[2].pos}>
          <Cloud
            seed={91}
            scale={3.4}
            volume={15}
            color="#ffffff"
            opacity={0.09}
            fade={85}
            speed={0.10}
            growth={3}
          />
        </group>

        {/* =================================================
            BOTTOM ATMOSPHERE
        ================================================= */}

        <group position={CLOUD_CLUSTERS[3].pos}>
          <Cloud
            seed={56}
            scale={3.0}
            volume={10}
            color="#d0d0d0"
            opacity={0.10}
            fade={75}
            speed={0.2}
            growth={1.5}
          />
        </group>

        <group position={CLOUD_CLUSTERS[4].pos}>
          <Cloud
            seed={78}
            scale={3.2}
            volume={10}
            color="#ffffff"
            opacity={0.08}
            fade={75}
            speed={0.12}
            growth={3}
          />
        </group>

        {/* =================================================
            BOTTOM CENTER ATMOSPHERE
        ================================================= */}

        <group position={CLOUD_CLUSTERS[5].pos}>
          <Cloud
            seed={101}
            scale={3.2}
            volume={14}
            color="#eeeeee"
            opacity={0.08}
            fade={90}
            speed={0.12}
            growth={3}
          />
        </group>

      </Clouds>
    </group>
  );
}

/* =========================================================
   GLOBAL CINEMATIC FOG
========================================================= */

export default function GlobalCinematicFog() {
  const isClient = useIsClient();
  const viewportHeight = useViewportHeight();
  const [canvasKey, setCanvasKey] = useState(0);

  const ambientLightRef = useRef();
  const directionalLightRef = useRef();

  // point light rendered inside the cloud group in RadialVaporRing,
  // controlled from LightningFlash - this is what makes the strike
  // look like it's coming from inside the clouds
  const flashPointLightRef = useRef();

  if (!isClient) return null;

  return (
    <div
      className="
        fixed
        inset-0
        pointer-events-none
        z-40
        overflow-hidden
      "
      style={{
        width: "100%",
        // explicit pixel height synced to the real visual
        // viewport - falls back to 100dvh only for the very
        // first paint before the JS measurement lands
        height: viewportHeight
          ? `${viewportHeight}px`
          : "100dvh",
        pointerEvents: "none",
        touchAction: "none",
        transform: "translateZ(0)",
        WebkitTransform: "translate3d(0,0,0)",
        willChange: "transform, height",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      <WebGLSceneErrorBoundary key={canvasKey}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{
            position: [0, 0, 7],
            fov: 75,
          }}
          gl={{
            powerPreference: "high-performance",
            antialias: false,
            alpha: true,
            stencil: false,
          }}
          style={{
            pointerEvents: "none",
            touchAction: "none",
          }}
          events={() => ({
            enabled: false,
          })}
          onCreated={({ scene }) => {
            scene.fog = new THREE.FogExp2(
              "#0a0c10",
              0.001
            );
          }}
        >
          <WebGLContextGuard
            onRestored={() =>
              setCanvasKey((k) => k + 1)
            }
          />

          <ambientLight
            ref={ambientLightRef}
            intensity={1.2}
          />

          <directionalLight
            ref={directionalLightRef}
            position={[5, 10, 5]}
            intensity={1.1}
          />

          <LightningFlash
            ambientRef={ambientLightRef}
            directionalRef={directionalLightRef}
            pointLightRef={flashPointLightRef}
          />

          <Suspense fallback={null}>
            <RadialVaporRing
              flashLightRef={flashPointLightRef}
            />
          </Suspense>
        </Canvas>
      </WebGLSceneErrorBoundary>
    </div>
  );
}