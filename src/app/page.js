'use client'
import React, { useEffect } from 'react'
import Lenis from 'lenis'
import Hero from './Hero/Home'
import More from './More/page'

export default function Page() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    })

    // expose so GlobalCinematicFog can read the real scroll value
    window.__lenis = lenis

    let frameId

    function raf(time) {
      lenis.raf(time)
      frameId = requestAnimationFrame(raf)
    }

    frameId = requestAnimationFrame(raf)

    // Cleanup when component unmounts
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