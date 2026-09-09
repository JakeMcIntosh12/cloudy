'use client'

import React, {
  useRef,
  useEffect,
  useMemo
} from 'react'

import {
  Canvas,
  useThree,
  useFrame
} from '@react-three/fiber'

import * as THREE from 'three'
import gsap from 'gsap'
import Hls from 'hls.js'


const SmudgeTransitionShader = {

  uniforms: {

    uTextureA: { value: null },
    uTextureB: { value: null },

    uProgress: { value: 0 },

    uDirection: { value: 1.0 },

    uResolution: {
      value: new THREE.Vector2(1, 1)
    },

    uVideoResA: {
      value: new THREE.Vector2(16, 9)
    },

    uVideoResB: {
      value: new THREE.Vector2(16, 9)
    },

    uHover: { value: 0 },

    uTime: { value: 0 },

    uMouse: {
      value: new THREE.Vector2(0.5, 0.5)
    }

  },


  vertexShader: `

    varying vec2 vUv;

    void main() {

      vUv = uv;

      gl_Position =
        vec4(position, 1.0);

    }

  `,


  fragmentShader: `

    uniform sampler2D uTextureA;
    uniform sampler2D uTextureB;

    uniform float uProgress;
    uniform float uDirection;

    uniform vec2 uResolution;

    uniform vec2 uVideoResA;
    uniform vec2 uVideoResB;

    uniform float uHover;
    uniform float uTime;

    uniform vec2 uMouse;

    varying vec2 vUv;


    vec2 getCoverUv(
      vec2 uv,
      vec2 screenRes,
      vec2 mediaRes
    ) {

      float screenAspect =
        screenRes.x / screenRes.y;

      float mediaAspect =
        mediaRes.x / mediaRes.y;


      vec2 ratio = vec2(

        min(
          screenAspect / mediaAspect,
          1.0
        ),

        min(
          (1.0 / screenAspect) /
          (1.0 / mediaAspect),
          1.0
        )

      );


      return vec2(

        uv.x * ratio.x +
        (1.0 - ratio.x) * 0.5,

        uv.y * ratio.y +
        (1.0 - ratio.y) * 0.5

      );

    }


    vec3 permute(vec3 x) {

      return mod(
        ((x * 34.0) + 1.0) * x,
        289.0
      );

    }


    float snoise(vec2 v) {

      const vec4 C = vec4(

        0.211324865405187,

        0.366025403784439,

        -0.577350269189626,

        0.024390243902439

      );


      vec2 i =
        floor(
          v +
          dot(v, C.yy)
        );


      vec2 x0 =
        v -
        i +
        dot(i, C.xx);


      vec2 i1;

      i1 =
        (x0.x > x0.y)
          ? vec2(1.0, 0.0)
          : vec2(0.0, 1.0);


      vec4 x12 =
        x0.xyxy +
        C.xxzz;


      x12.xy -= i1;


      i =
        mod(i, 289.0);


      vec3 p =
        permute(

          permute(

            i.y +
            vec3(
              0.0,
              i1.y,
              1.0
            )

          )

          + i.x

          + vec3(
              0.0,
              i1.x,
              1.0
            )

        );


      vec3 m =
        max(

          0.5 -
          vec3(

            dot(x0, x0),

            dot(
              x12.xy,
              x12.xy
            ),

            dot(
              x12.zw,
              x12.zw
            )

          ),

          0.0

        );


      m = m * m;
      m = m * m;


      vec3 x =
        2.0 *
        fract(p * C.www) -
        1.0;


      vec3 h =
        abs(x) -
        0.5;


      vec3 ox =
        floor(x + 0.5);


      vec3 a0 =
        x -
        ox;


      m *=
        1.79284291400159 -
        0.85373472095314 *
        (
          a0 * a0 +
          h * h
        );


      vec3 g;


      g.x =
        a0.x * x0.x +
        h.x * x0.y;


      g.yz =
        a0.yz * x12.xz +
        h.yz * x12.yw;


      return 130.0 *
        dot(m, g);

    }


    void main() {

      // =====================================================
      // ORIGINAL TRANSITION LOGIC — UNTOUCHED
      // =====================================================

      float transitionVelocity =
        sin(
          uProgress *
          3.14159265
        );


      float noiseVal =
        snoise(

          vUv * 3.5 +

          vec2(

            uProgress * 1.8,

            uProgress * 0.8

          )

        );


      float secondaryNoise =
        snoise(

          vUv * 8.0 -

          vec2(
            uProgress * 2.5
          )

        );


      // =====================================================
      // CINEMATIC HOVER — DYNAMIC DOLLY PUSH-IN
      // =====================================================

      vec2 mouseDelta =
        vUv -
        uMouse;


      mouseDelta.x *=
        uResolution.x /
        uResolution.y;


      float mouseDistance =
        length(
          mouseDelta
        );


      float spotlight =
        smoothstep(
          0.78,
          0.0,
          mouseDistance
        )
        *
        uHover;


      // Increased movement
      float dollyAmount =
        uHover * 0.075;


      vec2 dollyUv =
        uMouse +
        (vUv - uMouse) *
        (1.0 - dollyAmount);


      // Subtle directional movement following the cursor
      vec2 cursorDrift =
        mouseDelta *
        uHover *
        0.018;


      dollyUv +=
        cursorDrift;


      vec2 uvA =
        getCoverUv(
          dollyUv,
          uResolution,
          uVideoResA
        );


      vec2 uvB =
        getCoverUv(
          dollyUv,
          uResolution,
          uVideoResB
        );


      vec2 distortedUvA =
        uvA;


      vec2 distortedUvB =
        uvB;


      // =====================================================
      // ORIGINAL TRANSITION SMUDGE — UNTOUCHED
      // =====================================================

      vec2 smudgeOffset =
        vec2(

          noiseVal * 0.18 +
          secondaryNoise * 0.06,

          snoise(
            vUv * 4.5
          ) * 0.12

        )
        *
        transitionVelocity
        *
        uDirection;


      distortedUvA +=
        smudgeOffset;


      distortedUvB -=
        smudgeOffset *
        (1.0 - uProgress);


      // =====================================================
      // GATE WEAVE
      // =====================================================

      vec2 weave =
        vec2(

          snoise(
            vec2(
              uTime * 0.55,
              11.0
            )
          ),

          snoise(
            vec2(
              31.0,
              uTime * 0.5
            )
          )

        )
        *
        uHover
        *
        0.005;


      distortedUvA +=
        weave;


      distortedUvB +=
        weave;


      // =====================================================
      // CHROMATIC ABERRATION
      // =====================================================

      float transitionRgb =
        transitionVelocity *
        0.028 *
        uDirection;


      vec2 abDir =
        mouseDistance > 0.0001
          ? normalize(mouseDelta)
          : vec2(1.0, 0.0);


      float hoverFade =
        smoothstep(
          0.0,
          1.0,
          uHover
        );


      float hoverRgb =
        spotlight *
        hoverFade *
        0.018;


      float rgbSplit =
        transitionRgb +
        hoverRgb;


      // =====================================================
      // TEXTURE A
      // =====================================================

      vec4 colA =
        vec4(0.0);


      colA.r =
        texture2D(

          uTextureA,

          distortedUvA +

          abDir *
          rgbSplit

        ).r;


      colA.g =
        texture2D(

          uTextureA,

          distortedUvA

        ).g;


      colA.b =
        texture2D(

          uTextureA,

          distortedUvA -

          abDir *
          rgbSplit

        ).b;


      colA.a =
        1.0;


      // =====================================================
      // TEXTURE B
      // =====================================================

      vec4 colB =
        vec4(0.0);


      colB.r =
        texture2D(

          uTextureB,

          distortedUvB -

          abDir *
          rgbSplit *
          0.8

        ).r;


      colB.g =
        texture2D(

          uTextureB,

          distortedUvB

        ).g;


      colB.b =
        texture2D(

          uTextureB,

          distortedUvB +

          abDir *
          rgbSplit *
          0.8

        ).b;


      colB.a =
        1.0;


      // =====================================================
      // ORIGINAL TRANSITION MASK — UNTOUCHED
      // =====================================================

      float maskX =
        uDirection > 0.0
          ? vUv.x
          : (1.0 - vUv.x);


      float organicEdge =
        maskX +
        noiseVal * 0.25;


      float mask =
        smoothstep(

          0.0,

          1.0,

          (
            uProgress * 1.5 -
            organicEdge * 0.5
          )

        );


      vec4 finalColor =
        mix(
          colA,
          colB,
          mask
        );


      float edgeHighlight =
        smoothstep(

          0.0,

          0.1,

          1.0 -
          abs(mask - 0.5) * 2.0

        )
        *
        transitionVelocity;


      finalColor.rgb +=

        vec3(
          0.85,
          0.9,
          1.0
        )
        *
        edgeHighlight
        *
        0.15;


      gl_FragColor =
        finalColor;

    }

  `
}


