'use client'

import React, { useEffect, useRef, useState } from 'react'
import Navigation from '@/components/UI/Navigation'
import Image from 'next/image'
import Lenis from 'lenis'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import TransitionLink from '@/components/PageTransitions/TransitionLink'
import BlurFlicker from '@/components/Animations/BlurFlicker'
import { useGSAP } from '@gsap/react'
import { client } from '@/lib/client'

gsap.registerPlugin(SplitText, ScrollTrigger)

/* =========================================================
   SANITY ABOUT CONTENT QUERY
   ========================================================= */

const ABOUT_CONTENT_QUERY = `
  *[
    _type == "aboutContent"
  ][0]
  {
    aboutText
  }
`

/* =========================================================
   SPLIT LINES REVEAL
   ========================================================= */

function ExtrudedTextReveal({ text }) {
  const containerRef = useRef(null)

  useGSAP(
    () => {
      const element = containerRef.current?.querySelector('[data-split-text]')

      if (!element || !text) return

      // Split text strictly into line blocks
      const split = new SplitText(element, {
        type: 'lines',
        linesClass: 'sky-line relative block overflow-hidden py-[0.05em]',
      })

      // Set initial hidden transform & filter state
      gsap.set(split.lines, {
        opacity: 0,
        yPercent: 120,
        scaleY: 0.95,
        filter: 'blur(10px)',
        transformOrigin: '50% 100%',
        force3D: true,
      })

      // Sequential line reveal animation
      gsap.to(split.lines, {
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        filter: 'blur(0px)',
        duration: 1.5,
        ease: 'power4.out',
        stagger: 0.08,
        force3D: true,
      })

      return () => {
        split.revert()
      }
    },
    {
      scope: containerRef,
      dependencies: [text],
    }
  )

  return (
    <div ref={containerRef} className="w-full">
      <p
        data-split-text
        className="
          text-ghost-white
          w-full
          text-[clamp(1.25rem,2.1vw,2.25rem)]
          tracking-tight
          leading-[130%]
          uppercase
        "
      >
        {text}
      </p>
    </div>
  )
}

/* =========================================================
   IMAGE REVEAL
   ========================================================= */

function ImageReveal() {
  const imageContainerRef = useRef(null)
  const imageRef = useRef(null)
  const overlayRef = useRef(null)

  useGSAP(
    () => {
      if (!imageContainerRef.current || !imageRef.current) return

      gsap.set(imageRef.current, {
        opacity: 0,
        scale: 1.08,
        filter: 'brightness(0.05) blur(3px)',
        transformOrigin: 'center center',
        force3D: true,
      })

      gsap.set(overlayRef.current, {
        opacity: 1,
      })

      const tl = gsap.timeline({
        defaults: {
          ease: 'power3.out',
        },
      })

      tl.to(imageRef.current, {
        opacity: 1,
        scale: 1,
        filter: 'brightness(1) blur(0px)',
        duration: 1.2,
      }).to(
        overlayRef.current,
        {
          opacity: 0,
          duration: 1,
          ease: 'power2.out',
        },
        '<0.05'
      )
    },
    {
      scope: imageContainerRef,
    }
  )

  return (
    <div
      ref={imageContainerRef}
      className="
        relative
        w-full
        max-w-[220px]
        lg:max-w-[460px]
        h-[clamp(18rem,38vw,42rem)]
        overflow-hidden
      "
    >
      <Image
        ref={imageRef}
        src="/Images/JAKE.png"
        alt="Jake McIntosh, founder and director of Cloudhaus"
        fill
        priority
        quality={80}
        sizes="(max-width: 1023px) 220px,460px"
        className="
          object-cover
          will-change-transform
        "
      />

      {/* Dark reveal layer */}
      <div
        ref={overlayRef}
        className="
          absolute
          inset-0
          bg-black
          pointer-events-none
          z-10
        "
      />
    </div>
  )
}

/* =========================================================
   PAGE
   ========================================================= */

