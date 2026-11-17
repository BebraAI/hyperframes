// While Studio opens, the shape it will have: the preview over the timeline, in pulsing blocks, so the panels land
// where the eye already is instead of after a dot and "Connecting to project…" in an empty grey box.
// promptwise-web's build puts the same markup in index.html, so the page shows it before any script has run.
const BONE = "rounded-md bg-background-tertiary-default animate-pulse motion-reduce:animate-none";

/** Clips on each skeleton row, as [left %, width %]: uneven, so it reads as a timeline and not a table. */
const ROWS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [2, 18],
    [21, 30],
    [52, 26],
  ],
  [[36, 14]],
  [[2, 76]],
];

// fallow-ignore-next-line unused-export -- promptwise-web/build.mjs renders it into index.html
export function StudioSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading Studio"
      className="flex h-full w-full flex-col gap-2 bg-background-tertiary-default p-2"
    >
      <div className="flex min-h-0 flex-[3] flex-col gap-3 rounded-lg bg-background-primary-default p-3">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className={`${BONE} aspect-video h-full max-w-full`} />
        </div>
        <div className={`${BONE} h-1.5 w-full rounded-full`} />
        <div className="flex items-center justify-between">
          <div className={`${BONE} h-3 w-20`} />
          <div className={`${BONE} h-4 w-4 rounded-full`} />
          <div className={`${BONE} h-3 w-24`} />
        </div>
      </div>
      <div className="flex min-h-0 flex-[2] flex-col gap-2 rounded-lg bg-background-primary-default p-3">
        <div className="flex items-center gap-2">
          <div className={`${BONE} h-4 w-4`} />
          <div className={`${BONE} h-4 w-4`} />
          <div className={`${BONE} h-4 w-4`} />
          <div className={`${BONE} ml-auto h-1.5 w-28 rounded-full`} />
        </div>
        <div className="flex gap-3">
          <div className="w-24 shrink-0" />
          <div className={`${BONE} h-2 flex-1`} />
        </div>
        {ROWS.map((clips, row) => (
          <div key={row} className="flex min-h-0 flex-1 items-center gap-3">
            <div className={`${BONE} h-3 w-24 shrink-0`} />
            <div className="relative h-full max-h-10 flex-1">
              {clips.map(([left, width]) => (
                <div
                  key={left}
                  className={`${BONE} absolute inset-y-0`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Connecting to project…</span>
    </div>
  );
}

export function StudioSplash({ waiting }: { waiting?: boolean }) {
  if (!waiting) return <StudioSkeleton />;
  return (
    <div className="h-full w-full bg-background-tertiary-default flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center px-6" role="status">
        <div className="w-4 h-4 rounded-full border-2 border-border-button-default border-t-text-secondary animate-spin motion-reduce:animate-none" />
        <p className="text-xs text-text-tertiary">
          Waiting for preview server… run{" "}
          <code className="text-text-tertiary font-mono">npm run dev</code>
        </p>
      </div>
    </div>
  );
}