// =========================================================
// VIDEO CREATION
// =========================================================

function createOptimizedVideoElement() {

  const video =
    document.createElement('video')


  video.muted =
    true

  video.loop =
    true

  video.playsInline =
    true


  video.setAttribute(
    'playsinline',
    'true'
  )


  video.setAttribute(
    'webkit-playsinline',
    'true'
  )


  video.crossOrigin =
    'anonymous'


  video.preload =
    'metadata'


  return video
}


// =========================================================
// SAFE VIDEO PLAY
// =========================================================

async function safePlayVideo(
  video,
  unmute = false
) {

  if (!video) {
    return
  }


  if (unmute) {

    video.muted =
      false

    video.volume =
      1.0

  }


  try {

    await video.play()

  }

  catch (err) {

    if (

      err.name ===
      'NotAllowedError'

      ||

      err.message?.includes(
        "user didn't interact"
      )

    ) {

      video.muted =
        true


      try {

        await video.play()

      }

      catch (e) {

        // Browser still prevented playback.

      }

    }

    else if (
      err.name !==
      'AbortError'
    ) {

      console.warn(
        'Video playback warning:',
        err
      )

    }

  }

}


// =========================================================
// GET VIDEO DIMENSIONS
// =========================================================

function getVideoDimensions(
  video
) {

  if (

    video &&

    video.videoWidth > 0 &&

    video.videoHeight > 0

  ) {

    return {

      width:
        video.videoWidth,

      height:
        video.videoHeight

    }

  }


  return {

    width:
      16,

    height:
      9

  }

}


