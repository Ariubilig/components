import React, { useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(SplitText, ScrollTrigger);

interface ChildProps {
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLElement>;
}

interface RevealProps {
  children: React.ReactNode;
  type?: string;
  animateOnScroll?: boolean;
  delay?: number;
  duration?: number;
  stagger?: number;
  ease?: string;
  scrollTriggerStart?: string;
  className?: string;
  style?: React.CSSProperties;
  wrapperTag?: string;
}

export default function Reveal({
  children,
  type = "lines",
  animateOnScroll = true,
  delay = 0,
  duration = 1,
  stagger,
  ease = "power4.out",
  scrollTriggerStart = "top 75%",
  className = "",
  style = {},
  wrapperTag = "div",
}: RevealProps) {
  const containerRef = useRef<HTMLElement>(null);
  const splitRefs = useRef<SplitText[]>([]);
  const targets = useRef<Element[]>([]);

  // Smart default stagger based on split type
  const effectiveStagger = stagger ?? (type === "chars" ? 0.03 : 0.1);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const reveal = () => {
        if (containerRef.current) {
          containerRef.current.style.visibility = "visible";
        }
      };

      // Prevent async setup from running after cleanup
      let isActive = true;
      const localSplits: SplitText[] = [];

      document.fonts.ready.then(() => {
        if (!isActive || !containerRef.current) return;

        splitRefs.current.forEach(split => split?.revert());
        splitRefs.current = [];
        targets.current = [];

        const container = containerRef.current;

        const elements: HTMLElement[] = container.hasAttribute("data-text-wrapper")
          ? (Array.from(container.children) as HTMLElement[])
          : [container];

        elements.forEach(element => {
          try {
            const splitOptions =
              type === "chars"
                ? {
                    type: "chars" as const,
                    mask: "chars" as const,
                    charsClass: "char++",
                  }
                : {
                    type: "lines" as const,
                    mask: "lines" as const,
                    linesClass: "line++",
                    lineThreshold: 0.1,
                  };

            const split = SplitText.create(element, splitOptions);

            splitRefs.current.push(split);
            localSplits.push(split);

            // Preserve first-line text indent
            if (type === "lines") {
              const computedStyle = window.getComputedStyle(element);
              const textIndent = computedStyle.textIndent;

              if (textIndent && textIndent !== "0px") {
                if (split.lines.length > 0) {
                  (split.lines[0] as HTMLElement).style.paddingLeft = textIndent;
                }

                element.style.textIndent = "0";
              }
            }

            const pieces = type === "chars" ? split.chars : split.lines;

            targets.current.push(...(pieces as Element[]));
          } catch (error) {
            console.warn(`TextReveal: Failed to split element (type=${type})`, error);
          }
        });

        if (!isActive) {
          localSplits.forEach(split => split?.revert());
          return;
        }

        if (targets.current.length === 0) {
          reveal();
          return;
        }

        gsap.set(targets.current, { y: "100%" });

        reveal();

        const animationProps = {
          y: "0%",
          duration,
          stagger: effectiveStagger,
          ease,
          delay,
        };

        if (animateOnScroll) {
          gsap.to(targets.current, {
            ...animationProps,
            scrollTrigger: {
              trigger: containerRef.current,
              start: scrollTriggerStart,
              once: true,
              // markers: true,
            },
          });

          ScrollTrigger.refresh();
        } else {
          gsap.to(targets.current, animationProps);
        }
      });

      return () => {
        isActive = false;

        splitRefs.current.forEach(split => split?.revert());

        ScrollTrigger.getAll().forEach(st => {
          if (st.trigger === containerRef.current) {
            st.kill();
          }
        });
      };
    },
    {
      scope: containerRef,
      dependencies: [
        type,
        animateOnScroll,
        delay,
        duration,
        effectiveStagger,
        ease,
        scrollTriggerStart,
      ],
    }
  );

  // Hide initially to prevent flash before split setup
  const hiddenStyle: React.CSSProperties = {
    visibility: "hidden",
  };

  if (React.Children.count(children) === 1) {
    const child = children as React.ReactElement<ChildProps>;

    return React.cloneElement(child, {
      ref: containerRef,
      className: `${child.props.className || ""} ${className}`.trim(),
      style: {
        ...child.props.style,
        ...style,
        ...hiddenStyle,
      },
    });
  }

  const WrapperComponent = wrapperTag as React.ElementType;

  return (
    <WrapperComponent
      ref={containerRef}
      data-text-wrapper="true"
      className={className}
      style={{ ...style, ...hiddenStyle }}
    >
      {children}
    </WrapperComponent>
  );
}