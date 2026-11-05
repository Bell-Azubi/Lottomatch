import type { ComponentChildren } from 'preact';
import { Panel } from '../../design-system/Surface';
import styles from './Settings.module.css';

export type SectionId = 'events' | 'event' | 'presentation' | 'data' | 'pin' | 'about';

/** DOM id of a section heading; also the scroll and focus target of the section navigation. */
function sectionHeadingId(id: SectionId): string {
  return `settings-${id}`;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Moves to a section without touching the hash (hash routing owns `location.hash`). */
export function focusSection(id: SectionId): void {
  const heading = document.getElementById(sectionHeadingId(id));
  if (heading === null) return;
  const reduced = prefersReducedMotion();
  if ('scrollIntoView' in heading) {
    heading.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }
  heading.focus({ preventScroll: true });
}

/** One settings section: a panel with a focusable heading and an optional intro. */
export function Section({
  id,
  title,
  intro,
  children,
}: {
  readonly id: SectionId;
  readonly title: string;
  readonly intro?: string;
  readonly children: ComponentChildren;
}) {
  const headingId = sectionHeadingId(id);
  return (
    <Panel as="section" className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} class={styles.sectionTitle} tabIndex={-1}>
        {title}
      </h2>
      {intro !== undefined && <p class={styles.intro}>{intro}</p>}
      {children}
    </Panel>
  );
}
