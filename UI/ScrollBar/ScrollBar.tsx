import "./ScrollBar.css";
import { useEffect, useRef } from "react";

/**
 * Custom vertical page scrollbar that mirrors the scroll position.
 *
 * Dependency-free: the scroll source is injected as a {@link Scroller}, so the
 * component itself knows nothing about GSAP, Lenis, or any other smooth-scroll
 * library. See `smootherScroller.ts` for the opt-in ScrollSmoother adapter.
 *
 * Performance: no React state, so it never re-renders. Layout reads happen only
 * on mount / resize in {@link measure}; the per-frame work is one cheap scroll
 * read plus a composited `transform`, skipped when the thumb hasn't moved. The
 * rAF loop parks itself once the position settles, so an idle page costs nothing.
 *
 * Styling: every dimension and colour is a `--sb-*` custom property — override
 * them from a wrapper class passed via `className`.
 */

/** Adapter over whatever actually scrolls the page. */
export interface Scroller {
  /** Current scroll offset in px. */
  get(): number;
  /** Scroll to an absolute offset in px. */
  set(top: number, smooth: boolean): void;
  /** Element whose `scrollHeight` defines the scrollable content. */
  content(): HTMLElement;
}

/** Default adapter: the native window scroll. */
export const windowScroller: Scroller = {
  get: () => window.scrollY,
  set: (top, smooth) => window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" }),
  content: () => document.documentElement,
};

export interface ScrollBarProps {
  /** Where the scroll position is read from and written to. @default windowScroller */
  scroller?: Scroller;
  /** Viewport edge to pin the bar to. @default "right" */
  side?: "left" | "right";
  /** Extra class on the root — the hook for overriding the `--sb-*` properties. */
  className?: string;
}

/** Frames of no movement before the rAF loop parks itself. */
const IDLE_FRAMES = 20;
/** Thumb height floor in px. Keep in sync with `.scrollbar__thumb { height }`. */
const MIN_THUMB = 20;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export default function ScrollBar({ scroller = windowScroller, side = "right", className }: ScrollBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Held in a ref so a caller passing an inline object doesn't tear down the
  // listeners on every render.
  const scrollerRef = useRef(scroller);
  useEffect(() => { scrollerRef.current = scroller; }, [scroller]);

  useEffect(() => {
    const root = rootRef.current!;
    const track = trackRef.current!;
    const thumb = thumbRef.current!;

    /** Cached layout + last rendered state, so no frame has to read the DOM. */
    const m = { max: 0, range: 0, thumbH: MIN_THUMB, top: -1, visible: false };
    const drag = { active: false, startY: 0, startTop: 0 };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let rafId = 0;
    let idle = 0;

    // Recompute cached metrics + thumb height. Triggers layout reads, so this
    // runs on mount / resize / content-size change only — never per frame.
    function measure(): void {
      const scrollH = scrollerRef.current.content().scrollHeight;
      const view = window.innerHeight;
      const trackH = track.clientHeight;
      // Thumb height is proportional to the visible fraction, with a floor.
      const thumbH = Math.max(MIN_THUMB, (view / Math.max(scrollH, 1)) * trackH);

      m.max = scrollH - view;
      m.range = trackH - thumbH;
      m.thumbH = thumbH;

      const height = `${thumbH}px`;
      if (thumb.style.height !== height) thumb.style.height = height;

      // Hide when there's nothing to scroll, or no room for the thumb to travel.
      const visible = m.max > 0 && m.range > 0;
      if (visible !== m.visible) {
        m.visible = visible;
        m.top = -1; // force the next tick to write
        root.classList.toggle("is-active", visible);
      }
    }

    // Map scroll position onto thumb offset. Returns whether anything moved, so
    // the loop knows when it can stop.
    function tick(): boolean {
      if (!m.visible) return false;
      const top = clamp(scrollerRef.current.get() / m.max, 0, 1) * m.range;
      if (top === m.top) return false;
      m.top = top;
      thumb.style.transform = `translateY(${top}px)`;
      return true;
    }

    function frame(): void {
      rafId = 0;
      idle = tick() || drag.active ? 0 : idle + 1;
      if (idle <= IDLE_FRAMES) rafId = requestAnimationFrame(frame);
    }

    /** Restart the loop (or extend it) because something is about to move. */
    function wake(): void {
      idle = 0;
      if (!rafId) rafId = requestAnimationFrame(frame);
    }

    function scrollToPct(pct: number, smooth: boolean): void {
      scrollerRef.current.set(clamp(pct, 0, 1) * m.max, smooth && !reduceMotion.matches);
    }

    // Pointer capture keeps the drag alive off the thumb without document-level
    // listeners, and covers pen/hybrid input, not just mouse.
    function onThumbDown(e: PointerEvent): void {
      if (e.button !== 0) return;
      e.preventDefault(); // don't start a text selection
      thumb.setPointerCapture(e.pointerId);
      drag.active = true;
      drag.startY = e.clientY;
      drag.startTop = m.top;
      root.classList.add("is-dragging");
      wake();
    }

    function onThumbMove(e: PointerEvent): void {
      if (!drag.active) return;
      // Instant, never smoothed: smoothing a drag leaves the thumb lagging the cursor.
      scrollToPct((drag.startTop + e.clientY - drag.startY) / m.range, false);
    }

    function onThumbUp(e: PointerEvent): void {
      if (!drag.active) return;
      drag.active = false;
      if (thumb.hasPointerCapture(e.pointerId)) thumb.releasePointerCapture(e.pointerId);
      root.classList.remove("is-dragging");
    }

    // Press the track: jump so the thumb centers on the press. The thumb is a
    // sibling painted on top, so it swallows its own presses and a finished
    // drag can never fall through to here.
    function onTrackDown(e: PointerEvent): void {
      if (e.button !== 0) return;
      const top = e.clientY - track.getBoundingClientRect().top - m.thumbH / 2;
      scrollToPct(top / m.range, true);
      wake();
    }

    function onResize(): void { measure(); wake(); }

    measure();
    tick();

    const ro = new ResizeObserver(onResize);
    ro.observe(track);
    ro.observe(document.documentElement);

    thumb.addEventListener("pointerdown", onThumbDown);
    thumb.addEventListener("pointermove", onThumbMove);
    thumb.addEventListener("pointerup", onThumbUp);
    thumb.addEventListener("pointercancel", onThumbUp);
    track.addEventListener("pointerdown", onTrackDown);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      thumb.removeEventListener("pointerdown", onThumbDown);
      thumb.removeEventListener("pointermove", onThumbMove);
      thumb.removeEventListener("pointerup", onThumbUp);
      thumb.removeEventListener("pointercancel", onThumbUp);
      track.removeEventListener("pointerdown", onTrackDown);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    // aria-hidden: native scrolling and keyboard paging still work, so this is
    // purely decorative. A `role="scrollbar"` would promise focus and arrow-key
    // handling it doesn't implement.
    <div
      ref={rootRef}
      className={`scrollbar scrollbar--${side}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <div ref={trackRef} className="scrollbar__track" />
      <div ref={thumbRef} className="scrollbar__thumb" />
    </div>
  );
}
