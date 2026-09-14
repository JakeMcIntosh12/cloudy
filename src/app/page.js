'use client'

import React, { useEffect } from 'react'
import Lenis from 'lenis'
import Hero from './Hero/Home'
import More from './More/page'

export default function Page() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) =>
        1 - Math.pow(1 - t, 4),
      smoothWheel: true,
      smoothTouch: false,
      touchMultiplier: 1.5,
      wheelMultiplier: 0.9,
    })

    // Expose Lenis so GlobalCinematicFog can read the real scroll value
    window.__lenis = lenis

    let frameId

    function raf(time) {
      lenis.raf(time)
      frameId = requestAnimationFrame(raf)
    }

    frameId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frameId)
      lenis.destroy()
      window.__lenis = null
    }
  }, [])

  return (
    <div>
      <Hero />
      <More />
    </div>
  )
}