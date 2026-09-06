"use client"

import Controls from '@/components/UI/Controls'
import Navigation from '@/components/UI/Navigation'
import HeroCanvas from '@/components/react-three/HeroCanvas'
import { client } from '@/lib/client'

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo
} from 'react'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

// =========================================================
// INTERACTION GUIDE VIDEO
// =========================================================

const INTERACTION_GUIDE_VIDEO = '/Images/guide.mp4'

// =========================================================
// HELPER TO OPTIMIZE CLOUDINARY URLS SPECIFICALLY FOR
// MOBILE DEVICES
// =========================================================

const getMobileOptimizedUrl = (url) => {
  if (!url) return url

  if (
    typeof window !== 'undefined' &&
    window.innerWidth <= 768
  ) {
    return url.replace(
      '/upload/',
      '/upload/q_auto,f_auto,w_720,vc_h264/'
    )
  }

  return url
}

const BOTTOM_TEXT =
  "VISUAL STUDIO FOR HIGH-END ARCHITECTURE AND CONSTRUCTION BASED IN ADELAIDE"

const HOME_CONTENT_QUERY = `
  *[
    _type == "homeContent"
  ][0]
  {
    "heroVideo": heroVideo.asset->url
  }
`

function Home() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const [nextIndex, setNextIndex] = useState(null)

  const [isTransitioning, setIsTransitioning] = useState(false)

  // =========================================================
  // SANITY HERO VIDEO
  // =========================================================

  const [heroVideo, setHeroVideo] = useState(null)

  // Video duration
  const [duration, setDuration] = useState('00:00')

  // =========================================================
  // PRELOADER
  // =========================================================

  const [progress, setProgress] = useState(0)

  const [isLoaded, setIsLoaded] = useState(false)

  const [preloaderUnmounted, setPreloaderUnmounted] =
    useState(false)

  // =========================================================
  // AUDIO & DOM REFS
  // =========================================================

  const [isMuted, setIsMuted] = useState(true)

  const activeVideoRef = useRef(null)

  const preloaderRef = useRef(null)

  const progressBarRef = useRef(null)

  const counterRef = useRef(null)

  const targetProgress = useRef(0)

  // Canvas Wrapper Ref for Scale & Skew Reveal
  const heroCanvasWrapperRef = useRef(null)

  // Bottom UI Animation Refs
  const bottomTextRef = useRef(null)

  const scrollTextRef = useRef(null)

  // =========================================================
  // INTERACTION GUIDE
  // =========================================================

  const [showInteractionGuide, setShowInteractionGuide] =
    useState(false)

  const [interactionGuideDismissed, setInteractionGuideDismissed] =
    useState(false)

  const interactionGuideRef = useRef(null)

  const interactionGuideBackdropRef = useRef(null)

  // Prevent the interaction guide from being triggered
  // more than once during the current component lifetime.
  const interactionGuideShownRef = useRef(false)

  // =========================================================
  // INTERACTION GUIDE VIDEO PRELOAD
  // =========================================================
  //
  // IMPORTANT:
  // The popup should NOT be the first time the browser
  // discovers the guide video.
  //
  // We start requesting it immediately after mount so that
  // by the time the popup appears, the browser has already
  // downloaded as much of the video as possible.
  //
  // =========================================================

  const interactionGuideVideoRef = useRef(null)

  useEffect(() => {
    if (
      typeof window === 'undefined'
    ) {
      return
    }

    const video = document.createElement('video')

    video.src = INTERACTION_GUIDE_VIDEO

    video.preload = 'auto'

    video.muted = true

    video.playsInline = true

    video.setAttribute(
      'playsinline',
      'true'
    )

    video.setAttribute(
      'webkit-playsinline',
      'true'
    )

    // Keep the element in memory so the browser continues
    // loading the asset.
    interactionGuideVideoRef.current = video

    // Explicitly tell the browser to begin loading.
    video.load()

    return () => {
      if (
        interactionGuideVideoRef.current === video
      ) {
        interactionGuideVideoRef.current = null
      }

      video.pause()

      video.removeAttribute('src')

      video.load()
    }
  }, [])

  // =========================================================
  // FETCH HERO VIDEO FROM SANITY
  // =========================================================

  useEffect(() => {
    let cancelled = false

    async function fetchHomeContent() {
      try {
        const data = await client.fetch(
          HOME_CONTENT_QUERY,
          {},
          {
            next: {
              revalidate: 60,
            },
          }
        )

        if (cancelled) return

        setHeroVideo(
          data?.heroVideo || null
        )
      } catch (error) {
        console.error(
          'Failed to fetch Home content from Sanity:',
          error
        )

        if (!cancelled) {
          setHeroVideo(null)
        }
      }
    }

    fetchHomeContent()

    return () => {
      cancelled = true
    }
  }, [])

  // =========================================================
  // PROCESS PROJECT VIDEO URL
  // =========================================================

  const PROJECTS = useMemo(() => {
    if (!heroVideo) {
      return []
    }

    return [
      {
        src: getMobileOptimizedUrl(heroVideo),
        title: 'THE BUILDING COMPANY'
      }
    ]
  }, [heroVideo])

  // =========================================================
  // SPLIT SENTENCE INTO WORDS
  // =========================================================

  const words = useMemo(
    () => BOTTOM_TEXT.split(' '),
    []
  )

  // =========================================================
  // FORMAT VIDEO TIME
  // =========================================================

  const formatTime = (seconds) => {
    if (
      !Number.isFinite(seconds) ||
      seconds <= 0
    ) {
      return '00:00'
    }

    const mins = Math.floor(seconds / 60)

    const secs = Math.floor(seconds % 60)

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // =========================================================
  // TRACK INITIAL PAGE / ASSET LOAD PROGRESS
  // =========================================================

  useEffect(() => {
    targetProgress.current = Math.max(
      targetProgress.current,
      30
    )

    const handleWindowLoad = () => {
      targetProgress.current = Math.max(
        targetProgress.current,
        70
      )
    }

    if (document.readyState === 'complete') {
      handleWindowLoad()
    } else {
      window.addEventListener(
        'load',
        handleWindowLoad
      )
    }

    return () => {
      window.removeEventListener(
        'load',
        handleWindowLoad
      )
    }
  }, [])

  // =========================================================
  // SMOOTHLY INTERPOLATE PROGRESS
  // =========================================================

  useGSAP(() => {
    if (isLoaded) {
      return
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        const diff =
          targetProgress.current -
          prev

        if (
          diff <= 0.5 &&
          targetProgress.current >= 100
        ) {
          clearInterval(interval)

          return 100
        }

        return Math.min(
          100,
          Math.round(
            prev +
            Math.max(
              1,
              diff * 0.12
            )
          )
        )
      })
    }, 32)

    return () => {
      clearInterval(interval)
    }
  }, [isLoaded])

  // =========================================================
  // GSAP EXIT CURTAIN ANIMATION
  // =========================================================

  useGSAP(() => {
    if (progress < 100) {
      return
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setPreloaderUnmounted(true)
      }
    })

    tl.to(
      [
        counterRef.current,
        progressBarRef.current
      ],
      {
        opacity: 0,
        duration: 0.4,
        ease: "power2.in"
      }
    )
      .to(
        preloaderRef.current,
        {
          clipPath:
            "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
          duration: 1.2,
          ease: "power4.inOut",
          onStart: () => {
            setIsLoaded(true)
          }
        },
        "-=0.1"
      )
  }, [progress])

  // =========================================================
  // CANVAS SCALE-DOWN & ENTRANCE ANIMATIONS
  // =========================================================

  useGSAP(() => {
    if (!isLoaded) return

    const isMobile =
      window.innerWidth <= 768

    const masterTl =
      gsap.timeline()

    if (
      heroCanvasWrapperRef.current
    ) {
      masterTl.fromTo(
        heroCanvasWrapperRef.current,
        {
          scale: 1.15,
          skewY:
            isMobile
              ? 0
              : 3,
          skewX:
            isMobile
              ? 0
              : -1.5,
          filter:
            isMobile
              ? 'none'
              : 'blur(12px)',
          opacity: 0.7
        },
        {
          scale: 1.0,
          skewY: 0,
          skewX: 0,
          filter: 'none',
          opacity: 1,
          duration: 1.6,
          ease: 'power3.out'
        },
        0
      )
    }

    if (
      bottomTextRef.current
    ) {
      const wordElements =
        bottomTextRef.current.querySelectorAll(
          '.word-span'
        )

      masterTl.fromTo(
        wordElements,
        {
          opacity: 0,
          filter:
            isMobile
              ? 'none'
              : 'blur(8px)',
          y: 15
        },
        {
          opacity: 1,
          filter: 'none',
          y: 0,
          duration: 0.8,
          stagger: 0.03,
          ease: 'power3.out'
        },
        0.2
      )
    }

    if (
      scrollTextRef.current
    ) {
      masterTl.fromTo(
        scrollTextRef.current,
        {
          opacity: 0,
          y: 10
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out'
        },
        "-=0.3"
      )
    }
  }, [isLoaded])

  // =========================================================
  // INTERACTION GUIDE
  // =========================================================

  useEffect(() => {
    if (
      !isLoaded ||
      interactionGuideDismissed ||
      interactionGuideShownRef.current ||
      typeof window === 'undefined' ||
      window.innerWidth <= 768
    ) {
      return
    }

    // Check sessionStorage so the popup only ever appears
    // once during the current browser session.
    const hasShownInteractionGuide =
      sessionStorage.getItem(
        'cloudhaus-interaction-guide-shown'
      )

    if (hasShownInteractionGuide === 'true') {
      interactionGuideShownRef.current = true

      return
    }

    const timer = setTimeout(() => {
      // Double-check the viewport when the timer fires.
      if (window.innerWidth <= 768) {
        return
      }

      // Check again in case another mount has already
      // displayed the guide.
      const alreadyShown =
        sessionStorage.getItem(
          'cloudhaus-interaction-guide-shown'
        )

      if (alreadyShown === 'true') {
        interactionGuideShownRef.current = true

        return
      }

      // Mark as shown BEFORE changing state.
      // This prevents duplicate triggers.
      sessionStorage.setItem(
        'cloudhaus-interaction-guide-shown',
        'true'
      )

      interactionGuideShownRef.current = true

      setShowInteractionGuide(true)
    }, 1800)

    return () => {
      clearTimeout(timer)
    }
  }, [
    isLoaded,
    interactionGuideDismissed
  ])

  // =========================================================
  // INTERACTION GUIDE ENTRANCE
  // =========================================================

  useEffect(() => {
    if (
      !showInteractionGuide ||
      !interactionGuideRef.current
    ) {
      return
    }

    // Animate backdrop in
    if (
      interactionGuideBackdropRef.current
    ) {
      gsap.fromTo(
        interactionGuideBackdropRef.current,
        {
          opacity: 0
        },
        {
          opacity: 1,
          duration: 0.45,
          ease: 'power2.out'
        }
      )
    }

    // Animate card in
    gsap.fromTo(
      interactionGuideRef.current,
      {
        opacity: 0,
        scale: 0.94,
        y: 10,
        filter: 'blur(6px)'
      },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.45,
        ease: 'power3.out'
      }
    )
  }, [
    showInteractionGuide
  ])

  // =========================================================
  // INTERACTION GUIDE EXIT
  // =========================================================

  const closeInteractionGuide = () => {
    const card =
      interactionGuideRef.current

    const backdrop =
      interactionGuideBackdropRef.current

    if (!card) {
      setShowInteractionGuide(false)

      setInteractionGuideDismissed(true)

      return
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setShowInteractionGuide(false)

        setInteractionGuideDismissed(true)
      }
    })

    // Fade card out
    tl.to(
      card,
      {
        opacity: 0,
        scale: 0.94,
        filter: 'blur(6px)',
        duration: 0.3,
        ease: 'power2.out'
      }
    )

    // Fade backdrop out simultaneously
    if (backdrop) {
      tl.to(
        backdrop,
        {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.out'
        },
        0
      )
    }
  }

  // =========================================================
  // VIDEO INITIALIZATION + DURATION
  // =========================================================

  const handleVideoInit = useCallback(
    (videoEl) => {
      if (!videoEl) return

      activeVideoRef.current =
        videoEl

      videoEl.muted =
        isMuted

      videoEl.setAttribute(
        'playsinline',
        'true'
      )

      videoEl.setAttribute(
        'webkit-playsinline',
        'true'
      )

      // -------------------------------------------------------
      // DURATION
      // -------------------------------------------------------

      const updateDuration = () => {
        const videoDuration =
          videoEl.duration

        if (
          Number.isFinite(
            videoDuration
          ) &&
          videoDuration > 0
        ) {
          setDuration(
            formatTime(
              videoDuration
            )
          )

          return true
        }

        return false
      }

      // Try immediately
      updateDuration()

      // -------------------------------------------------------
      // Retry briefly until duration becomes available.
      // -------------------------------------------------------

      let durationAttempts = 0

      const durationRetry =
        setInterval(() => {
          durationAttempts++

          const found =
            updateDuration()

          if (
            found ||
            durationAttempts >= 40
          ) {
            clearInterval(
              durationRetry
            )
          }
        }, 50)

      // -------------------------------------------------------
      // Duration events
      // -------------------------------------------------------

      const handleLoadedMetadata = () => {
        updateDuration()
      }

      const handleDurationChange = () => {
        updateDuration()
      }

      const handleLoadedData = () => {
        updateDuration()
      }

      const handleCanPlay = () => {
        updateDuration()
      }

      videoEl.addEventListener(
        'loadedmetadata',
        handleLoadedMetadata
      )

      videoEl.addEventListener(
        'durationchange',
        handleDurationChange
      )

      videoEl.addEventListener(
        'loadeddata',
        handleLoadedData
      )

      videoEl.addEventListener(
        'canplay',
        handleCanPlay
      )

      // -------------------------------------------------------
      // PRELOADER VIDEO BUFFER PROGRESS
      // -------------------------------------------------------

      const handleProgress = () => {
        if (
          videoEl.buffered.length > 0 &&
          Number.isFinite(
            videoEl.duration
          ) &&
          videoEl.duration > 0
        ) {
          const bufferedEnd =
            videoEl.buffered.end(
              videoEl.buffered.length - 1
            )

          const pct =
            Math.min(
              100,
              Math.round(
                (bufferedEnd /
                  videoEl.duration) *
                  100
              )
            )

          targetProgress.current =
            Math.max(
              targetProgress.current,
              pct
            )
        }
      }

      videoEl.addEventListener(
        'progress',
        handleProgress
      )

      // -------------------------------------------------------
      // READY STATE
      // -------------------------------------------------------

      if (
        videoEl.readyState >= 1
      ) {
        updateDuration()

        targetProgress.current =
          Math.max(
            targetProgress.current,
            85
          )
      }

      if (
        videoEl.readyState >= 3
      ) {
        targetProgress.current = 100
      }

      // -------------------------------------------------------
      // CAN PLAY THROUGH
      // -------------------------------------------------------

      const handleCanPlayThrough = () => {
        targetProgress.current = 100

        updateDuration()
      }

      videoEl.addEventListener(
        'canplaythrough',
        handleCanPlayThrough
      )

      // -------------------------------------------------------
      // PLAY VIDEO
      // -------------------------------------------------------

      const playPromise =
        videoEl.play()

      if (
        playPromise !== undefined
      ) {
        playPromise.catch((err) => {
          console.warn(
            "Autoplay restricted or deferred:",
            err
          )
        })
      }

      // -------------------------------------------------------
      // CLEANUP
      // -------------------------------------------------------

      return () => {
        clearInterval(
          durationRetry
        )

        videoEl.removeEventListener(
          'loadedmetadata',
          handleLoadedMetadata
        )

        videoEl.removeEventListener(
          'durationchange',
          handleDurationChange
        )

        videoEl.removeEventListener(
          'loadeddata',
          handleLoadedData
        )

        videoEl.removeEventListener(
          'canplay',
          handleCanPlay
        )

        videoEl.removeEventListener(
          'progress',
          handleProgress
        )

        videoEl.removeEventListener(
          'canplaythrough',
          handleCanPlayThrough
        )
      }
    },
    [isMuted]
  )

  // =========================================================
  // TOGGLE SOUND
  // =========================================================

  const handleToggleSound = () => {
    const nextMutedState =
      !isMuted

    setIsMuted(
      nextMutedState
    )

    if (
      activeVideoRef.current
    ) {
      activeVideoRef.current.muted =
        nextMutedState

      if (!nextMutedState) {
        activeVideoRef.current.volume =
          1.0

        activeVideoRef.current
          .play()
          .catch(() => {})
      }
    }
  }

  // =========================================================
  // NEXT VIDEO
  // =========================================================

  const handleNext = () => {
    if (
      isTransitioning ||
      nextIndex !== null
    ) {
      return
    }

    const upcoming =
      (currentIndex + 1) %
      PROJECTS.length

    setNextIndex(
      upcoming
    )

    setIsTransitioning(
      true
    )
  }

  // =========================================================
  // TRANSITION COMPLETE
  // =========================================================

  const handleTransitionComplete = () => {
    if (
      nextIndex !== null
    ) {
      setCurrentIndex(
        nextIndex
      )

      setNextIndex(
        null
      )
    }

    setIsTransitioning(
      false
    )
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <>
      {/* =====================================================
          EARLY INTERACTION GUIDE VIDEO PRELOAD
          ===================================================== */}

      <link
        rel="preload"
        href={INTERACTION_GUIDE_VIDEO}
        as="video"
        type="video/mp4"
        fetchPriority="high"
      />

      {/* FIXED NAVIGATION */}

      <header className="fixed top-0 left-0 right-0 z-[90] p-4 w-full pointer-events-none">
        <Navigation
          isMuted={isMuted}
          onToggleSound={
            handleToggleSound
          }
          isLoaded={
            isLoaded
          }
        />
      </header>

      {/* =====================================================
          PRELOADER
          IMPORTANT:
          No sessionStorage here.
          Therefore the preloader runs every time
          the Home component mounts.
          ===================================================== */}

      {!preloaderUnmounted && (
        <div
          ref={
            preloaderRef
          }
          className="fixed inset-0 w-full h-dvh bg-carbon-black z-[100] pointer-events-auto text-ghost-white flex flex-col items-center justify-between tracking-tight"
        >
          <div className="w-full bg-zinc-900 h-[4px] relative overflow-hidden">
            <div
              ref={
                progressBarRef
              }
              className="bg-ghost-white h-full transition-all duration-75 ease-out"
              style={{
                width: `${progress}%`
              }}
            />
          </div>

          <h1
            ref={
              counterRef
            }
            className="tracking-tight font-geist-mono text-[clamp(0.8rem,4vw,2rem)]"
          >
            [ {String(progress).padStart(3, '0')}% ]
          </h1>

          <p className="font-geist-mono text-ghost-white p-4 text-sm text-zinc-500">
            IT ALL STARTS WITH AN IDEA
          </p>
        </div>
      )}

      {/* =====================================================
          MAIN PAGE
          ===================================================== */}

      <main className="relative w-full h-dvh overflow-hidden bg-zinc-900 [perspective:1200px]">

        {/* THREE.JS CANVAS WRAPPER */}

        <div
          ref={
            heroCanvasWrapperRef
          }
          className="absolute inset-0 w-full h-full"
        >
          <HeroCanvas
            activeSrc={
              PROJECTS.length > 0
                ? PROJECTS[currentIndex].src
                : null
            }
            nextSrc={
              nextIndex !== null &&
              PROJECTS.length > 0
                ? PROJECTS[nextIndex].src
                : null
            }
            isTransitioning={
              isTransitioning
            }
            isMuted={
              isMuted
            }
            onTransitionComplete={
              handleTransitionComplete
            }
            onVideoInit={
              handleVideoInit
            }
            isLoaded={
              isLoaded
            }
          />
        </div>

        {/* OVERLAY */}

        <div className="absolute inset-0 bg-black/30 z-0 pointer-events-none" />

        {/* FOREGROUND UI WRAPPER */}

        <div className="relative z-10 w-full h-full p-4 pt-20 flex flex-col justify-between box-border pointer-events-none">

          <div aria-hidden="true" />

          {/* CONTROLS */}

          <div className="pointer-events-auto">
            <Controls
              onNext={
                handleNext
              }
              currentIndex={
                currentIndex + 1
              }
              totalVideos={
                PROJECTS.length
              }
              title={
                PROJECTS.length > 0
                  ? PROJECTS[currentIndex].title
                  : ''
              }
              duration={
                duration
              }
              isLoaded={
                isLoaded
              }
            />
          </div>

          {/* BOTTOM UI */}

          <div className="flex flex-col gap-4 md:flex-row items-start md:items-end justify-between w-full mb-0 text-white font-geist-mono uppercase tracking-tight leading-[140%] md:leading-normal pointer-events-auto">

            <p
              ref={
                bottomTextRef
              }
              className="w-[clamp(320px,25vw,925px)] text-[clamp(1rem,0.55rem+0.6vw,4.8rem)] flex flex-wrap gap-x-[0.3em] gap-y-[0.1em]"
            >
              {words.map(
                (word, index) => (
                  <span
                    key={index}
                    className="word-span inline-block will-change-[transform,opacity]"
                    style={{
                      opacity: 0
                    }}
                  >
                    {word}
                  </span>
                )
              )}
            </p>

            <p
              ref={
                scrollTextRef
              }
              className="text-zinc-200 md:text-ghost-white text-[clamp(0.45rem,0.55rem+0.5vw,2rem)] will-change-[transform,opacity]"
              style={{
                opacity: 0
              }}
            >
              (scroll down)
            </p>

          </div>
        </div>

        {/* =====================================================
            INTERACTION GUIDE BACKDROP
            ===================================================== */}

        {showInteractionGuide && (
          <div
            ref={
              interactionGuideBackdropRef
            }
            className="
              fixed
              inset-0
              z-[60]
              bg-black/40
              pointer-events-none
            "
            aria-hidden="true"
          />
        )}

        {/* =====================================================
            INTERACTION GUIDE
            ===================================================== */}

        {showInteractionGuide && (
          <div
            ref={
              interactionGuideRef
            }
            className="
              fixed
              right-4
              bottom-4
              z-[70]
              w-[260px]
              md:w-[300px]
              overflow-hidden
              rounded-md
              border
              border-white/10
              bg-black
              text-white
              shadow-2xl
              pointer-events-auto
            "
          >
            <div className="relative aspect-video w-full overflow-hidden bg-zinc-900 pt-2">

              <video
                src={INTERACTION_GUIDE_VIDEO}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                fetchPriority="high"
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

              <button
                type="button"
                onClick={
                  closeInteractionGuide
                }
                className="
                  absolute
                  top-2
                  right-2
                  z-10
                  flex
                  items-center
                  justify-center
                  w-6
                  h-6
                  text-center
                  rounded-full
                  bg-black/90
                  backdrop-blur-sm
                  border
                  border-white/10
                  text-white
                  text-xs
                  leading-none
                  hover:bg-black/80
                  transition-colors
                "
                aria-label="Close interaction guide"
              >
                ×
              </button>

            </div>

            <div className="px-3 py-2.5">
              <p className="font-sans font-medium text-[9px] md:text-[10px] uppercase tracking-tight text-zinc-300">
                Hover for interaction
              </p>
            </div>
          </div>
        )}

      </main>
    </>
  )
}

export default Home