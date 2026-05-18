"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export const useScrollSmoother = (
  wrapperRef,
  { enabled = true } = {}
) => {
  useEffect(() => {
    if (!enabled || !wrapperRef.current) return;

    if (ScrollTrigger.isTouch) return;

    ScrollSmoother.get()?.kill();

    const content =
      wrapperRef.current.querySelector("#smooth-content");

    if (!content) return;

    const smoother = ScrollSmoother.create({
      wrapper: wrapperRef.current,
      content,
      smooth: 1.5,
      effects: true,
      normalizeScroll: true,
      ignoreMobileResize: true,
    });

    ScrollTrigger.refresh();

    return () => {
      smoother.kill();
    };
  }, [enabled]);
};