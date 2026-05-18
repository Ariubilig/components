"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export const useScrollSmoother = (
  wrapperRef: RefObject<HTMLDivElement | null>,
  { enabled = true } = {}
) => {
  useEffect(() => {
    if (!enabled || !wrapperRef.current) return;

    // Disable on touch devices
    if (ScrollTrigger.isTouch) return;

    // Prevent duplicate smoothers
    ScrollSmoother.get()?.kill();

    const content =
      wrapperRef.current.querySelector<HTMLElement>(
        "#smooth-content"
      );

    if (!content) return;

    const smoother = ScrollSmoother.create({
      wrapper: wrapperRef.current,
      content,
      smooth: 1.5,
      effects: true,
      normalizeScroll: true,
      ignoreMobileResize: true,
    });

    ScrollTrigger.refresh(true);

    return () => {
      smoother.kill();
    };
  }, [enabled]);
};