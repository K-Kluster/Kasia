import React, { FC, useMemo } from "react";

const kaspaPalette = ["#70C7BA", "#231F20", "#B6B6B6", "#49EACB"];

export const AvatarHash: FC<{ address: string; size?: number }> = ({
  address,
  size = 32,
}) => {
  const hash = useMemo(() => {
    let h = 0;
    for (let i = 0; i < address.length; i++) {
      h = (h << 5) - h + address.charCodeAt(i);
      h |= 0;
    }
    return h;
  }, [address]);

  const cellSize = size / 5;
  const coords = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    let idx = 0;
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 5; y++) {
        if ((hash >> idx) & 1) {
          out.push({ x, y }, { x: 4 - x, y });
        }
        idx++;
      }
    }
    return out;
  }, [hash]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-full bg-gray-500"
    >
      {coords.map(({ x, y }, i) => (
        <rect
          key={i}
          x={x * cellSize}
          y={y * cellSize}
          width={cellSize}
          height={cellSize}
          fill={kaspaPalette[(hash >> i) & (kaspaPalette.length - 1)]}
        />
      ))}
    </svg>
  );
};
