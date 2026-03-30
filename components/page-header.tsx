type PageHeaderProps = {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 overflow-hidden rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
            Workspace
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
