export type IconName =
  'speaker' | 'speakerOff' | 'monitor' | 'expand' | 'keyboard' | 'menu' | 'check' | 'alert';

const PATHS: Readonly<Record<IconName, string>> = {
  speaker: 'M4 9h4l5-4v14l-5-4H4z M16 8.5a5 5 0 0 1 0 7 M18.5 6a8.5 8.5 0 0 1 0 12',
  speakerOff: 'M4 9h4l5-4v14l-5-4H4z M16 9l6 6 M22 9l-6 6',
  monitor: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  expand: 'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5',
  keyboard: 'M2 6h20v12H2z M6 10h1 M10 10h1 M14 10h1 M18 10h1 M7 14h10',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  check: 'M4 12l5 5L20 6',
  alert: 'M12 3l10 18H2z M12 10v5 M12 18v.5',
};

/** Decorative line icon; the surrounding control carries the accessible name. */
export function Icon({ name, size = 24 }: { readonly name: IconName; readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
