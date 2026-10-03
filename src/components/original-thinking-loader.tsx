"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import styles from "./original-thinking-loader.module.css";

export type OriginalThinkingLoaderColors = {
  head?: string;
  firstTrail?: string;
  secondTrail?: string;
  tail?: string;
};

type OriginalThinkingLoaderProps = {
  className?: string;
  colors?: OriginalThinkingLoaderColors;
  size?: number;
  strokeWidth?: number;
};

const PARTICLE_COUNT = 64;
const BASE_RADIUS = 7.1;
const DETAIL_RADIUS = 2.55;
const PETALS = 6;
const SCALE = 4.15;
const TRAIL_SPAN = 0.34;
const SHAPE_DURATION_MS = 7200;
const LAP_DURATION_MS = 4200;
const SVG_CENTER = 50;
const PATH_STEPS = 280;
const DEFAULT_COLORS = {
  head: "#ffffff",
  firstTrail: "#86ccff",
  secondTrail: "#7975ff",
  tail: "#aa6fff"
} satisfies Required<OriginalThinkingLoaderColors>;

function normalizeProgress(progress: number) {
  return ((progress % 1) + 1) % 1;
}

function smoothStep(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function getShapeProgress(cycleProgress: number) {
  if (cycleProgress < 0.22) return 0;
  if (cycleProgress < 0.52) return smoothStep((cycleProgress - 0.22) / 0.3) * 0.62;
  if (cycleProgress < 0.78) return 0.62 + smoothStep((cycleProgress - 0.52) / 0.26) * 0.48;
  return 1.1 * (1 - smoothStep((cycleProgress - 0.78) / 0.22));
}

function getPoint(progress: number, shapeProgress: number) {
  const normalized = normalizeProgress(progress);
  const t = normalized * Math.PI * 2;
  const curlProgress = smoothStep((shapeProgress - 0.56) / 0.54);
  const detail = DETAIL_RADIUS * shapeProgress + 1.35 * curlProgress;
  const base = BASE_RADIUS - 0.42 * curlProgress;
  const x = base * Math.cos(t) - detail * Math.cos(PETALS * t);
  const y = base * Math.sin(t) - detail * Math.sin(PETALS * t);

  return {
    x: SVG_CENTER + x * SCALE,
    y: SVG_CENTER + y * SCALE
  };
}

function buildPath(shapeProgress: number) {
  return Array.from({ length: PATH_STEPS + 1 }, (_, index) => {
    const point = getPoint(index / PATH_STEPS, shapeProgress);
    return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}

function mixColor(from: string, to: string, amount: number) {
  const percent = Math.round(Math.min(1, Math.max(0, amount)) * 100);
  return `color-mix(in srgb, ${from} ${100 - percent}%, ${to} ${percent}%)`;
}

function getParticleColor(tailOffset: number, colors: Required<OriginalThinkingLoaderColors>) {
  if (tailOffset < 0.18) return mixColor(colors.head, colors.firstTrail, tailOffset / 0.18);
  if (tailOffset < 0.58) return mixColor(colors.firstTrail, colors.secondTrail, (tailOffset - 0.18) / 0.4);
  return mixColor(colors.secondTrail, colors.tail, (tailOffset - 0.58) / 0.42);
}

export default function OriginalThinkingLoader({
  className,
  colors,
  size = 84,
  strokeWidth = 5.3
}: OriginalThinkingLoaderProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const particleRefs = useRef<Array<SVGCircleElement | null>>([]);
  const pathGradientId = useId().replace(/:/g, "");
  const resolvedColors = useMemo(
    () => ({
      ...DEFAULT_COLORS,
      ...colors
    }),
    [colors]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let startedAt = performance.now();

    const renderFrame = (time: number) => {
      const elapsed = time - startedAt;
      const cycleProgress = (elapsed % SHAPE_DURATION_MS) / SHAPE_DURATION_MS;
      const shapeProgress = getShapeProgress(cycleProgress);
      const lapProgress = (elapsed % LAP_DURATION_MS) / LAP_DURATION_MS;

      pathRef.current?.setAttribute("d", buildPath(shapeProgress));

      particleRefs.current.forEach((node, index) => {
        if (!node) return;
        const tailOffset = index / (PARTICLE_COUNT - 1);
        const point = getPoint(lapProgress - tailOffset * TRAIL_SPAN, shapeProgress);
        const fade = Math.pow(1 - tailOffset, 0.58);
        node.setAttribute("cx", point.x.toFixed(2));
        node.setAttribute("cy", point.y.toFixed(2));
        node.setAttribute("r", (0.62 + fade * 2.75).toFixed(2));
        node.setAttribute("opacity", (0.04 + fade * 0.96).toFixed(3));
        node.setAttribute("fill", getParticleColor(tailOffset, resolvedColors));
      });
    };

    const tick = (now: number) => {
      renderFrame(now);
      frameId = window.requestAnimationFrame(tick);
    };

    if (mediaQuery.matches) {
      startedAt = performance.now() - SHAPE_DURATION_MS * 0.62;
      renderFrame(performance.now());
      return undefined;
    }

    renderFrame(startedAt);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [resolvedColors]);

  return (
    <svg
      className={`${styles.loader}${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={pathGradientId} x1="20" y1="22" x2="82" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor={resolvedColors.firstTrail} />
          <stop offset="0.52" stopColor={resolvedColors.secondTrail} />
          <stop offset="1" stopColor={resolvedColors.tail} />
        </linearGradient>
      </defs>
      <g className={styles.motionGroup}>
        <path
          ref={pathRef}
          className={styles.path}
          stroke={`url(#${pathGradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g className={styles.particles}>
          {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
            <circle
              key={index}
              ref={(node) => {
                particleRefs.current[index] = node;
              }}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}
