interface WorkspaceSkeletonProps {
  loading?: string; // t(locale, "skeleton.loading"); English until the request's language is known
}

// Shown while the visitor's demo copy loads. No product name here: the page shows it once, in the workspace.
export function WorkspaceSkeleton({ loading = "Loading your demo copy…" }: WorkspaceSkeletonProps) {
  return (
    <div className="min-h-dvh" aria-busy="true">
      <div className="h-16 border-b border-line bg-surface" />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8">
          <p className="text-[14px] text-ink-2" role="status">
            {loading}
          </p>
          <div className="mt-3 h-8 w-64 max-w-full rounded-[8px] bg-canvas" />
          <div className="mt-2 h-4 w-40 rounded-[8px] bg-canvas" />
        </div>
      </header>
      <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
        <div className="h-96 rounded-[10px] border border-line bg-surface" />
        <div className="h-72 rounded-[10px] border border-line bg-surface" />
      </div>
    </div>
  );
}