// =========================================================
// UPDATE VIDEO RESOLUTION
// =========================================================

function updateVideoResolution(
  material,
  uniformName,
  video
) {

  if (
    !material ||
    !video
  ) {

    return

  }


  const {
    width,
    height
  } =
    getVideoDimensions(
      video
    )


  material.uniforms[
    uniformName
  ].value.set(
    width,
    height
  )

}


// =========================================================
// ATTACH HD HLS SOURCE
// =========================================================

function attachHdHlsSource(video, src, hlsRef) {

  if (hlsRef.current) {
    hlsRef.current.destroy()
    hlsRef.current = null
  }

  video.pause()
  video.removeAttribute('src')
  video.load()

  // Safari — native HLS support
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src
    video.load()
    return
  }

  // Chrome / Firefox / Edge — via hls.js, forced to top rendition
  if (Hls.isSupported()) {

    const hls = new Hls({
      enableWorker: true,
      capLevelToPlayerSize: false,
      startLevel: -1,
    })

    hlsRef.current = hls

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (hls.levels && hls.levels.length > 0) {
        hls.currentLevel = hls.levels.length - 1
      }
    })

    hls.loadSource(src)
    hls.attachMedia(video)
  }
}


// =========================================================
// SHADER PLANE
// =========================================================

function ShaderPlane({

  activeSrc,

  nextSrc,

  isTransitioning,

  isHovered,

  onTransitionComplete,

  onVideoInit

}) {

  const materialRef =
    useRef()


  const dirRef =
    useRef(1.0)


  const {
    size,
    gl
  } =
    useThree()


  const videoARef =
    useRef(null)


  const videoBRef =
    useRef(null)


  const texARef =
    useRef(null)


  const texBRef =
    useRef(null)


  const hlsARef =
    useRef(null)


  const hlsBRef =
    useRef(null)


  const srcARef =
    useRef(null)


  const srcBRef =
    useRef(null)


  const tweenRef =
    useRef(null)


  const hoverTweenRef =
    useRef(null)


  const idleTimeoutRef =
    useRef(null)


  const isHoveredRef =
    useRef(false)


  const activeSlotRef =
    useRef(0)


  // =======================================================
  // MOUSE POSITION
  // =======================================================

  const targetMouseRef =
    useRef(

      new THREE.Vector2(
        0.5,
        0.5
      )

    )


  const smoothMouseRef =
    useRef(

      new THREE.Vector2(
        0.5,
        0.5
      )

    )


  // =======================================================
  // ANIMATION LOOP
  // =======================================================

  useFrame(
    (_, delta) => {

      if (
        materialRef.current
      ) {

        materialRef.current
          .uniforms
          .uTime
          .value +=
          delta

      }


      if (
        materialRef.current
      ) {

        const current =
          smoothMouseRef.current


        const target =
          targetMouseRef.current


        const followSpeed =
          4.2


        const interpolation =
          1 -
          Math.exp(
            -followSpeed *
            delta
          )


        current.lerp(
          target,
          interpolation
        )


        materialRef.current
          .uniforms
          .uMouse
          .value.copy(
            current
          )

      }

    }
  )


  // =======================================================
  // CURSOR TRACKING + IDLE-DRIVEN HOVER REVEAL
  // =======================================================

  useEffect(() => {

    isHoveredRef.current =
      isHovered


    if (
      !isHovered &&
      materialRef.current
    ) {

      if (
        idleTimeoutRef.current
      ) {

        clearTimeout(
          idleTimeoutRef.current
        )

        idleTimeoutRef.current =
          null

      }


      if (
        hoverTweenRef.current
      ) {

        hoverTweenRef.current.kill()

      }


      hoverTweenRef.current =
        gsap.to(

          materialRef.current
            .uniforms
            .uHover,

          {

            value:
              0.0,

            duration:
              1.4,

            ease:
              'power2.inOut'

          }

        )

    }

  }, [
    isHovered
  ])


  useEffect(() => {

    const idleDelay =
      450


    const wakeDuration =
      0.6


    const sleepDuration =
      1.2


    const handleMouseMove =
      (event) => {

        if (
          !materialRef.current
        ) {

          return

        }


        const rect =
          gl.domElement
            .getBoundingClientRect()


        if (
          rect.width === 0 ||
          rect.height === 0
        ) {

          return

        }


        const x =
          (
            event.clientX -
            rect.left
          ) /
          rect.width


        const y =
          1 -
          (
            (
              event.clientY -
              rect.top
            ) /
            rect.height
          )


        targetMouseRef.current.set(
          x,
          y
        )


        if (
          !isHoveredRef.current
        ) {

          return

        }


        // wake — the cursor is actively moving

        if (
          hoverTweenRef.current
        ) {

          hoverTweenRef.current.kill()

        }


        hoverTweenRef.current =
          gsap.to(

            materialRef.current
              .uniforms
              .uHover,

            {

              value:
                1.0,

              duration:
                wakeDuration,

              ease:
                'power2.out'

            }

          )


        // reset the idle timer — sleep only fires once
        // movement actually stops for idleDelay ms

        if (
          idleTimeoutRef.current
        ) {

          clearTimeout(
            idleTimeoutRef.current
          )

        }


        idleTimeoutRef.current =
          setTimeout(

            () => {

              if (
                !materialRef.current
              ) {

                return

              }


              if (
                hoverTweenRef.current
              ) {

                hoverTweenRef.current.kill()

              }


              hoverTweenRef.current =
                gsap.to(

                  materialRef.current
                    .uniforms
                    .uHover,

                  {

                    value:
                      0.0,

                    duration:
                      sleepDuration,

                    ease:
                      'power2.inOut'

                  }

                )

            },

            idleDelay

          )

      }


    window.addEventListener(
      'mousemove',
      handleMouseMove
    )


    return () => {

      window.removeEventListener(
        'mousemove',
        handleMouseMove
      )


      if (
        idleTimeoutRef.current
      ) {

        clearTimeout(
          idleTimeoutRef.current
        )

      }

    }

  }, [
    gl
  ])


  // =======================================================
  // SHADER MATERIAL
  // =======================================================

  const shaderArgs =
    useMemo(() => {

      return {

        uniforms:
          THREE.UniformsUtils.clone(
            SmudgeTransitionShader.uniforms
          ),

        vertexShader:
          SmudgeTransitionShader
            .vertexShader,

        fragmentShader:
          SmudgeTransitionShader
            .fragmentShader

      }

    }, [])


  // =======================================================
  // VIDEO + TEXTURE INITIALIZATION
  // =======================================================

  useEffect(() => {

    if (
      !videoARef.current
    ) {

      videoARef.current =
        createOptimizedVideoElement()


      const texA =
        new THREE.VideoTexture(
          videoARef.current
        )


      texA.minFilter =
        THREE.LinearFilter

      texA.magFilter =
        THREE.LinearFilter

      texA.generateMipmaps =
        false


      texARef.current =
        texA

    }


    if (
      !videoBRef.current
    ) {

      videoBRef.current =
        createOptimizedVideoElement()


      const texB =
        new THREE.VideoTexture(
          videoBRef.current
        )


      texB.minFilter =
        THREE.LinearFilter

      texB.magFilter =
        THREE.LinearFilter

      texB.generateMipmaps =
        false


      texBRef.current =
        texB

    }


    return () => {

      if (
        tweenRef.current
      ) {

        tweenRef.current.kill()

      }


      if (
        hoverTweenRef.current
      ) {

        hoverTweenRef.current.kill()

      }


      if (
        hlsARef.current
      ) {

        hlsARef.current.destroy()

        hlsARef.current =
          null

      }


      if (
        videoARef.current
      ) {

        videoARef.current.pause()

        videoARef.current.removeAttribute(
          'src'
        )

        videoARef.current.load()

        videoARef.current =
          null

      }


      if (
        texARef.current
      ) {

        texARef.current.dispose()

        texARef.current =
          null

      }


      if (
        hlsBRef.current
      ) {

        hlsBRef.current.destroy()

        hlsBRef.current =
          null

      }


      if (
        videoBRef.current
      ) {

        videoBRef.current.pause()

        videoBRef.current.removeAttribute(
          'src'
        )

        videoBRef.current.load()

        videoBRef.current =
          null

      }


      if (
        texBRef.current
      ) {

        texBRef.current.dispose()

        texBRef.current =
          null

      }

    }

  }, [])


  // =========================================================
  // WEBGL CONTEXT LOSS
  // =========================================================

  useEffect(() => {

    const canvasEl =
      gl.domElement


    const handleContextLost =
      (event) => {

        event.preventDefault()


        if (
          tweenRef.current
        ) {

          tweenRef.current.pause()

        }

      }


    const handleContextRestored =
      () => {

        gl.resetState()


        if (
          texARef.current
        ) {

          texARef.current.needsUpdate =
            true

        }


        if (
          texBRef.current
        ) {

          texBRef.current.needsUpdate =
            true

        }

      }


    canvasEl.addEventListener(
      'webglcontextlost',
      handleContextLost,
      false
    )


    canvasEl.addEventListener(
      'webglcontextrestored',
      handleContextRestored,
      false
    )


    return () => {

      canvasEl.removeEventListener(
        'webglcontextlost',
        handleContextLost
      )


      canvasEl.removeEventListener(
        'webglcontextrestored',
        handleContextRestored
      )

    }

  }, [
    gl
  ])


  // =========================================================
  // SCREEN RESOLUTION
  // =========================================================

  useEffect(() => {

    if (
      materialRef.current
    ) {

      materialRef.current
        .uniforms
        .uResolution
        .value
        .set(
          size.width,
          size.height
        )

    }

  }, [
    size
  ])


  // =========================================================
  // ACTIVE VIDEO
  // =========================================================

  useEffect(() => {

    const currentVideo =
      activeSlotRef.current === 0

        ? videoARef.current

        : videoBRef.current


    if (
      !currentVideo ||
      !activeSrc
    ) {

      return

    }


    const targetSrc =
      activeSrc


    const isSlotA =
      activeSlotRef.current === 0


    const currentSrcRef =
      isSlotA
        ? srcARef
        : srcBRef


    const currentHlsRef =
      isSlotA
        ? hlsARef
        : hlsBRef


    if (
      currentSrcRef.current !==
      targetSrc
    ) {

      currentSrcRef.current =
        targetSrc


      attachHdHlsSource(
        currentVideo,
        targetSrc,
        currentHlsRef
      )


      currentVideo.currentTime =
        0


      currentVideo.onloadedmetadata =
        () => {

          if (
            !materialRef.current
          ) {

            return

          }


          const uniformName =
            activeSlotRef.current === 0

              ? 'uVideoResA'

              : 'uVideoResB'


          updateVideoResolution(

            materialRef.current,

            uniformName,

            currentVideo

          )

        }


      currentVideo.onloadeddata =
        () => {

          if (
            !materialRef.current
          ) {

            return

          }


          const uniformName =
            activeSlotRef.current === 0

              ? 'uVideoResA'

              : 'uVideoResB'


          updateVideoResolution(

            materialRef.current,

            uniformName,

            currentVideo

          )

        }


      safePlayVideo(
        currentVideo,
        false
      )

    }

    else {

      const uniformName =
        activeSlotRef.current === 0

          ? 'uVideoResA'

          : 'uVideoResB'


      updateVideoResolution(

        materialRef.current,

        uniformName,

        currentVideo

      )


      if (
        currentVideo.paused
      ) {

        safePlayVideo(
          currentVideo,
          false
        )

      }

    }


    if (
      onVideoInit
    ) {

      onVideoInit(
        currentVideo
      )

    }


    if (
      materialRef.current
    ) {

      const activeTex =
        activeSlotRef.current === 0

          ? texARef.current

          : texBRef.current


      materialRef.current
        .uniforms
        .uTextureA
        .value =
        activeTex


      materialRef.current
        .uniforms
        .uTextureB
        .value =
        activeTex

    }

  }, [
    activeSrc,
    onVideoInit
  ])


  // =========================================================
  // TRANSITION
  // =========================================================

  useEffect(() => {

    if (
      !isTransitioning ||
      !nextSrc
    ) {

      return

    }


    const isSlotZero =
      activeSlotRef.current === 0


    const outgoingVideo =
      isSlotZero

        ? videoARef.current

        : videoBRef.current


    const incomingVideo =
      isSlotZero

        ? videoBRef.current

        : videoARef.current


    const outgoingTex =
      isSlotZero

        ? texARef.current

        : texBRef.current


    const incomingTex =
      isSlotZero

        ? texBRef.current

        : texARef.current


    if (
      !incomingVideo ||
      !materialRef.current
    ) {

      return

    }


    // =====================================================
    // LOAD NEXT VIDEO
    // =====================================================

    const incomingHlsRef =
      isSlotZero
        ? hlsBRef
        : hlsARef


    const incomingSrcRef =
      isSlotZero
        ? srcBRef
        : srcARef


    incomingSrcRef.current =
      nextSrc


    attachHdHlsSource(
      incomingVideo,
      nextSrc,
      incomingHlsRef
    )


    incomingVideo.currentTime =
      0


    const incomingUniform =
      isSlotZero

        ? 'uVideoResB'

        : 'uVideoResA'


    incomingVideo.onloadedmetadata =
      () => {

        if (
          materialRef.current
        ) {

          updateVideoResolution(

            materialRef.current,

            incomingUniform,

            incomingVideo

          )

        }

      }


    incomingVideo.onloadeddata =
      () => {

        if (
          materialRef.current
        ) {

          updateVideoResolution(

            materialRef.current,

            incomingUniform,

            incomingVideo

          )

        }

      }


    // =====================================================
    // PLAY NEXT VIDEO
    // =====================================================

    safePlayVideo(
      incomingVideo,
      false
    )


    // =====================================================
    // FADE OUTGOING AUDIO
    // =====================================================

    if (
      outgoingVideo
    ) {

      gsap.to(

        outgoingVideo,

        {

          volume:
            0,

          duration:
            1.0

        }

      )

    }


    // =====================================================
    // SHADER TEXTURES
    // =====================================================

    materialRef.current
      .uniforms
      .uTextureA
      .value =
      outgoingTex


    materialRef.current
      .uniforms
      .uTextureB
      .value =
      incomingTex


    materialRef.current
      .uniforms
      .uDirection
      .value =
      dirRef.current


    // =====================================================
    // ORIGINAL TRANSITION
    // =====================================================

    if (
      tweenRef.current
    ) {

      tweenRef.current.kill()

    }


    tweenRef.current =
      gsap.fromTo(

        materialRef.current
          .uniforms
          .uProgress,

        {

          value:
            0

        },

        {

          value:
            1,

          duration:
            1.3,

          ease:
            'power2.inOut',


          onComplete: () => {

            if (
              materialRef.current
            ) {

              materialRef.current
                .uniforms
                .uTextureA
                .value =
                incomingTex


              materialRef.current
                .uniforms
                .uTextureB
                .value =
                incomingTex


              materialRef.current
                .uniforms
                .uProgress
                .value =
                0

            }


            activeSlotRef.current =
              isSlotZero
                ? 1
                : 0


            dirRef.current *=
              -1.0


            if (
              outgoingVideo
            ) {

              outgoingVideo.pause()

              outgoingVideo.currentTime =
                0

            }


            if (
              materialRef.current
            ) {

              const activeUniform =
                isSlotZero

                  ? 'uVideoResB'

                  : 'uVideoResA'


              updateVideoResolution(

                materialRef.current,

                activeUniform,

                incomingVideo

              )

            }


            onTransitionComplete()


            if (
              onVideoInit
            ) {

              onVideoInit(
                incomingVideo
              )

            }

          }

        }

      )

  }, [

    isTransitioning,

    nextSrc,

    onTransitionComplete,

    onVideoInit

  ])


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <mesh>

      <planeGeometry
        args={[
          2,
          2
        ]}
      />

      <shaderMaterial

        ref={
          materialRef
        }

        args={[
          shaderArgs
        ]}

        depthTest={
          false
        }

        depthWrite={
          false
        }

      />

    </mesh>

  )

}


