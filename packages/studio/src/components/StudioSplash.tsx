export function StudioSplash({ waiting }: { waiting?: boolean }) {
  return (
    <div className="h-full w-full bg-background-tertiary-default flex items-center justify-center">
      {waiting ? (
        <div className="flex flex-col items-center gap-3 text-center px-6" role="status">
          <div className="w-4 h-4 rounded-full border-2 border-border-button-default border-t-text-secondary animate-spin motion-reduce:animate-none" />
          <p className="text-xs text-text-tertiary">
            Waiting for preview server… run{" "}
            <code className="text-text-tertiary font-mono">npm run dev</code>
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center px-6" role="status">
          <div className="w-4 h-4 rounded-full bg-studio-accent animate-pulse motion-reduce:animate-none" />
          <p className="text-xs text-text-tertiary">Connecting to project…</p>
        </div>
      )}
    </div>
  );
}
