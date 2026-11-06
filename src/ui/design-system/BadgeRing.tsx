import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import styles from './BadgeRing.module.css';

export type BadgeVariant = 'badge' | 'ball' | 'ring';
export type SegmentState = 'DONE' | 'CURRENT' | 'UPCOMING' | 'ABORTED';

export interface BadgeRingProps {
  /** badge: full anatomy with lettered band; ball: rim, hairline, gold field; ring: rim only. */
  readonly variant?: BadgeVariant;
  readonly topText?: string | undefined;
  readonly bottomText?: string | undefined;
  /** The band turns Club Red for the Superlotto. */
  readonly bandTone?: 'graphite' | 'red';
  /** Numeral in the field, rendered in Barlow Condensed ExtraBold. */
  readonly numeral?: string | undefined;
  /** Round-ring mode: one segment per round. */
  readonly segments?: readonly SegmentState[];
  /** Gold progress arc on the rim, 0–1. */
  readonly progress?: number;
  /** Animates the progress arc once over this many milliseconds (Drehen spin). */
  readonly sweepMs?: number;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

const CENTER = 100;
const RIM_RADIUS = 97;
const RIM_CIRCUMFERENCE = 2 * Math.PI * RIM_RADIUS;

function polar(radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(radians), CENTER + radius * Math.sin(radians)];
}

/** SVG arc path along a circle, clockwise from `start` to `end` degrees (0 = top). */
export function arcPath(radius: number, start: number, end: number): string {
  const [x0, y0] = polar(radius, start);
  const [x1, y1] = polar(radius, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
}

function Segments({ states }: { readonly states: readonly SegmentState[] }) {
  const count = states.length;
  const gap = count > 1 ? Math.min(4, 120 / count) : 0;
  const step = 360 / Math.max(1, count);
  return (
    <g>
      {states.map((state, index) => {
        const path =
          count === 1
            ? arcPath(88, 0, 359.99)
            : arcPath(88, index * step + gap / 2, (index + 1) * step - gap / 2);
        return (
          <path key={index} d={path} class={`${styles.segment} ${styles[`segment${state}`]}`} />
        );
      })}
    </g>
  );
}

/**
 * The single ring primitive behind every badge-like element (docs/design-plan.md): badge
 * ball, round ring, Drehen button and drum. Lettering is decorative (`aria-hidden`); callers
 * always render the same information as real text.
 */
export function BadgeRing({
  variant = 'badge',
  topText,
  bottomText,
  bandTone = 'graphite',
  numeral,
  segments,
  progress,
  sweepMs,
  className,
  children,
}: BadgeRingProps) {
  const id = useId();
  const topId = `${id}-top`;
  const bottomId = `${id}-bottom`;
  const showBand = variant === 'badge';
  const showField = variant !== 'ring' && segments === undefined;
  const dashOffset = RIM_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress ?? 0)));
  return (
    <div class={`${styles.root} ${className ?? ''}`}>
      <svg class={styles.svg} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        {segments === undefined ? (
          <>
            <g data-layer="rim">
              <circle class={styles.rim} cx={CENTER} cy={CENTER} r={RIM_RADIUS} />
            </g>
            <g data-layer="whiteHairline">
              <circle class={styles.whiteHairline} cx={CENTER} cy={CENTER} r={94.5} />
            </g>
          </>
        ) : (
          <Segments states={segments} />
        )}
        {showBand && (
          <>
            <g data-layer="band">
              <circle
                class={bandTone === 'red' ? styles.bandRed : styles.band}
                cx={CENTER}
                cy={CENTER}
                r={83.5}
              />
              <path id={topId} class={styles.guide} d="M 23 100 A 77 77 0 0 1 177 100" />
              <path id={bottomId} class={styles.guide} d="M 11 100 A 89 89 0 0 0 189 100" />
              {topText !== undefined && (
                <text class={styles.lettering}>
                  <textPath href={`#${topId}`} startOffset="50%" text-anchor="middle">
                    {topText}
                  </textPath>
                </text>
              )}
              {bottomText !== undefined && (
                <text class={styles.lettering}>
                  <textPath href={`#${bottomId}`} startOffset="50%" text-anchor="middle">
                    {bottomText}
                  </textPath>
                </text>
              )}
            </g>
            <g data-layer="creamHairline">
              <circle class={styles.creamHairline} cx={CENTER} cy={CENTER} r={72.4} />
            </g>
          </>
        )}
        {(progress !== undefined || sweepMs !== undefined) && (
          <circle
            class={`${styles.progress} ${sweepMs === undefined ? '' : styles.sweep}`}
            cx={CENTER}
            cy={CENTER}
            r={RIM_RADIUS}
            stroke-dasharray={RIM_CIRCUMFERENCE.toFixed(2)}
            stroke-dashoffset={sweepMs === undefined ? dashOffset.toFixed(2) : undefined}
            style={sweepMs === undefined ? undefined : { animationDuration: `${sweepMs}ms` }}
          />
        )}
        {(showField || numeral !== undefined) && (
          <g data-layer="core">
            {showField && (
              <circle class={styles.field} cx={CENTER} cy={CENTER} r={showBand ? 71.6 : 93.8} />
            )}
            {numeral !== undefined && (
              <text
                class={styles.numeral}
                x={CENTER}
                y={CENTER}
                font-size={numeral.length > 2 ? 72 : showBand ? 118 : 120}
              >
                {numeral}
              </text>
            )}
          </g>
        )}
      </svg>
      {children !== undefined && <div class={styles.content}>{children}</div>}
    </div>
  );
}
