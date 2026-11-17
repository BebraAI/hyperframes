/** Zoom to selection: a magnifier inside selection corners, so it does not read as fullscreen. */
export function ZoomToSelectionIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 4.5v-3h3M11.5 1.5h3v3M14.5 11.5v3h-3M4.5 14.5h-3v-3" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <path d="m9.5 9.5 1.75 1.75" />
    </svg>
  );
}
