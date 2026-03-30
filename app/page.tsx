import Link from "next/link"
import { ArrowRight, CalendarDays, Database, LayoutDashboard, Search, Truck } from "lucide-react"

const quickLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Track target and maybe vehicles with quick decisions.",
    icon: LayoutDashboard,
    accent: "from-sky-500 to-cyan-400",
  },
  {
    href: "/upcoming-auction",
    label: "Upcoming Auction",
    description: "Review the next auction lineup and inspection priorities.",
    icon: CalendarDays,
    accent: "from-emerald-500 to-teal-400",
  },
  {
    href: "/historical-data",
    label: "Historical Data",
    description: "Search historical sales and compare vehicle patterns.",
    icon: Search,
    accent: "from-amber-500 to-orange-400",
  },
  {
    href: "/import-auction",
    label: "Import Auction",
    description: "Bring in fresh auction data and prepare the workflow.",
    icon: Truck,
    accent: "from-fuchsia-500 to-pink-400",
  },
]

export default function Home() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-6xl flex-col justify-center gap-8">
      <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/78 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="absolute -left-8 top-0 h-44 w-44 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="absolute right-0 top-10 h-40 w-40 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-amber-200/30 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">
              Auction Buy Assistant
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              A sharper, more visual cockpit for auction decisions.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Use the workspace to compare vehicles, inspect opportunities, import fresh data, and move from discovery to bid strategy with more confidence.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 hover:bg-slate-900">
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/historical-data" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white">
                Explore History
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[26px] bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-900 p-5 text-white shadow-xl">
              <LayoutDashboard className="h-6 w-6 text-sky-200" />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-sky-100/80">Command view</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">Dashboard and upcoming auction, side by side in one workflow.</p>
            </div>
            <div className="rounded-[26px] border border-white/70 bg-white/88 p-5 shadow-sm">
              <Database className="h-6 w-6 text-emerald-600" />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Data first</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Import, compare, and validate historical context before bidding.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group overflow-hidden rounded-[28px] border border-white/70 bg-white/82 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.1)]"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-lg`}>
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">{item.label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition group-hover:text-slate-950">
                Open module
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
