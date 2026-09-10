"use client";

import { ArrowLeft, ArrowRight } from 'lucide-react';
import React, { useState, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import BlurFlicker from "../Animations/BlurFlicker";
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);



const testimonialsData = [
  {
    company: "Spero Koulianos",
    role: "Neu Built Founder",
    quote:
      "We’ve worked with Jake from Cloudhaus across a number of our projects, and his work consistently exceeds expectations. He understands architecture, construction and design, and knows exactly how to capture the details that matter. His eye for natural light, composition and the subtle beauty of space allows every project to be showcased exactly as it was intended.",
  },
  {
    company: "Nerida Box",
    role: "Co-Founder & Director of The Building Company",
    quote:
      "We've worked with Jake since 2020, and he's consistently delivered exactly what we've needed — great quality, varying scope of clips, quick turnaround, flexibility and reliability. These are qualities that make him a pleasure to work with, time and time again.",
  },
  {
    company: "Matt Cates",
    role: "Director 4LIFE Construction",
    quote:
      "We've had the pleasure of working with Jake from Cloudhaus on several projects, and he has consistently been professional, reliable, easy to work with, and highly creative. He has a great eye for detail and storytelling, capturing the quality and craftsmanship of our builds and helping us present our work professionally.",
  },
  {
    company: "Penny Morgan",
    role: "Morgan Build",
    quote:
      "We’ve worked with Jake for over seven years and he’s been a big part of capturing our projects. He has an incredible eye for detail, understands our style and always knows what to capture. He’s reliable, professional and genuinely great to work with. We wouldn’t hesitate to recommend him.",
  },
];





const AUTOPLAY_DURATION = 6;

