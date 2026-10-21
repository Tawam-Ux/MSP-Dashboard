export function PageHeader({ title, caption, actions }: { title: React.ReactNode; caption?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-head flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em] text-balance text-navy sm:text-[1.875rem]">{title}</h1>
        {caption && <div className="mt-1.5 text-sm text-ink-2">{caption}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
