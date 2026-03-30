"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Database, LineChart, Search, Sparkles, Truck } from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LineChart },
  { href: "/upcoming-auction", label: "Upcoming", icon: CalendarDays },
  { href: "/historical-data", label: "Historical Data", icon: Search },
  { href: "/import-auction", label: "Import Auction", icon: Truck },
  { href: "/import-history", label: "Import History", icon: Database },
  { href: "/run-pipeline", label: "Run Pipeline", icon: ClipboardList },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="transition hover:opacity-90">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-400 to-emerald-400 text-white shadow-lg shadow-sky-200/60">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Auction Buy Assistant
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">Smart auction decisions</p>
              </div>
            </div>
          </Link>

          <div className="hidden rounded-full border border-sky-100 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm lg:flex">
            Auction workflow center
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] gap-4 px-2 py-4 sm:px-4 lg:px-6 xl:px-8">
        {!sidebarHidden && (
          <aside className="relative hidden w-72 shrink-0 lg:block">
            <div className="sticky top-24 space-y-5 rounded-[30px] border border-slate-200/70 bg-white/78 p-4 text-slate-900 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="rounded-[24px] bg-gradient-to-br from-slate-950 via-sky-950 to-emerald-950 p-4 text-white shadow-lg">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">Navigation</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">Control panel</p>
              <p className="mt-1 text-sm text-slate-200/85">Imports, dashboard, history, and pipeline in one place.</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarHidden(true)}
              className="absolute -right-3 top-4 z-50 rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-lg transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Esconder menu lateral"
              title="Esconder menu lateral"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-gradient-to-r from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-200/60"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                      isActive
                        ? "bg-white/16 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-900"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
            </div>
          </aside>
        )}

        {sidebarHidden && (
          <div className="hidden lg:block">
            <button
              type="button"
              onClick={() => setSidebarHidden(false)}
              className="fixed left-6 top-28 z-50 rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-lg transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Mostrar menu lateral"
              title="Mostrar menu lateral"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <main className="flex-1 min-w-0 w-full p-2 sm:p-4 lg:p-6">
          <div className="min-w-0 w-full rounded-[30px] border border-white/70 bg-white/72 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 backdrop-blur-xl sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
