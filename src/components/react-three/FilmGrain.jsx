"use client";

import React, {
useRef,
useMemo,
useEffect,
} from "react";

import {
Canvas,
useThree,
useFrame,
} from "@react-three/fiber";

import * as THREE from "three";

const FilmGrainShader = {
uniforms: {
uTime: { value: 0 },


uResolution: {
  value: new THREE.Vector2(1, 1),
},

uIntensity: {
  value: 0.08,
},


},

vertexShader: `
varying vec2 vUv;


void main() {
  vUv = uv;

  gl_Position = vec4(
    position,
    1.0
  );
}


`,

fragmentShader: `
uniform float uTime;
uniform vec2 uResolution;
uniform float uIntensity;


varying vec2 vUv;

float hash(vec2 p) {
  return fract(
    sin(
      dot(
        p,
        vec2(
          12.9898,
          78.233
        )
      )
    )
    * 43758.5453123
  );
}

void main() {
  float grainNoise =
    hash(
      vUv *
      uResolution.xy *
      0.75
      +
      vec2(
        uTime * 97.0,
        uTime * 61.0
      )
    );

  float grainCoarse =
    hash(
      floor(
        vUv *
        uResolution.xy *
        0.18
      )
      +
      vec2(
        uTime * 43.0,
        uTime * 29.0
      )
    );

  float grain =
    (grainNoise - 0.5)
    *
    0.7
    +
    (grainCoarse - 0.5)
    *
    0.3;

  float value =
    0.5
    +
    grain *
    uIntensity;

  gl_FragColor =
    vec4(
      vec3(value),
      1.0
    );
}


`,
};

// =========================================================
// GRAIN PLANE
// =========================================================

function GrainPlane({ intensity }) {
const materialRef = useRef(null);

const { size } = useThree();

/*
Clone uniforms once on mount.
*/

const shaderArgs = useMemo(() => {
return {
uniforms:
THREE.UniformsUtils.clone(
FilmGrainShader.uniforms
),


  vertexShader:
    FilmGrainShader.vertexShader,

  fragmentShader:
    FilmGrainShader.fragmentShader,
};


}, []);

/*
Keep resolution synced with the canvas.
*/

useEffect(() => {
if (!materialRef.current) return;


materialRef.current.uniforms
  .uResolution.value.set(
    size.width,
    size.height
  );


}, [
size.width,
size.height,
]);

/*
Keep intensity synced.
*/

useEffect(() => {
if (!materialRef.current) return;


materialRef.current.uniforms
  .uIntensity.value = intensity;


}, [intensity]);

/*
Animate grain without React state.
*/

useFrame((_, delta) => {
if (!materialRef.current) return;


materialRef.current.uniforms
  .uTime.value += delta;


});

return ( <mesh
   frustumCulled={false}
   renderOrder={9999}
 >
<planeGeometry
args={[2, 2]}
/>

```
  <shaderMaterial
    ref={materialRef}
    args={[shaderArgs]}
    depthTest={false}
    depthWrite={false}
    transparent={false}
  />
</mesh>


);
}

// =========================================================
// FILM GRAIN
// =========================================================

export default function FilmGrain({
intensity = 0.08,
blendMode = "overlay",
disabled = false,
className = "",
style = {},
}) {
if (disabled) {
return null;
}

return (
<div
aria-hidden="true"
className={className}
style={{
/*
---------------------------------------------------
FULL VIEWPORT OVERLAY
---------------------------------------------------
*/


    position: "fixed",
    inset: 0,

    width: "100%",
    height: "100%",
    minHeight: "100dvh",

    /*
      Keep the grain independent from page layout.
    */

    overflow: "hidden",

    /*
      Never intercept interaction.
    */

    pointerEvents: "none",

    /*
      Keep grain above everything else.
    */

    zIndex: 9999,

    /*
      Preserve existing blend mode.
    */

    mixBlendMode: blendMode,

    /*
      IMPORTANT:
      Do NOT force translate3d/translateZ here.

      Mobile browsers can turn a transformed fixed
      WebGL element into a separate compositor surface,
      which can visually detach during scrolling.
    */

    /*
      Do NOT isolate this layer.

      mix-blend-mode needs to composite naturally
      with the content underneath it.
    */

    touchAction: "none",

    /*
      Preserve anything passed into the component.
    */

    ...style,
  }}
>
  <Canvas
    gl={{
      powerPreference:
        "low-power",

      antialias: false,

      alpha: false,

      stencil: false,

      depth: false,

      precision: "lowp",

      preserveDrawingBuffer:
        false,
    }}

    dpr={[1, 1]}

    frameloop="always"

    events={() => ({
      enabled: false,
    })}

    camera={{
      position: [0, 0, 1],
    }}

    style={{
  pointerEvents: "none",
  touchAction: "none",
}}
  >
    <GrainPlane
      intensity={intensity}
    />
  </Canvas>
</div>


);
}
