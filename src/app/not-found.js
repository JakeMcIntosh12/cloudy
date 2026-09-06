import React from 'react'
import Button from '@/components/UI/Button'
import BlurFlicker from '@/components/Animations/BlurFlicker'

function notfound() {
  return (
    <div className="relative w-full h-dvh bg-black flex flex-col-reverse items-center justify-between overflow-hidden">
      <h1 className="font-mono text-ghost-white text-[clamp(18rem,40vw,40rem)] md:text-[clamp(20rem,58vw,70rem)] absolute bottom-0 translate-y-[8rem] md:translate-y-[20rem] lg:translate-y-[26rem] xl:translate-y-[36rem]">
        404
      </h1>

      <nav className="w-full px-4 md:px-8 absolute top-6 flex items-center justify-between">
        <div className="font-mono tracking-tight text-[clamp(0.55rem,1.1vw,0.75rem)] md:text-[clamp(0.75rem,1.3vw,1.125rem)]">
          <h2 className="text-zinc-600">OOPS!</h2>
          <p className="text-ghost-white">
            THIS PAGE IS STILL IN THE BLUEPRINT PHASE.
          </p>
        </div>
         
         <BlurFlicker>

        <Button href="/" text="RETURN HOME" />
         </BlurFlicker>
      </nav>
    </div>
  )
}

export default notfound