function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const totalTestimonials = testimonialsData.length;
  const currentTestimonial = testimonialsData[currentIndex];

  const containerRef = useRef(null);
  const quoteRef = useRef(null);
  const infoRef = useRef(null);
  const lineContainerRef = useRef(null);
  const progressLineRef = useRef(null);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % totalTestimonials);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex(
      (prevIndex) => (prevIndex - 1 + totalTestimonials) % totalTestimonials
    );
  };

  const formatIndex = (index) => String(index).padStart(2, "0");

  useLayoutEffect(() => {
    let split;
    let lineWrappers = [];

    const ctx = gsap.context(() => {
      if (!quoteRef.current) return;

      const isDesktop = window.innerWidth >= 1024;

      // 1. Split Text setup
      split = new SplitText(quoteRef.current, {
        type: "lines",
        linesClass: "split-line",
      });

      split.lines.forEach((line) => {
        const wrapper = document.createElement("div");
        wrapper.className = "overflow-hidden";
        wrapper.style.display = "block";

        line.parentNode.insertBefore(wrapper, line);
        wrapper.appendChild(line);

        lineWrappers.push(wrapper);
      });

      const tl = gsap.timeline({
        delay: 0.1,
      });

      // 2. Initial States
      gsap.set(split.lines, {
        yPercent: 110,
        opacity: 0,
      });

      if (progressLineRef.current) {
        gsap.set(progressLineRef.current, {
          scaleY: isDesktop ? 0 : 1,
          scaleX: isDesktop ? 1 : 0,
          transformOrigin: isDesktop ? "top" : "left",
        });
      }

      // 3. Line track entrance animation
      if (lineContainerRef.current) {
        tl.fromTo(
          lineContainerRef.current,
          {
            scaleY: isDesktop ? 0 : 1,
            scaleX: isDesktop ? 1 : 0,
            transformOrigin: isDesktop ? "top" : "left",
          },
          {
            scaleY: 1,
            scaleX: 1,
            duration: 1.1,
            ease: "power4.out",
          },
          0
        );
      }

      // 4. Reveal text lines
      tl.to(
        split.lines,
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.1,
          ease: "power4.out",
          stagger: 0.08,
        },
        0.05
      );

      // 5. Reveal client info
      if (infoRef.current) {
        tl.fromTo(
          infoRef.current,
          {
            opacity: 0,
            y: 15,
            filter: "blur(5px)",
          },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 1,
            ease: "power3.out",
          },
          "-=0.6"
        );
      }

      // 6. Autoplay progress line fill
      if (progressLineRef.current) {
        tl.to(
          progressLineRef.current,
          {
            scaleY: 1,
            scaleX: 1,
            duration: AUTOPLAY_DURATION,
            ease: "none",
            onComplete: handleNext,
          },
          "+=0.2"
        );
      }
    }, containerRef);

    return () => {
      if (split) {
        split.revert();
      }

      lineWrappers.forEach((wrapper) => {
        const line = wrapper.firstChild;
        if (line && wrapper.parentNode) {
          wrapper.parentNode.insertBefore(line, wrapper);
          wrapper.remove();
        }
      });

      lineWrappers = [];
      ctx.revert();
    };
  }, [currentIndex, direction]);

  return (
    <div
      ref={containerRef}
      className="
        relative
        flex
        flex-col
        items-start
        justify-between
        w-full
        
        md:min-h-screen
        font-mono
        text-ghost-white
        tracking-tight
        py-[clamp(2rem,3vw,4rem)]
        
      "
    >
      {/* CONTENT GROUP */}
      <div className="flex flex-col lg:flex-row justify-between w-full items-start gap-[clamp(1.5rem,3vw,4rem)] pt-[clamp(2rem,4vw,4rem)]  ">

        {/* CONTROLS & META GROUP - LEFT */}
        <div className="flex flex-col justify-between items-start w-full lg:w-[280px] gap-[clamp(1.5rem,2.5vw,2.5rem)] text-ghost-white shrink-0">

          {/* SECTION TAG + COUNTER + INTRO TEXT */}
          <div className="flex flex-col items-start w-full gap-[clamp(0.75rem,1.5vw,1.25rem)]">
            
            {/* TAG & COUNTER ROW */}
            <div className="flex flex-row items-center justify-between w-full">
              <div className="text-[clamp(0.625rem,1vw,0.75rem)] flex items-center gap-[clamp(0.375rem,1vw,0.5rem)] text-zinc-500 font-medium">
                <div className="w-[clamp(0.25rem,0.6vw,0.375rem)] h-[clamp(0.25rem,0.6vw,0.375rem)] bg-lavender" />
                <h2>TESTIMONIALS</h2>
              </div>

              <div className="flex flex-row items-center justify-start gap-[clamp(0.35rem,1vw,0.5rem)] text-[clamp(0.8rem,1.4vw,1rem)] font-bold">
                <span>{formatIndex(currentIndex + 1)}</span>
                <span className="opacity-90 text-[0.9em]">/</span>
                <span>{formatIndex(totalTestimonials)}</span>
              </div>
            </div>

            {/* INTRO PARAGRAPH */}
            <p className="text-[clamp(0.75rem,1vw,0.875rem)] text-zinc-400 w-1/2 md:w-full font-sans leading-relaxed tracking-normal">
              Hear it directly from our partners — real accounts on collaboration, execution, and architectural storytelling.
            </p>

          </div>

          {/* NAVIGATION BUTTONS */}
          <div className="flex flex-row space-x-[clamp(0.5rem,1.5vw,0.875rem)]">
            <BlurFlicker>
              <button
                onClick={handlePrev}
                aria-label="Prev testimonial"
                className="
                  rounded-2xl
                  border
                  border-eclipse
                  p-[clamp(0.75rem,1.5vw,1.25rem)]
                  flex
                  items-center
                  justify-center
                  text-center
                  text-ghost-white
                  cursor-pointer
                  select-none
                "
              >
                <ArrowLeft className="w-[clamp(1.1rem,1.8vw,1.5rem)] h-[clamp(1.1rem,1.8vw,1.5rem)]" />
              </button>
            </BlurFlicker>

            <BlurFlicker>
              <button
                onClick={handleNext}
                aria-label="Next testimonial"
                className="
                  rounded-2xl
                  border
                  border-eclipse
                  p-[clamp(0.75rem,1.5vw,1.25rem)]
                  flex
                  items-center
                  justify-center
                  text-center
                  text-ghost-white
                  cursor-pointer
                  select-none
                "
              >
                <ArrowRight className="w-[clamp(1.1rem,1.8vw,1.5rem)] h-[clamp(1.1rem,1.8vw,1.5rem)]" />
              </button>
            </BlurFlicker>
          </div>

        </div>

        {/* RIGHT GROUP: PROGRESS LINE + CONTENT */}
        <div className="flex flex-col lg:flex-row items-start w-full max-w-[1250px] gap-[clamp(1.25rem,2.5vw,2.5rem)]">

          {/* RESPONSIVE PROGRESS LINE DIVIDER TRACK */}
          <div
            ref={lineContainerRef}
            className="
              relative
              w-full lg:w-[1px]
              h-[1px] lg:h-[clamp(500px,75vh,850px)]
              bg-eclipse/40
              shrink-0
              overflow-hidden
              will-change-transform
              my-2 lg:my-0
            "
          >
            {/* ACTIVE FILL LINE */}
            <div
              ref={progressLineRef}
              className="
                absolute top-0 left-0
                w-full h-full
                bg-ghost-white
                will-change-transform
              "
            />
          </div>

          {/* TESTIMONIAL + CLIENT INFO */}
          <div className="flex flex-col w-full space-y-[clamp(2rem,3.5vw,3rem)]">

            {/* MID SECTION - Quote Grid Stack (LARGER TYPOGRAPHY) */}
            <div className="grid grid-cols-1 grid-rows-1 w-full items-start">
              {testimonialsData.map((item, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <p
                    key={idx}
                    ref={isActive ? quoteRef : null}
                    aria-hidden={!isActive}
                    className={` col-start-1 row-start-1 w-full text-[clamp(1.35rem,3vw,2rem)] lg:text-[clamp(1.5rem,2.4vw,3.5rem)] text-ghost-white leading-[125%] lg:leading-[130%] text-left font-sans will-change-[transform,opacity,filter] uppercase ${isActive ? 'pointer-events-auto opacity-100 relative' : 'pointer-events-none opacity-0 absolute invisible'} `}
                  >
                    &quot;{item.quote}&quot;
                  </p>
                );
              })}
            </div>

            {/* CLIENT INFO */}
            <div
              ref={infoRef}
              className="
                flex
                flex-col
                space-y-[clamp(0.25rem,0.6vw,0.375rem)]
                w-full
                will-change-[transform,opacity,filter]
              "
            >
              <h3 className="text-[clamp(1rem,2.2vw,1.5rem)] text-ghost-white font-regular uppercase">
                {currentTestimonial.company}
              </h3>

              <p className="text-[clamp(0.7rem,1.3vw,0.95rem)] text-zinc-500 opacity-80 font-medium uppercase w-full">
                {currentTestimonial.role}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Testimonials;