import { memo } from "react";
import type { DartLabel } from "../engine/types";
import { cn } from "../lib/util";

export const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Promienie (tarcza ma r=100). Pierścienie double/treble są poszerzone,
// żeby łatwo trafić palcem na telefonie.
const R = { bull: 6.5, outerBull: 14, trebleIn: 57, trebleOut: 66, doubleIn: 90, doubleOut: 100 };
const C = 120; // środek w viewBox 240×240 (miejsce na numery wokół)

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

function ring(r1: number, r2: number, a1: number, a2: number) {
  const p1 = polar(r1, a1);
  const p2 = polar(r2, a1);
  const p3 = polar(r2, a2);
  const p4 = polar(r1, a2);
  return `M${p1.x} ${p1.y}L${p2.x} ${p2.y}A${r2} ${r2} 0 0 1 ${p3.x} ${p3.y}L${p4.x} ${p4.y}A${r1} ${r1} 0 0 0 ${p1.x} ${p1.y}Z`;
}

const COLORS = {
  dark: "hsl(40 12% 11%)",
  light: "hsl(42 40% 84%)",
  red: "hsl(355 75% 46%)",
  green: "hsl(145 60% 32%)",
  wire: "hsl(40 10% 55% / 0.55)",
};

interface Props {
  onHit?: (label: DartLabel) => void;
  pending?: DartLabel | null;
  /** Lotki w bieżącej kolejce (podświetlenie). */
  hits?: DartLabel[];
  /** Sugerowane pole (podpowiedź checkoutu). */
  highlight?: DartLabel | null;
  disabled?: boolean;
  /** Tryb heatmapy: kolor pól wg liczby trafień. */
  heat?: Record<string, number>;
  className?: string;
}

function heatColor(t: number) {
  if (t <= 0) return null;
  const hue = 210 - 188 * t;
  return `hsl(${hue} ${70 + 25 * t}% ${50 - 8 * t}% / ${0.3 + 0.65 * t})`;
}

function DartboardImpl({ onHit, pending, hits = [], highlight, disabled, heat, className }: Props) {
  const interactive = !!onHit && !disabled;
  const maxHeat = heat ? Math.max(1, ...Object.entries(heat).filter(([k]) => k !== "MISS").map(([, v]) => v)) : 1;
  const countOf = (l: DartLabel) => hits.filter((h) => h === l).length;

  const area = (label: DartLabel, d: string | null, base: string, circle?: number) => {
    const count = countOf(label);
    const isPending = pending === label;
    const isHint = highlight === label;
    const heatFill = heat ? heatColor((heat[label] ?? 0) / maxHeat) : null;
    const shape = (fill: string, extra: Record<string, unknown> = {}) =>
      circle !== undefined ? (
        <circle cx={C} cy={C} r={circle} fill={fill} {...extra} />
      ) : (
        <path d={d!} fill={fill} {...extra} />
      );
    return (
      <g key={label + (d ?? circle)}>
        {shape(heat ? "hsl(200 15% 14%)" : base, {
          stroke: COLORS.wire,
          strokeWidth: 0.35,
          onClick: interactive ? () => onHit!(label) : undefined,
          className: interactive ? "cursor-pointer hover:brightness-125" : undefined,
          "data-label": label,
        })}
        {heatFill && shape(heatFill, { pointerEvents: "none" })}
        {isHint && shape("rgb(var(--accent) / 0.55)", { pointerEvents: "none", stroke: "rgb(var(--accent))", strokeWidth: 0.8 })}
        {count > 0 && shape(`hsl(55 95% 60% / ${Math.min(0.85, 0.3 + count * 0.22)})`, { pointerEvents: "none" })}
        {isPending &&
          shape("hsl(190 95% 55% / 0.45)", {
            pointerEvents: "none",
            stroke: "hsl(190 95% 70%)",
            strokeWidth: 1.2,
            strokeDasharray: "2.5 1.5",
          })}
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 240 240"
      className={cn("block h-auto w-full select-none", className)}
      role={interactive ? "group" : "img"}
      aria-label="Tarcza"
    >
      <circle cx={C} cy={C} r={118} fill="hsl(200 20% 6%)" />
      {SECTORS.map((num, i) => {
        const a1 = i * 18 - 9;
        const a2 = i * 18 + 9;
        const darkSeg = i % 2 === 0; // 20 jest czarne
        const single = darkSeg ? COLORS.dark : COLORS.light;
        const ringCol = darkSeg ? COLORS.red : COLORS.green;
        const lp = polar(109, i * 18);
        return (
          <g key={num}>
            {area(`S${num}`, ring(R.outerBull, R.trebleIn, a1, a2), single)}
            {area(`T${num}`, ring(R.trebleIn, R.trebleOut, a1, a2), ringCol)}
            {area(`S${num}`, ring(R.trebleOut, R.doubleIn, a1, a2), single)}
            {area(`D${num}`, ring(R.doubleIn, R.doubleOut, a1, a2), ringCol)}
            <text
              x={lp.x}
              y={lp.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fill="hsl(40 30% 88%)"
              pointerEvents="none"
              style={{ fontFamily: "'Bebas Neue', Impact, sans-serif" }}
            >
              {num}
            </text>
          </g>
        );
      })}
      {area("25", null, COLORS.green, R.outerBull)}
      {area("BULL", null, COLORS.red, R.bull)}
    </svg>
  );
}

export const Dartboard = memo(DartboardImpl);
