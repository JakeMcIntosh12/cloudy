"use client";

import React, {
  useState,
  useRef,
  useCallback,
} from "react";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/Assets/Logo/cloud.svg";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import BlurFlicker from "../Animations/BlurFlicker";
import TransitionLink from "../PageTransitions/TransitionLink";

gsap.registerPlugin(ScrollTrigger);

function Navigation({
  isMuted = true,
  onToggleSound,
}) {
  const navRef = useRef(null);
  const logoRef = useRef(null);
  const linksRef = useRef(null);
  const rightActionsRef = useRef(null);

  const menuOverlayRef = useRef(null);
  const menuContentRef = useRef(null);

  const menuOpenTimelineRef = useRef(null);
  const menuCloseTimelineRef = useRef(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false);

  const lockBodyScroll = useCallback(() => {
    document.body.style.overflow = "hidden";
  }, []);

  const unlockBodyScroll = useCallback(() => {
    document.body.style.overflow = "";
  }, []);

  useGSAP(
    () => {
      if (!navRef.current) return;

      const nav = navRef.current;
      const logo = logoRef.current;
      const links = linksRef.current;
      const rightActions = rightActionsRef.current;

      const overlay = menuOverlayRef.current;
      const menuContent = menuContentRef.current;

      /* =====================================================
          INITIAL NAVIGATION STATE
      ===================================================== */

      gsap.set([logo, links, rightActions], {
        opacity: 1,
        x: 0,
        y: 0,
      });

      /* =====================================================
          FOOTER NAVIGATION ANIMATION
      ===================================================== */

      const footerEl =
        document.querySelector("#footer");

      if (footerEl) {
        ScrollTrigger.create({
          trigger: footerEl,
          start: "top top+=200",
          end: "bottom bottom",

          onEnter: () => {
            gsap.killTweensOf([
              logo,
              links,
              rightActions,
            ]);

            gsap.to(links, {
              opacity: 0,
              y: -80,
              duration: 0.8,
              ease: "power2.inOut",
              overwrite: true,
            });

            gsap.to(logo, {
              opacity: 0,
              x: -80,
              duration: 0.8,
              ease: "power2.inOut",
              overwrite: true,
            });

            gsap.to(rightActions, {
              opacity: 0,
              x: 80,
              duration: 0.8,
              ease: "power2.inOut",
              overwrite: true,
            });

            gsap.set(nav, {
              pointerEvents: "none",
            });
          },

          onLeaveBack: () => {
            gsap.killTweensOf([
              logo,
              links,
              rightActions,
            ]);

            gsap.to(
              [logo, links, rightActions],
              {
                opacity: 1,
                x: 0,
                y: 0,
                duration: 0.4,
                ease: "power2.out",
                overwrite: true,
              }
            );

            gsap.set(nav, {
              pointerEvents: "auto",
            });
          },
        });
      }

      /* =====================================================
          MOBILE MENU TIMELINES
      ===================================================== */

      if (!overlay || !menuContent) return;

      const linkItems =
        menuContent.querySelectorAll(
          ".menu-anim-item"
        );

      // Hide overlay and reset elements off-screen initially
      gsap.set(overlay, {
        visibility: "hidden",
        clipPath:
          "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
        pointerEvents: "none",
      });

      gsap.set(linkItems, {
        yPercent: 100,
        opacity: 0,
      });

      /* =====================================================
          OPEN TIMELINE
      ===================================================== */

      const openTl = gsap.timeline({
        paused: true,
      });

      openTl
        .set(overlay, {
          visibility: "visible",
          pointerEvents: "auto",
        })
        .to(overlay, {
          clipPath:
            "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          duration: 0.75,
          ease: "power3.inOut",
        })
        .to(
          linkItems,
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.85,
            stagger: 0.08,
            ease: "power3.out",
          },
          "-=0.4"
        );

      /* =====================================================
          CLOSE TIMELINE
      ===================================================== */

      const closeTl = gsap.timeline({
        paused: true,

        onComplete: () => {
          gsap.set(overlay, {
            visibility: "hidden",
            pointerEvents: "none",
            clipPath:
              "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
          });

          gsap.set(linkItems, {
            yPercent: 100,
            opacity: 0,
          });

          unlockBodyScroll();
        },
      });

      closeTl
        .to(linkItems, {
          yPercent: -100,
          opacity: 0,
          duration: 1.2,
          stagger: -0.03,
          ease: "power3.in",
        })
        .to(
          overlay,
          {
            clipPath:
              "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
            duration: 0.6,
            ease: "power3.inOut",
          },
          "-=0.2"
        );

      menuOpenTimelineRef.current = openTl;
      menuCloseTimelineRef.current = closeTl;
    },
    {
      scope: navRef,
      dependencies: [],
      revertOnUpdate: true,
    }
  );

  /* =======================================================
      MOBILE MENU TOGGLE HANDLER
  ======================================================= */

  const toggleMobileMenu = useCallback(() => {
    const openTl =
      menuOpenTimelineRef.current;

    const closeTl =
      menuCloseTimelineRef.current;

    const overlay =
      menuOverlayRef.current;

    if (!openTl || !closeTl) return;

    if (!isMobileMenuOpen) {
      // =====================================================
      // OPEN MENU
      // =====================================================

      setIsMobileMenuOpen(true);

      lockBodyScroll();

      closeTl.pause(0);

      gsap.set(overlay, {
        visibility: "visible",
        pointerEvents: "auto",
      });

      openTl.restart();
    } else {
      // =====================================================
      // CLOSE MENU
      // =====================================================

      setIsMobileMenuOpen(false);

      openTl.pause();

      closeTl.restart();
    }
  }, [
    isMobileMenuOpen,
    lockBodyScroll,
  ]);

  /* =======================================================
      MOBILE MENU NAVIGATION
      ======================================================= */

  const handleMenuNavigation =
    useCallback(() => {
      const openTl =
        menuOpenTimelineRef.current;

      const closeTl =
        menuCloseTimelineRef.current;

      const overlay =
        menuOverlayRef.current;

      // -----------------------------------------------------
      // IMPORTANT:
      // Release body scrolling IMMEDIATELY.
      //
      // We do not wait for the menu close animation.
      // The route transition is already taking over the
      // screen, so there is no reason for the menu to remain
      // interactive while navigation is happening.
      // -----------------------------------------------------

      unlockBodyScroll();

      setIsMobileMenuOpen(false);

      // Stop menu animations
      openTl?.pause();
      closeTl?.pause();

      // Immediately remove the menu from interaction
      // and hide it so it cannot sit above the new page.
      if (overlay) {
        gsap.killTweensOf(overlay);

        gsap.set(overlay, {
          visibility: "hidden",
          pointerEvents: "none",
          clipPath:
            "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
        });
      }

      // Reset menu items
      if (menuContentRef.current) {
        const linkItems =
          menuContentRef.current.querySelectorAll(
            ".menu-anim-item"
          );

        gsap.killTweensOf(linkItems);

        gsap.set(linkItems, {
          yPercent: 100,
          opacity: 0,
        });
      }
    }, [unlockBodyScroll]);

  return (
    <>
      <nav
        ref={navRef}
        className="fixed top-0 left-0 flex flex-row items-center justify-between w-full text-ghost-white p-4 md:px-6 md:py-6 z-[100]"
      >
        <div
          ref={logoRef}
          className="mix-blend-difference pointer-events-auto [isolation:auto]"
        >
          <Link
            href="/"
            className="block"
          >
            <Image
              src={Logo}
              alt="Logo"
              width={200}
              height={60}
              priority
              className="w-[clamp(140px,10vw+80px,320px)] h-auto"
            />
          </Link>
        </div>

        <div
          ref={linksRef}
          className="hidden md:flex items-center justify-center space-x-4 font-mono uppercase text-[clamp(0.75rem,0.65rem+0.35vw,1.2rem)] translate-x-[clamp(0px,12vw,190px)] pointer-events-auto"
        >
          <BlurFlicker>
            <TransitionLink href="/About">
              ABOUT
            </TransitionLink>
          </BlurFlicker>

          <BlurFlicker>
            <TransitionLink href="/All-Works">
              WORKS
            </TransitionLink>
          </BlurFlicker>

          <BlurFlicker>
            <TransitionLink href="/Weddings">
              VOWS
            </TransitionLink>
          </BlurFlicker>

          <BlurFlicker>
            <TransitionLink href="/#footer">
              CONTACT
            </TransitionLink>
          </BlurFlicker>
        </div>

        <div
          ref={rightActionsRef}
          className="flex items-center space-x-2 sm:space-x-3 pointer-events-auto"
        >
          <BlurFlicker>
            <Link
              type="button"
              href='/#footer'
              className="hidden md:flex bg-black hover:bg-zinc-800 transition-colors px-[clamp(16px,1vw+8px,16px)] py-0 w-[clamp(155px,12vw+70px,204px)] h-[clamp(44px,2.5vw+20px,55px)] rounded-full border border-eclipse font-mono tracking-tighter uppercase text-[clamp(0.3rem,0.63rem+0.3vw,1.25rem)] text-center items-center justify-center text-ghost-white cursor-pointer"
            >
              Check availability
            </Link>
          </BlurFlicker>

          <button
            type="button"
            onClick={toggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
            aria-label={
              isMobileMenuOpen
                ? "Close menu"
                : "Open menu"
            }
            className="flex md:hidden bg-ghost-white hover:bg-zinc-200 transition-colors px-5 py-0 h-[clamp(44px,2.5vw+20px,55px)] rounded-full border border-ghost-white font-mono tracking-tighter uppercase text-[clamp(0.75rem,0.63rem+0.3vw,1rem)] text-carbon-black items-center justify-center font-bold cursor-pointer"
          >
            {isMobileMenuOpen
              ? "Close"
              : "Menu"}
          </button>
        </div>
      </nav>

      <div
        ref={menuOverlayRef}
        className="fixed inset-0 z-[110] bg-black flex flex-col justify-between text-ghost-white md:hidden h-[85vh] border-b border-eclipse pointer-events-none"
      >
        <div className="flex items-center justify-between w-full p-4">
          <Link
            href="/"
            onClick={handleMenuNavigation}
          >
            <Image
              src={Logo}
              alt="Logo"
              width={160}
              height={48}
              priority
              className="w-36 h-auto"
            />
          </Link>

          <button
            type="button"
            onClick={toggleMobileMenu}
            className="bg-ghost-white text-carbon-black px-4 h-11 rounded-full font-mono text-xs uppercase font-bold flex items-center justify-center"
          >
            Close
          </button>
        </div>

        <div
          ref={menuContentRef}
          className="relative z-[1] flex flex-col font-sans text-6xl uppercase font-medium my-auto tracking-[-6%] p-6 pointer-events-auto"
        >
          <div className="overflow-hidden">
            <TransitionLink
              href="/"
              onClick={handleMenuNavigation}
              className="menu-anim-item inline-block hover:text-zinc-400 transition-colors leading-none"
            >
              HOME
            </TransitionLink>
          </div>

          <div className="overflow-hidden mt-3">
            <TransitionLink
              href="/About"
              onClick={handleMenuNavigation}
              className="menu-anim-item inline-block hover:text-zinc-400 transition-colors leading-none"
            >
              ABOUT
            </TransitionLink>
          </div>

          <div className="overflow-hidden mt-3">
            <TransitionLink
              href="/All-Works"
              onClick={handleMenuNavigation}
              className="menu-anim-item inline-block hover:text-zinc-400 transition-colors leading-none"
            >
              WORKS
            </TransitionLink>
          </div>

          <div className="overflow-hidden mt-3">
            <div className="menu-anim-item">
              <TransitionLink
                href="/Weddings"
                onClick={handleMenuNavigation}
                className="inline-flex items-start hover:text-zinc-400 transition-colors leading-none"
              >
                <span>
                 VOWS
                </span>

                
              </TransitionLink>
            </div>
          </div>

          <div className="overflow-hidden mt-6">
            <TransitionLink
              href="/#footer"
              onClick={handleMenuNavigation}
              className="menu-anim-item inline-block hover:text-zinc-400 transition-colors leading-none"
            >
              CONTACT
            </TransitionLink>
          </div>
        </div>

        <div className="pt-6 flex flex-row items-start justify-between w-full space-y-4 p-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-zinc-600 font-mono font-medium tracking-tight text-[clamp(0.70rem,0.65vw+0.3rem,1rem)]">
              SOCIALS
            </h1>

            <div className="flex flex-row w-full items-center gap-4 text-[clamp(0.8rem,0.65vw+0.3rem,1.25rem)] font-mono tracking-tight uppercase">
              <Link
                className="hover:text-zinc-700"
                href="https://instagram.com/itsjmvisuals"
                target="_blank"
                rel="noopener noreferrer"
              >
                INSTAGRAM
              </Link>

              <Link
                className="hover:text-zinc-700"
                href="https://vimeo.com/user135969253"
                target="_blank"
                rel="noopener noreferrer"
              >
                VIMEO
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Navigation;