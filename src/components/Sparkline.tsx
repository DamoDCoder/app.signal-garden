/**
 * A trend line for one counter, not a chart in its own right.
 *
 * No axes, no gridlines: a sparkline reads by shape, not by value — the
 * number beside it carries the value, and a hover title carries the range.
 * One series per instance, so no legend is owed (the stat tile's label
 * already names what is plotted).
 */

import type { ReactNode } from 'react';

const width = 72;
const height = 22;
const padding = 3;

export function Sparkline({ values, title }: { values: number[]; title?: string }): ReactNode {
  if (values.length < 2) {
    return <svg className="sparkline" width={width} height={height} aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (value - min) / span) * (height - padding * 2);
    return { x, y };
  });

  const path = points.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const last = points[points.length - 1]!;

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
    >
      {title !== undefined && <title>{title}</title>}
      <path
        d={path}
        fill="none"
        stroke="var(--blue)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={3}
        fill="var(--blue)"
        stroke="var(--panel)"
        strokeWidth={2}
      />
    </svg>
  );
}
