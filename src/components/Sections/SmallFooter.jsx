
'use client'

import React, { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import TransitionLink from '@/components/PageTransitions/TransitionLink'
import BlurFlicker from '@/components/Animations/BlurFlicker'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)

export default function BottomContent() {
  const bottomContentRef = useRef(null)

  useGSAP(
    () => {
      if (!bottomContentRef.current) return

      const elements =
        bottomContentRef.current.querySelectorAll('h1, a')

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

  return (
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
        gap-[clamp(0.45rem,0.8vw,1.5rem)]
        pt-14
        md:pt-28
        px-4
        pb-4
        md:pb-4
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
            space-x-[clamp(0.4rem,4.5vw,6rem)]
          "
        >
          <h1>BASED IN ADELAIDE</h1>

          <h1>ARCHITECTURE / CONSTRUCTION / MORE</h1>
        </div>

        <div
          className="
            flex
            flex-col
            md:flex-row
            space-y-0
            space-x-[clamp(0.4rem,4.5vw,6rem)]
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
          space-x-[clamp(0.4rem,4.5vw,6rem)]
        "
      >
        <BlurFlicker>
          <TransitionLink href="/" className="font-bold">
            BACK TO HOME
          </TransitionLink>
        </BlurFlicker>
      </div>
    </div>
  )
}

