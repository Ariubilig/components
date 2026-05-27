import "./ScrollBar.css";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";

/**
 * Custom vertical scrollbar that mirrors the page scroll position.
 *
 * Works with or without GSAP ScrollSmoother:
 *  - if a ScrollSmoother instance exists, it reads/writes the smoothed scroll;
 *  - otherwise it falls back to the native window scroll.
 *
 * Performance: expensive layout reads (scrollHeight/clientHeight) happen only
 * on resize via {@link measure}. The per-frame {@link tick} just reads the
 * cheap scrollTop and writes a GPU-composited `transform`, and only when the
 * thumb actually moved.
 *
 * Usage: render once near the app root, e.g. `<ScrollBar />`.
 */

/** Cached layout values + last rendered state. Avoids re-querying the DOM each frame. */
interface ScrollMetrics {
  /** Max scrollable distance in px (scrollHeight - viewport height). */
  max: number;
  /** Travel range of the thumb inside the track in px (trackHeight - thumbHeight). */
  range: number;
  /** Current thumb height in px. */
  thumbH: number;
  /** Last `translateY` applied to the thumb in px; `-1` forces the first write. */
  top: number;
  /** Whether the page is scrollable (and the scrollbar is shown). */
  visible: boolean;
}

/** Pointer-drag state for the thumb. */
interface DragState {
  /** True while the thumb is being dragged. */
  active: boolean;
  /** Pointer Y at drag start, in px. */
  startY: number;
  /** Thumb `top` at drag start, in px. */
  startTop: number;
}

/** Current ScrollSmoother instance, or `undefined` if smoothing isn't active. */
const getSmoother = (): ScrollSmoother | undefined => ScrollSmoother.get();

/** Current scroll offset in px, from the smoother if present, else the window. */
const getScrollY = (): number => getSmoother()?.scrollTop() ?? window.scrollY;

/**
 * Scroll the page to a fractional position.
 * @param pct Target position 0..1 (clamped); 0 = top, 1 = bottom.
 * @param max Max scrollable distance in px.
 */
const scrollTo = (pct: number, max: number): void => {
  const top = Math.max(0, Math.min(1, pct)) * max;
  getSmoother()?.scrollTo(top, true) ?? window.scrollTo({ top, behavior: "smooth" });
};

export default function ScrollBar() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const m = useRef<ScrollMetrics>({ max: 0, range: 0, thumbH: 20, top: -1, visible: false });
  const drag = useRef<DragState>({ active: false, startY: 0, startTop: 0 });

  useEffect(() => {
    const root = rootRef.current!;
    const track = trackRef.current!;
    const thumb = thumbRef.current!;

    // Recompute cached metrics + thumb height. Triggers layout reads, so only
    // call on mount / resize / content-size change — never per frame.
    function measure(): void {
      const content = getSmoother()?.content() as HTMLElement | undefined;
      const scrollH = content?.scrollHeight ?? document.documentElement.scrollHeight;
      const max = scrollH - window.innerHeight;
      const trackH = track.clientHeight;
      // Thumb height is proportional to the visible fraction, with a 20px floor.
      const thumbH = Math.max(20, (window.innerHeight / (max + window.innerHeight)) * trackH);
      const visible = max > 0;

      m.current.max = max;
      m.current.range = trackH - thumbH;
      m.current.thumbH = thumbH;
      thumb.style.height = `${thumbH}px`;

      // Toggle visibility only on change to avoid redundant style writes.
      if (visible !== m.current.visible) {
        m.current.visible = visible;
        root.style.opacity = visible ? "1" : "0";
        root.style.pointerEvents = visible ? "auto" : "none";
      }
    }

    // Per-frame: map scroll position to thumb offset. Cheap read, composited
    // write, and skipped entirely when the thumb hasn't moved.
    function tick(): void {
      if (!m.current.visible) return;
      const top = (getScrollY() / m.current.max) * m.current.range;
      if (top !== m.current.top) {
        m.current.top = top;
        thumb.style.transform = `translateY(${top}px)`;
      }
    }

    measure();
    tick();
    gsap.ticker.add(tick);

    // Re-measure when the track or scrollable content changes size (e.g. async
    // content loading on a news page changing the page height).
    const ro = new ResizeObserver(() => { measure(); tick(); });
    ro.observe(track);
    const content = getSmoother()?.content() as HTMLElement | undefined;
    ro.observe(content ?? document.documentElement);
    window.addEventListener("resize", measure);

    return () => {
      gsap.ticker.remove(tick);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Drag-to-scroll: listeners live on document so the drag continues even when
  // the pointer leaves the thin thumb.
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (!drag.current.active) return;
      const pct = (drag.current.startTop + e.clientY - drag.current.startY) / m.current.range;
      scrollTo(pct, m.current.max);
    };
    const onUp = (): void => { drag.current.active = false; };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Start a drag and capture the thumb's current position as the anchor.
  function onThumbMouseDown(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation(); // don't let the track's onClick also fire
    drag.current = { active: true, startY: e.clientY, startTop: m.current.top };
  }

  // Click on the track (not the thumb): jump so the thumb centers on the click.
  function onTrackClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === thumbRef.current || !trackRef.current) return;
    const top = e.clientY - trackRef.current.getBoundingClientRect().top - m.current.thumbH / 2;
    scrollTo(top / m.current.range, m.current.max);
  }

  return (
    <div ref={rootRef} className="scrollbar" onClick={onTrackClick}
      role="scrollbar" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100}
    >
      <div ref={trackRef} className="scrollbar__track" />
      <div ref={thumbRef} className="scrollbar__thumb" onMouseDown={onThumbMouseDown} />
    </div>
  );
}
