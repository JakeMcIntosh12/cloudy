
"use client";

import React, {
  useRef,
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
   WEBGL CONTEXT GUARD
========================================================= */

function WebGLContextGuard() {
  const { gl } = useThree();

  useEffect(() => {
    if (!gl || !gl.domElement) return;

    const canvas = gl.domElement;

    const handleContextLost = (event) => {
      event.preventDefault();
    };

    canvas.addEventListener(
      "webglcontextlost",
      handleContextLost,
      false
    );

    return () => {
      canvas.removeEventListener(
        "webglcontextlost",
        handleContextLost,
        false
      );
    };
  }, [gl]);

  return null;
}

/* =========================================================
   RADIAL STEAM
========================================================= */

function RadialVaporRing() {
  const containerRef = useRef();

  const smoothScroll = useRef(0);
  const smoothDepth = useRef(0);
  const docHeightRef = useRef(1);

  useEffect(() => {
    const updateDocHeight = () => {
      if (typeof document !== "undefined") {
        const docElement = document.documentElement;

        docHeightRef.current = docElement
          ? Math.max(
              1,
              docElement.scrollHeight - window.innerHeight
            )
          : 1;
      }
    };

    updateDocHeight();

    window.addEventListener(
      "resize",
      updateDocHeight,
      { passive: true }
    );

    window.addEventListener(
      "orientationchange",
      updateDocHeight,
      { passive: true }
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateDocHeight
      );

      window.removeEventListener(
        "orientationchange",
        updateDocHeight
      );
    };
  }, []);

  useFrame((state, delta) => {
    const container = containerRef.current;

    if (!container) return;

    const actualScrollY =
      typeof window !== "undefined"
        ? window.scrollY
        : 0;

    /* =======================================================
       TARGET SCROLL
    ======================================================= */

    scrollState.target = actualScrollY;

    smoothScroll.current +=
      (scrollState.target - smoothScroll.current) *
      Math.min(1, delta * 15);

    scrollState.current =
      smoothScroll.current;

    /* =======================================================
       DOCUMENT PROGRESS
    ======================================================= */

    const rawProgress =
      THREE.MathUtils.clamp(
        scrollState.current /
          docHeightRef.current,
        0,
        1
      );

    const progress =
      THREE.MathUtils.smoothstep(
        rawProgress,
        0,
        0.85
      );

    /* =======================================================
       CONTROLLED CLOUD PULL
    ======================================================= */

    const maxPull = 2.8;

    const targetDepth =
      progress * maxPull;

    smoothDepth.current +=
      (targetDepth - smoothDepth.current) *
      Math.min(1, delta * 4);

    container.position.z =
      smoothDepth.current;

    /* =======================================================
       CONTROLLED ZOOM
    ======================================================= */

    const maxZoom = 0.65;

    const zoom =
      progress * maxZoom;

    const finalScale =
      1 + zoom;

    container.scale.set(
      finalScale,
      finalScale,
      finalScale
    );

    /* =======================================================
       SUBTLE LATERAL MOVEMENT
    ======================================================= */

    const lateral =
      progress * Math.PI * 1.25;

    container.position.x =
      Math.sin(lateral) * 0.18;

    container.position.y =
      Math.cos(lateral * 0.7) * 0.08;

    /* =======================================================
       SUBTLE ROTATION
    ======================================================= */

    const time =
      state.clock.elapsedTime;

    container.rotation.z =
      Math.sin(time * 0.18) * 0.018;

    container.rotation.x =
      Math.cos(time * 0.16) * 0.014;
  });

  return (
    <group ref={containerRef}>
      <Clouds
        limit={24}
        frustumCulled={false}
        texture={CLOUD_URL}
      >

        {/* =================================================
            TOP ATMOSPHERE
        ================================================= */}

        <group
          position={[-4.5, 5.2, -1.6]}
        >
          <Cloud
            seed={12}
            scale={3.2}
            volume={26}
            color="#ffffff"
            opacity={0.35}
            fade={65}
            speed={0.25}
            growth={3.5}
          />
        </group>

        <group
          position={[4.5, 5.2, -1.8]}
        >
          <Cloud
            seed={34}
            scale={3.5}
            volume={26}
            color="#e8e8e8"
            opacity={0.37}
            fade={65}
            speed={0.30}
            growth={2.2}
          />
        </group>

        {/* =================================================
            TOP CENTER ATMOSPHERE
        ================================================= */}

        <group
          position={[0, 5.8, -3.4]}
        >
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

        <group
          position={[-5.0, -5.0, -1.2]}
        >
          <Cloud
            seed={56}
            scale={3.0}
            volume={10}
            color="#d0d0d0"
            opacity={0.14}
            fade={75}
            speed={0.2}
            growth={1.5}
          />
        </group>

        <group
          position={[5.0, -5.0, -1.4]}
        >
          <Cloud
            seed={78}
            scale={3.2}
            volume={14}
            color="#ffffff"
            opacity={0.15}
            fade={75}
            speed={0.12}
            growth={3}
          />
        </group>

        {/* =================================================
            BOTTOM CENTER ATMOSPHERE
        ================================================= */}

        <group
          position={[0, -5.8, -3.2]}
        >
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
        height: "100%",
        minHeight: "100dvh",
        pointerEvents: "none",
        touchAction: "none",
      }}
    >
      <WebGLSceneErrorBoundary>
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
          <WebGLContextGuard />

          <ambientLight intensity={1.2} />

          <directionalLight
            position={[5, 10, 5]}
            intensity={1.1}
          />

          <Suspense fallback={null}>
            <RadialVaporRing />
          </Suspense>
        </Canvas>
      </WebGLSceneErrorBoundary>
    </div>
  );
}

