import { FC, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

const palette = ["#49EACB", "#70C7BA", "#9CA3AF", "#1F2937"];
const MIN_SEG = 2,
  MAX_SEG = 14,
  STATIC_SEG = 8,
  CYCLE = 2000,
  SEGMENTS = 16;

export const AvatarHash: FC<{
  address: string;
  size?: number;
  className?: string;
  selected?: boolean;
}> = ({ address, size = 32, className, selected = false }) => {
  const [segments, setSegments] = useState(STATIC_SEG);
  const raf = useRef<number>();

  /* animate number of active pairs when selected */
  useEffect(() => {
    if (!selected) return setSegments(STATIC_SEG);
    const t0 = performance.now();
    const loop = (t: number) => {
      const phase = ((t - t0) % (CYCLE * 2)) / CYCLE; // 0-2
      setSegments(
        Math.round(
          phase < 1
            ? MIN_SEG + (MAX_SEG - MIN_SEG) * phase
            : MAX_SEG - (MAX_SEG - MIN_SEG) * (phase - 1)
        )
      );
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [selected]);

  /* deterministic 32-bit hash */
  const hash = useMemo(() => {
    let h = 0;
    for (let i = 0; i < address.length; i++)
      h = ((h << 5) - h + address.charCodeAt(i)) | 0;
    return h >>> 0;
  }, [address]);

  const c = size / 2,
    rDot = size * 0.09,
    rRing = c - rDot,
    start = -Math.PI / 2;

  /* precalculate all 32 dots with per-dot visibility */
  const base = useMemo(
    () =>
      Array.from({ length: SEGMENTS }, (_, i) => {
        const θ = start + (2 * Math.PI * i) / SEGMENTS;
        return { cx: c + rRing * Math.cos(θ), cy: c + rRing * Math.sin(θ) };
      }),
    [c, rRing]
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={clsx(
        "rounded-full bg-gray-100 dark:bg-gray-700",
        !selected && "opacity-80",
        className
      )}
    >
      {base.map(({ cx, cy }, i) => {
        const idx = i % (SEGMENTS / 2);
        const on = idx < segments;
        const col = palette[(hash >> (idx + 7)) & 3];
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={rDot}
            fill={col}
            className={clsx(
              "transition-opacity duration-300",
              !on && "opacity-0"
            )}
          />
        );
      })}
    </svg>
  );
};
