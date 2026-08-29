// gsap declares the "gsap/ScrollSmoother" module inside its main type entry, so
// that entry has to be in the program for the import below to resolve. Type-only,
// so nothing is emitted.
import type {} from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import type { Scroller } from "./ScrollBar";

/**
 * Opt-in {@link Scroller} adapter for GSAP ScrollSmoother:
 *
 *   <ScrollBar scroller={smootherScroller} />
 *
 * Kept in its own module so projects that don't smooth-scroll never pull GSAP
 * into the bundle. Every call re-resolves the instance, so it also works when
 * the smoother is created after the scrollbar mounts, and falls back to the
 * window whenever no instance exists.
 */
export const smootherScroller: Scroller = {
  get: () => ScrollSmoother.get()?.scrollTop() ?? window.scrollY,

  set: (top, smooth) => {
    const smoother = ScrollSmoother.get();
    // Deliberately an if/else: `smoother?.scrollTo(...) ?? window.scrollTo(...)`
    // reads well but scrollTo returns void, so the fallback always ran too and
    // both scrollers fought over the position.
    if (smoother) smoother.scrollTo(top, smooth);
    else window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  },

  content: () => (ScrollSmoother.get()?.content() as HTMLElement | undefined) ?? document.documentElement,
};