export default function Page() {
  /* =======================================================
     BOTTOM CONTENT REVEAL
     ======================================================= */

  const bottomContentRef = useRef(null)

  /* =======================================================
     SANITY ABOUT CONTENT
     ======================================================= */

  const [aboutContent, setAboutContent] = useState(null)

  useGSAP(
    () => {
      if (!bottomContentRef.current) return

      const elements = bottomContentRef.current.querySelectorAll('h1, a')

      if (!elements.length) return

      gsap.set(elements, {
        opacity: 0,
        y: 30,
        filter: 'blur(8px)',
        force3D: true,
      })

      gsap.to(elements, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.12,
        force3D: true,
        scrollTrigger: {
          trigger: bottomContentRef.current,
          start: 'top 88%',
          once: true,
        },
      })
    },
    {
      scope: bottomContentRef,
    }
  )

  /* =======================================================
     FETCH ABOUT CONTENT FROM SANITY
     ======================================================= */

  useEffect(() => {
    let cancelled = false

    async function fetchAboutContent() {
      try {
        const data = await client.fetch(
          ABOUT_CONTENT_QUERY,
          {},
          {
            next: {
              revalidate: 60,
            },
          }
        )

        if (cancelled) return

        setAboutContent(data || null)
      } catch (error) {
        console.error(
          'Failed to fetch About content from Sanity:',
          error
        )

        if (!cancelled) {
          setAboutContent(null)
        }
      }
    }

    fetchAboutContent()

    return () => {
      cancelled = true
    }
  }, [])

  /* =======================================================
     LENIS
     ======================================================= */

  useEffect(() => {
    window.scrollTo(0, 0)

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    })

    let frameId

    function raf(time) {
      lenis.raf(time)
      frameId = requestAnimationFrame(raf)
    }

    frameId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frameId)
      lenis.destroy()
    }
  }, [])

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      className="
        w-full
        min-h-dvh
        bg-carbon-black
        p-4
        md:p-8
      "
    >
      {/* =================================================
          NAVIGATION
      ================================================= */}

      <Navigation />

      {/* =================================================
          PAGE CONTENT
      ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          lg:grid-cols-12
          gap-8
          lg:gap-16
          w-full
          pt-26
          md:pt-40
          items-start
        "
      >
        {/* =================================================
            LEFT CONTENT
        ================================================= */}

        <div
          className="
            flex
            flex-col
            space-y-18
            lg:col-span-7
            w-full
          "
        >
          {/* =================================================
              ABOUT CLOUDHAUS
          ================================================= */}

          <div className="flex flex-col gap-y-6">
            <div
              className="
                font-mono
                tracking-tight
                text-[clamp(0.625rem,1vw,0.75rem)]
                flex
                items-center
                gap-2
                text-zinc-700
              "
            >
              <div className="w-2 h-2 bg-ghost-white" />

              <h1>ABOUT CLOUDHAUS</h1>
            </div>

            {/* SPLIT LINE REVEAL */}

            <ExtrudedTextReveal
              text={aboutContent?.aboutText || ''}
            />
          </div>

          {/* =================================================
              LINKS AND MORE INFO
          ================================================= */}

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-8 w-full">
            {/* CONTACT */}

            <div className="flex flex-col space-y-4">
              <div
                className="
                  font-mono
                  tracking-tight
                  text-[clamp(0.625rem,1vw,0.75rem)]
                  flex
                  items-center
                  gap-2
                  text-zinc-700
                "
              >
                <div className="w-2 h-2 bg-ghost-white" />

                <h2 className="text-zinc-700">CONTACT</h2>
              </div>

              <div className="flex flex-col space-y-3 w-full">
                <div
                  className="
                    flex
                    flex-col
                    font-sans
                    text-ghost-white
                    text-[clamp(0.85rem,1.2vw,1rem)]
                    uppercase
                  "
                >
                  <p>0404 104 360</p>
                  <p>ADELAIDE, SOUTH AUSTRALIA</p>
                  <a
                    className="hover:text-zinc-600 hover:font-medium transition trransition-all duration-500"
                    href="mailto:hello@cloudhaus.com"
                  >
                    hello@cloudhaus.com
                  </a>
                </div>
              </div>
            </div>

            {/* SERVICES */}

            <div className="flex flex-col space-y-4">
              <div
                className="
                  font-mono
                  tracking-tight
                  text-[clamp(0.625rem,1vw,0.75rem)]
                  flex
                  items-center
                  gap-2
                  text-ghost-white
                "
              >
                <div className="w-2 h-2 bg-ghost-white" />

                <h2 className="text-zinc-700">SERVICES</h2>
              </div>

              <div className="flex flex-col space-y-3 w-full">
                <div
                  className="
                    flex
                    flex-col
                    font-sans
                    text-ghost-white
                    text-[clamp(0.85rem,1.2vw,1rem)]
                    uppercase
                  "
                >
                  <p>PRE-PRODUCTION</p>
                  <p>PRODUCTION</p>
                  <p>POST-PRODUCTION</p>
                  <p>AI IN MOTION</p>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================
              SOCIALS
          ================================================= */}

          <div className="flex flex-col space-y-4">
            <div
              className="
                tracking-tight
                text-[clamp(0.625rem,1vw,0.75rem)]
                flex
                items-center
                gap-2
                text-ghost-white
              "
            >
              <div className="w-2 h-2 bg-ghost-white" />

              <h2 className="text-zinc-700 font-mono">SOCIALS</h2>
            </div>

            <div className="flex flex-col space-y-3 w-full font-sans">
              <div
                className="
                  flex
                  flex-row
                  gap-6
                  sm:flex-row
                  sm:gap-x-8
                  font-sans
                  text-ghost-white
                  text-[clamp(0.85rem,1.2vw,1rem)]
                  uppercase
                "
              >
                <BlurFlicker>
                  <a
                    href="https://www.instagram.com/cloudhausmedia/?utm_source=ig_web_button_share_sheet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-60 transition-opacity duration-300"
                  >
                    INSTAGRAM
                  </a>
                </BlurFlicker>

                <BlurFlicker>
                  <a
                    href="https://vimeo.com/user135969253"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-60 transition-opacity duration-300"
                  >
                    VIMEO
                  </a>
                </BlurFlicker>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            RIGHT IMAGE
        ================================================= */}

        <div
          className="
            flex
            flex-col
            gap-3
            lg:col-span-5
            w-full
            items-start
            lg:items-end
            lg:pr-4
          "
        >
          <ImageReveal />

          <h1
            className="
              font-geist-mono
              font-medium
              text-[clamp(0.4rem,1vw,0.85rem)]
              text-zinc-400
              tracking-tight
              text-left
              lg:text-left
              w-full
              max-w-[420px]
              lg:max-w-[460px]
            "
          >
            JAKE MCINTOSH - FOUNDER & DIRECTOR OF CLOUDHAUS
          </h1>
        </div>
      </div>

      {/* =================================================
          BOTTOM CONTENT
      ================================================= */}

      <div
        ref={bottomContentRef}
        className="
          flex
          flex-col-reverse
          md:flex-row
          items-start
          md:items-end
          justify-between
          font-geist-mono
          text-ghost-white
          text-[clamp(0.3rem,2.5vw,0.725rem)]
          uppercase
          w-full
          gap-[clamp(0.55rem,0.8vw,1.5rem)]
          pt-16
          md:pt-48
          px-2
          md:px-4
        "
      >
        <div
          className="
            flex
            flex-row
            md:contents
            justify-between
            w-full
            md:w-auto
          "
        >
          <div
            className="
              flex
              flex-col
              md:flex-row
              space-y-0
              space-x-[clamp(0.5rem,4.5vw,6rem)]
            "
          >
            <h1>BASED IN ADELAIDE</h1>

            <h1>ARCHITECTURE / CONSTRUCTION / MEDIA</h1>
          </div>

          <div
            className="
              flex
              flex-col
              md:flex-row
              space-y-0
              space-x-[clamp(0.5rem,4.5vw,6rem)]
            "
          >
            <BlurFlicker>
              <a
                href="mailto:info@cloudhaus.com.au"
                className="hover:opacity-60 transition-opacity duration-300"
              >
                GET IN TOUCH
              </a>
            </BlurFlicker>

            <BlurFlicker>
              <a
                href="https://www.withzane.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:opacity-60 transition-opacity duration-300"
              >
                WEBSITE BY: ZANE
              </a>
            </BlurFlicker>
          </div>
        </div>

        {/* BACK TO HOME */}

        <div
          className="
            flex
            flex-row
            space-x-[clamp(0.5rem,4.5vw,6rem)]
          "
        >
          <BlurFlicker>
            <TransitionLink href="/" className="font-bold">
              BACK TO HOME
            </TransitionLink>
          </BlurFlicker>
        </div>
      </div>
    </div>
  )
}