// =========================================================
// HERO CANVAS
// =========================================================

export default function HeroCanvas({

  activeSrc,

  nextSrc,

  isTransitioning,

  onTransitionComplete,

  onVideoInit

}) {

  const [
    isHovered,
    setIsHovered
  ] =
    React.useState(
      false
    )


  const containerRef =
    React.useRef(
      null
    )


  // =======================================================
  // HOVER DETECTION
  // =======================================================

  React.useEffect(() => {

    const handleMouseMove =
      (event) => {

        if (
          !containerRef.current
        ) {

          return

        }


        const rect =
          containerRef.current
            .getBoundingClientRect()


        const isInside =

          event.clientX >=
            rect.left &&

          event.clientX <=
            rect.right &&

          event.clientY >=
            rect.top &&

          event.clientY <=
            rect.bottom


        setIsHovered(
          isInside
        )

      }


    const handleMouseLeaveWindow =
      () => {

        setIsHovered(
          false
        )

      }


    window.addEventListener(
      'mousemove',
      handleMouseMove
    )


    window.addEventListener(
      'mouseleave',
      handleMouseLeaveWindow
    )


    return () => {

      window.removeEventListener(
        'mousemove',
        handleMouseMove
      )


      window.removeEventListener(
        'mouseleave',
        handleMouseLeaveWindow
      )

    }

  }, [])


  return (

    <div

      ref={
        containerRef
      }

      className="
        absolute
        inset-0
        w-full
        h-full
        z-0
        pointer-events-auto
        opacity-90
        bg-zinc-900
      "

    >

      <Canvas

        camera={{
          position: [
            0,
            0,
            1
          ]
        }}


        gl={{

          powerPreference:
            'high-performance',

          antialias:
            false,

          preserveDrawingBuffer:
            false,

          failIfMajorPerformanceCaveat:
            false

        }}


        dpr={[
          1,
          1.5
        ]}


        frameloop="always"


        onCreated={( {
          gl
        }) => {

          gl.domElement.addEventListener(

            'webglcontextlost',

            (e) =>
              e.preventDefault(),

            false

          )

        }}


      >

        <ShaderPlane

          activeSrc={
            activeSrc
          }

          nextSrc={
            nextSrc
          }

          isTransitioning={
            isTransitioning
          }

          isHovered={
            isHovered
          }

          onTransitionComplete={
            onTransitionComplete
          }

          onVideoInit={
            onVideoInit
          }

        />

      </Canvas>

    </div>

  )

}