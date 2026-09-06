"use client";

import React, { useState, useEffect, useRef } from "react";
import Button from "../UI/Button";
import BlurFlicker from "../Animations/BlurFlicker";
import ExtrudedElevationReveal from "../Animations/SmudgyTextReveal";
import TransitionLink from "../PageTransitions/TransitionLink";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { client } from "@/lib/client";

gsap.registerPlugin(ScrollTrigger);

/* =====================================================
   SANITY FOOTER CONTENT QUERY
   ===================================================== */

const FOOTER_CONTENT_QUERY = `
  *[
    _type == "aboutContent"
  ][0]
  {
    footerClosingText
  }
`;

function Footer() {
  const [time, setTime] = useState("");
  const [footerContent, setFooterContent] = useState(null);

  const logoRef = useRef(null);
  const metaRef = useRef(null);
  const footerInfoRef = useRef(null);

  // FOOTER INFORMATION BLOCK REFS
  const navigationRef = useRef(null);
  const contactRef = useRef(null);
  const timeRef = useRef(null);
  const socialsRef = useRef(null);

  /* =====================================================
     ADELAIDE LIVE CLOCK
     ===================================================== */

  useEffect(() => {
    const updateTime = () => {
      const parts = new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Adelaide",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).formatToParts(new Date());

      const get = (type) =>
        parts.find((part) => part.type === type)?.value ?? "";

      const formattedTime = `${get("hour")}:${get("minute")}:${get(
        "second",
      )} ${get("dayPeriod").toUpperCase()}`;

      setTime(formattedTime);
    };

    updateTime();

    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  /* =====================================================
     FETCH FOOTER CONTENT FROM SANITY
     ===================================================== */

  useEffect(() => {
    let cancelled = false;

    async function fetchFooterContent() {
      try {
        const data = await client.fetch(
          FOOTER_CONTENT_QUERY,
          {},
          {
            next: {
              revalidate: 60,
            },
          }
        );

        if (cancelled) return;

        setFooterContent(data || null);
      } catch (error) {
        console.error(
          "Failed to fetch Footer content from Sanity:",
          error
        );

        if (!cancelled) {
          setFooterContent(null);
        }
      }
    }

    fetchFooterContent();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =====================================================
     GSAP ANIMATIONS
     ===================================================== */

  useGSAP(() => {
    /* =====================================================
       CLOUDHAUS LOGO REVEAL
       ===================================================== */

    if (logoRef.current) {
      gsap.fromTo(
        logoRef.current,
        {
          opacity: 0,
          filter: "blur(18px)",
          scale: 0.97,
          y: 12,
          transformOrigin: "center bottom",
        },
        {
          opacity: 1,
          filter: "blur(0px)",
          scale: 1,
          y: 0,
          duration: 1.4,
          ease: "power4.out",
          scrollTrigger: {
            trigger: logoRef.current,
            start: "top 90%",
            toggleActions: "play none none none",
          },
        },
      );
    }

    /* =====================================================
       FOOTER INFORMATION BLOCKS
       SCROLL-TRIGGERED REVEAL
       ===================================================== */

    const footerBlocks = [
      navigationRef.current,
      contactRef.current,
      timeRef.current,
      socialsRef.current,
    ].filter(Boolean);

    if (footerInfoRef.current && footerBlocks.length) {
      gsap.fromTo(
        footerBlocks,
        {
          opacity: 0,
        },
        {
          opacity: 1,
          duration: 1.2,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: {
            trigger: footerInfoRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        },
      );
    }

    /* =====================================================
       BOTTOM METADATA STAGGER
       ===================================================== */

    if (metaRef.current) {
      const metaItems = metaRef.current.querySelectorAll("[data-footer-meta]");

      gsap.fromTo(
        metaItems,
        {
          opacity: 0,
          filter: "blur(8px)",
          y: 8,
        },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: metaRef.current,
            start: "top 95%",
            toggleActions: "play none none none",
          },
        },
      );
    }
  }, []);

  return (
    <footer
      id="footer"
      className="w-full min-h-fit md:min-h-screen flex flex-col justify-between pt-16 lg:pt-32 pb-0 lg:pb-2 space-y-30 md:space-y-60 px-0 md:px-2 bg-black"
    >
      {/* =====================================================
          TOP DIV HOUSING ALL THREE COLUMNS
          ===================================================== */}

      <div
        ref={footerInfoRef}
        className="flex flex-col lg:flex-row justify-between w-full gap-12 lg:gap-8"
      >
        {/* =====================================================
            1. LEFT BLOCK
            ===================================================== */}

        <div className="flex flex-col items-start justify-start space-y-[clamp(1.5rem,3vw,2rem)]">
          <div className="flex flex-col space-y-[clamp(1.2rem,2vw,1.3rem)]">
            <ExtrudedElevationReveal
              variant="footer"
              text={
                footerContent?.footerClosingText ||
                ""
              }
            />

            <p className="w-full max-w-[clamp(20rem,40vw,22.875rem)] text-[clamp(0.8rem,1vw,1rem)] text-zinc-600 leading-[130%] font-geist-mono uppercase">
              We turn exceptional work into lasting impressions.
            </p>
          </div>

          <BlurFlicker>
            <Button
              text="check availability"
              href="mailto:hello@cloudhausmedia.com"
            />
          </BlurFlicker>
        </div>

        {/* =====================================================
            MOBILE/TABLET INFORMATION GRID
            DESKTOP RETURNS TO ORIGINAL COLUMN STRUCTURE
            ===================================================== */}

        <div className="grid grid-cols-2 lg:hidden w-full gap-x-6 gap-y-12">
          {/* =====================================================
              NAVIGATION
              ===================================================== */}

          <div
            ref={navigationRef}
            className="flex flex-col space-y-[clamp(0.75rem,2vw,1.5rem)] items-start justify-start w-full"
          >
            <div className="font-mono tracking-tight text-[clamp(0.625rem,0.6vw,0.65rem)] flex items-center gap-2 text-ghost-white">
              <div className="w-2 h-2 bg-ghost-white" />

              <span className="text-zinc-600 text-[clamp(0.65rem,1.1vw,1rem)]">
                NAVIGATION
              </span>
            </div>

            <div className="flex flex-col font-sans font-medium text-ghost-white text-[clamp(0.625rem,4.6vw,1.025rem)] uppercase">
              <BlurFlicker>
                <TransitionLink
                  href="/#top"
                  className="hover:opacity-70 transition-opacity"
                >
                  HOME
                </TransitionLink>
              </BlurFlicker>

              <BlurFlicker>
                <TransitionLink
                  href="/About"
                  className="hover:opacity-70 transition-opacity"
                >
                  ABOUT
                </TransitionLink>
              </BlurFlicker>

              <BlurFlicker>
                <a
                  href="#services"
                  className="hover:opacity-70 transition-opacity"
                >
                  SERVICES
                </a>
              </BlurFlicker>

              <BlurFlicker>
                <TransitionLink
                  href="/All-Works"
                  className="hover:opacity-70 transition-opacity"
                >
                  WORK
                </TransitionLink>
              </BlurFlicker>

              <BlurFlicker>
                <TransitionLink
                  href="/Weddings"
                  className="hover:opacity-70 transition-opacity"
                >
                  MORE
                </TransitionLink>
              </BlurFlicker>
            </div>
          </div>

          {/* =====================================================
              CONTACT
              ===================================================== */}

          <div
            ref={contactRef}
            className="flex flex-col space-y-[clamp(0.75rem,2vw,1.5rem)] items-start justify-start w-full"
          >
            <div className="font-mono tracking-tight text-[clamp(0.625rem,1vw,0.75rem)] flex items-center gap-2 text-ghost-white">
              <div className="w-2 h-2 bg-ghost-white" />

              <span className="text-zinc-600 text-[clamp(0.65rem,1.1vw,1rem)]">
                CONTACT
              </span>
            </div>

            <div className="flex flex-col space-y-1 font-sans font-medium text-ghost-white text-[clamp(0.325rem,3vw,1.025rem)] uppercase">
              <span>0404 104 360</span>

              <span>ADELAIDE, SOUTH AUSTRALIA</span>

              <a
                href="mailto:hello@cloudhausmedia.com"
                className="hover:opacity-70 transition-opacity"
              >
                hello@cloudhausmedia.com
              </a>
            </div>
          </div>

          {/* =====================================================
              TIME / TELEMETRY
              ===================================================== */}

          <div
            ref={timeRef}
            className="flex flex-col space-y-[clamp(0.25rem,0.5vw,0.5rem)] items-start justify-start w-full font-geist-mono uppercase"
          >
            <div className="flex items-center gap-2 text-[clamp(0.325rem,3vw,1.025rem)] text-ghost-white">
              <span className="text-zinc-100 tabular-nums">
                ADL {time || "12:00:00 AM"}
              </span>
            </div>

            <div className="text-[clamp(0.325rem,3vw,1.025rem)] text-zinc-600 flex flex-col -space-y-0.5 tracking-tight font-sans">
              <span>34.9285° S, 138.6007° E</span>

              <span>ELEV. 50M • ACDT/ACST</span>
            </div>
          </div>

          {/* =====================================================
              SOCIALS
              ===================================================== */}

          <div
            ref={socialsRef}
            className="flex flex-col space-y-[clamp(0.75rem,2vw,1.5rem)] items-start justify-start w-full"
          >
            <div className="flex flex-col space-y-[clamp(0.25rem,1vw,0.5rem)] items-start justify-start w-full">
              <div className="font-mono tracking-tight text-[clamp(0.625rem,1vw,0.75rem)] flex items-center gap-2 text-ghost-white">
                <div className="w-2 h-2 bg-ghost-white" />

                <span className="text-zinc-600 text-[clamp(0.65rem,1.1vw,1rem)]">
                  SOCIALS
                </span>
              </div>

              <div className="flex flex-col items-start justify-start w-full space-y-0.5 font-sans font-medium text-ghost-white text-[clamp(0.625rem,4.5vw,1.025rem)] uppercase">
                <BlurFlicker>
                  <a
                    href="https://www.instagram.com/cloudhausmedia/?utm_source=ig_web_button_share_sheet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                  >
                    INSTAGRAM
                  </a>
                </BlurFlicker>

                <BlurFlicker>
                  <a
                    href="https://vimeo.com/user135969253"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                  >
                    VIMEO
                  </a>
                </BlurFlicker>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            DESKTOP INFORMATION COLUMNS
            ORIGINAL DESKTOP LAYOUT PRESERVED
            ===================================================== */}

        <div className="hidden lg:flex flex-col justify-between items-start w-auto gap-[clamp(1.5rem,3vw,3rem)] font-regular">
          {/* NAVIGATION LINKS */}

          <div
            ref={navigationRef}
            className="flex flex-col space-y-[clamp(0.75rem,2vw,1.5rem)] items-start justify-start w-full"
          >
            <div className="font-mono tracking-tight text-[clamp(0.625rem,0.6vw,0.65rem)] flex items-center gap-2 text-ghost-white">
              <div className="w-2 h-2 bg-ghost-white" />

              <span className="text-zinc-600 text-[clamp(0.65rem,1.1vw,1rem)]">
                NAVIGATION
              </span>
            </div>

            <div className="flex flex-col font-sans font-medium text-ghost-white text-[clamp(0.625rem,4.6vw,1.025rem)] uppercase">
              <BlurFlicker>
                <TransitionLink
                  href="/#top"
                  className="hover:opacity-70 transition-opacity"
                >
                  HOME
                </TransitionLink>
              </BlurFlicker>

              <BlurFlicker>
                <TransitionLink
                  href="/About"
                  className="hover:opacity-70 transition-opacity"
                >
                  ABOUT
                </TransitionLink>
              </BlurFlicker>

              <BlurFlicker>
                <a
                  href="#services"
                  className="hover:opacity-70 transition-opacity"
                >
                  SERVICES
                </a>
              </BlurFlicker>

              <BlurFlicker>
                <TransitionLink
                  href="/All-Works"
                  className="hover:opacity-70 transition-opacity"
                >
                  WORK
                </TransitionLink>
              </BlurFlicker>

              <BlurFlicker>
                <TransitionLink
                  href="/Weddings"
                  className="hover:opacity-70 transition-opacity"
                >
                  MORE
                </TransitionLink>
              </BlurFlicker>
            </div>
          </div>

          {/* CONTACT DETAILS */}

          <div
            ref={contactRef}
            className="flex flex-col space-y-[clamp(0.75rem,2vw,1.5rem)] items-start justify-start w-full"
          >
            <div className="font-mono tracking-tight text-[clamp(0.625rem,1vw,0.75rem)] flex items-center gap-2 text-ghost-white">
              <div className="w-2 h-2 bg-ghost-white" />

              <span className="text-zinc-600 text-[clamp(0.65rem,1.1vw,1rem)]">
                CONTACT
              </span>
            </div>

            <div className="flex flex-col space-y-1 md:space-y-0 font-sans font-medium text-ghost-white text-[clamp(0.325rem,3vw,1.025rem)] uppercase">
              <span>0404 104 360</span>

              <span>ADELAIDE, SOUTH AUSTRALIA</span>

              <a
                href="mailto:hello@cloudhausmedia.com"
                className="hover:opacity-70 transition-opacity"
              >
                hello@cloudhausmedia.com
              </a>
            </div>
          </div>
        </div>

        {/* =====================================================
            DESKTOP TIME / SOCIALS
            ORIGINAL DESKTOP LAYOUT PRESERVED
            ===================================================== */}

        <div className="hidden lg:flex flex-col justify-between items-start w-auto gap-[clamp(1.5rem,3vw,3rem)]">
          {/* DYNAMIC TIME & GEOGRAPHIC DATA */}

          <div
            ref={timeRef}
            className="flex flex-col space-y-[clamp(0.25rem,0.5vw,0.5rem)] items-start justify-start w-full font-geist-mono uppercase"
          >
            <div className="flex items-center gap-2 text-[clamp(0.325rem,3vw,1.025rem)] text-ghost-white">
              <span className="text-zinc-100 tabular-nums">
                ADL {time || "12:00:00 AM"}
              </span>
            </div>

            <div className="text-[clamp(0.325rem,3vw,1.025rem)] text-zinc-600 flex flex-col -space-y-0.5 tracking-tight font-sans">
              <span>34.9285° S, 138.6007° E</span>

              <span>ELEV. 50M • ACDT/ACST</span>
            </div>
          </div>

          {/* SOCIAL DETAILS */}

          <div
            ref={socialsRef}
            className="flex flex-col space-y-[clamp(0.75rem,2vw,1.5rem)] w-full"
          >
            <div className="flex flex-col space-y-[clamp(0.25rem,1vw,0.5rem)] items-start justify-start w-full">
              <div className="font-mono tracking-tight text-[clamp(0.625rem,1vw,0.75rem)] flex items-center gap-2 text-ghost-white">
                <div className="w-2 h-2 bg-ghost-white" />

                <span className="text-zinc-600 text-[clamp(0.65rem,1.1vw,1rem)]">
                  SOCIALS
                </span>
              </div>

              <div className="flex flex-col items-start justify-start w-full space-y-0.5 font-sans font-medium text-ghost-white text-[clamp(0.625rem,4.5vw,1.025rem)] uppercase">
                <BlurFlicker>
                  <a
                    href="https://www.instagram.com/cloudhausmedia/?utm_source=ig_web_button_share_sheet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                  >
                    INSTAGRAM
                  </a>
                </BlurFlicker>

                <BlurFlicker>
                  <a
                    href="https://vimeo.com/user135969253"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                  >
                    VIMEO
                  </a>
                </BlurFlicker>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          BOTTOM SECTION CONTAINER
          ===================================================== */}

      <div className="w-full mt-auto pt-6 lg:pt-12">
        {/* CLOUDHAUS SVG LOGO */}

        <div
          ref={logoRef}
          className="w-full select-none pointer-events-none flex items-center justify-center pb-2"
        >
          <svg
            viewBox="0 0 271 34"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto text-ghost-white fill-current"
            preserveAspectRatio="xMidYMax meet"
          >
            <path
              d="M60.4953 33.254C69.678 33.254 77.1217 25.8101 77.1217 16.6275C77.1217 7.44491 69.678 0.000976562 60.4953 0.000976562C51.313 0.000976562 43.8691 7.44491 43.8691 16.6275C43.8691 25.8101 51.313 33.254 60.4953 33.254Z"
              fill="white"
            />
            <path
              d="M78.4355 0.000976562C78.4355 4.3678 78.865 8.69189 79.7006 12.7263C80.5362 16.7607 81.7608 20.4265 83.3047 23.5143C84.8486 26.6021 86.6815 29.0515 88.6988 30.7226C90.7156 32.3937 92.8779 33.2538 95.0619 33.2538C97.2449 33.2538 99.4067 32.3937 101.424 30.7226C103.441 29.0515 105.274 26.6021 106.818 23.5143C108.362 20.4265 109.587 16.7607 110.423 12.7263C111.258 8.69189 111.688 4.3678 111.688 0.000976562H78.4355Z"
              fill="white"
            />
            <path
              d="M113.684 33.254C116.556 33.254 119.399 32.8239 122.052 31.9884C124.705 31.1529 127.115 29.9282 129.145 28.3843C131.175 26.8403 132.786 25.0074 133.885 22.9902C134.984 20.973 135.549 18.811 135.549 16.6275C135.549 14.4441 134.984 12.282 133.885 10.2649C132.786 8.24766 131.175 6.41472 129.145 4.87076C127.115 3.3269 124.705 2.10223 122.052 1.26667C119.399 0.431034 116.556 0.000976562 113.684 0.000976562V33.254Z"
              fill="white"
            />
            <path
              d="M21.7144 0.000976562C18.8533 0.012908 16.0221 0.454741 13.3825 1.30131C10.7427 2.14788 8.34629 3.38255 6.32994 4.9349C4.3136 6.48723 2.71677 8.32678 1.63065 10.3485C0.544606 12.3704 -0.00950373 14.5347 0.000123322 16.7181C0.00967149 18.9015 0.582642 21.0612 1.68636 23.0738C2.79016 25.0864 4.403 26.9127 6.43279 28.4481C8.46272 29.9836 10.8698 31.1983 13.5169 32.0228C16.1639 32.8474 18.9989 33.2656 21.86 33.2537L21.7872 16.6273L21.7144 0.000976562Z"
              fill="white"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M41.0538 0.38585V32.8691C41.0538 33.0816 40.8588 33.254 40.6186 33.254H27.6422C27.402 33.254 27.207 33.0816 27.207 32.8691V0.38585C27.207 0.1734 27.402 0.000976562 27.6422 0.000976562H40.6186C40.8588 0.000976562 41.0538 0.1734 41.0538 0.38585Z"
              fill="white"
            />
            <path
              d="M207.792 0C207.792 4.36693 208.222 8.6907 209.058 12.725C209.893 16.7605 211.117 20.4252 212.661 23.5134C214.206 26.6015 216.038 29.0509 218.056 30.7215C220.073 32.3932 222.235 33.2533 224.418 33.2533C226.601 33.2533 228.764 32.3932 230.781 30.7215C232.798 29.0509 234.631 26.6015 236.174 23.5134C237.718 20.4252 238.943 16.7605 239.779 12.725C240.614 8.6907 241.045 4.36693 241.045 0H207.792Z"
              fill="white"
            />
            <path
              d="M208.209 33.2539C208.209 28.887 207.78 24.5632 206.944 20.5289C206.108 16.4935 204.884 12.8287 203.34 9.74053C201.796 6.65239 199.963 4.20296 197.946 2.53238C195.929 0.860737 193.767 0.000572205 191.583 0.000572205C189.4 0.000572205 187.238 0.860737 185.221 2.53238C183.204 4.20296 181.371 6.65239 179.827 9.74053C178.283 12.8287 177.058 16.4935 176.222 20.5289C175.387 24.5632 174.957 28.887 174.957 33.2539L208.209 33.2539Z"
              fill="white"
            />
            <path
              d="M270.173 4.46436C268.492 3.14797 266.557 2.07789 264.477 1.31524C262.397 0.552595 260.213 0.112224 258.05 0.0195031C255.886 -0.073309 253.785 0.183251 251.869 0.77448C249.951 1.36571 248.254 2.27999 246.874 3.46521C245.495 4.65044 244.46 6.08328 243.828 7.6821C243.197 9.28083 242.982 11.0144 243.194 12.7833C243.407 14.5519 244.043 16.3215 245.068 17.9916C246.091 19.6618 247.484 21.199 249.164 22.5147L259.668 13.4893L270.173 4.46436Z"
              fill="white"
            />
            <path
              d="M241.235 28.8183C242.918 30.1304 244.856 31.1958 246.939 31.9543C249.021 32.7123 251.206 33.1483 253.371 33.2369C255.536 33.3254 257.637 33.0643 259.554 32.4698C261.471 31.8757 263.168 30.9588 264.546 29.7711C265.925 28.5844 266.957 27.1501 267.587 25.5514C268.216 23.9523 268.429 22.2197 268.214 20.4525C267.999 18.6849 267.358 16.9177 266.331 15.2509C265.304 13.5844 263.909 12.051 262.226 10.7383L251.73 19.7785L241.235 28.8183Z"
              fill="white"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M152.752 0.384868V32.8683C152.752 33.0805 152.542 33.2532 152.284 33.2532H139.372C139.113 33.2532 138.904 33.0805 138.904 32.8683V0.384868C138.904 0.172428 139.113 0 139.372 0H152.284C152.542 0 152.752 0.172428 152.752 0.384868Z"
              fill="white"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M172.142 0.384868V32.8683C172.142 33.0805 171.932 33.2532 171.674 33.2532H158.763C158.505 33.2532 158.295 33.0805 158.295 32.8683V0.384868C158.295 0.172428 158.505 0 158.763 0H171.674C171.932 0 172.142 0.172428 172.142 0.384868Z"
              fill="white"
            />
            <path
              d="M172.142 7.92871H138.889V31.791H172.142V7.92871Z"
              fill="white"
            />
          </svg>
        </div>

        {/* BOTTOM METADATA */}

        <div
          ref={metaRef}
          className="flex flex-col-reverse md:flex-row items-start md:items-end justify-between font-geist-mono text-ghost-white text-[clamp(0.6rem,2.5vw,0.725rem)] uppercase w-full gap-2 pt-2"
        >
          <div className="flex flex-row md:contents justify-between w-full md:w-auto">
            <div className="flex flex-col md:flex-row space-y-0 space-x-[clamp(0.5rem,4.5vw,6rem)]">
              <span data-footer-meta>BASED IN ADELAIDE</span>

              <h2
                data-footer-meta
                className="hover:opacity-70 transition-opacity"
              >
                ARCHITECTURE / CONSTRUCTION / MORE
              </h2>
            </div>

            <div className="flex flex-col md:flex-row space-y-0 space-x-[clamp(0.5rem,4.5vw,6rem)]">
              <BlurFlicker>
                <a
                  data-footer-meta
                  href="mailto:hello@cloudhausmedia"
                  className="hover:opacity-70 transition-opacity"
                >
                  GET IN TOUCH
                </a>
              </BlurFlicker>

              <BlurFlicker>
                <a
                  data-footer-meta
                  href="https://www.withzane.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold hover:opacity-70 transition-opacity"
                >
                  WEBSITE BY: ZANE
                </a>
              </BlurFlicker>
            </div>
          </div>

          <div className="flex flex-row space-x-[clamp(0.5rem,4.5vw,6rem)]">
            <BlurFlicker>
              <a
                data-footer-meta
                href="#top"
                className="font-bold hover:opacity-70 transition-opacity"
              >
                BACK TO HOME
              </a>
            </BlurFlicker>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;