"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Database, LineChart, Search, Truck } from "lucide-react"

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

  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Auction Buy Assistant</h1>
            <p className="text-xs text-slate-500">Smart auction decisions</p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/dashboard" className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Dashboard
            </Link>
            <Link href="/upcoming-auction" className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Upcoming
            </Link>
            <Link href="/historical-data" className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Historical Data
            </Link>
            <Link href="/import-auction" className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Import Auction
            </Link>
          </div>
        </div>
      </header>

      <div className="flex w-full gap-4 px-2 py-4 sm:px-4 lg:px-6 xl:px-8">
        {!sidebarHidden && (
          <aside className="relative hidden w-72 shrink-0 space-y-4 border-r border-slate-200 bg-slate-900 p-4 text-slate-100 lg:block">
            <button
              type="button"
              onClick={() => setSidebarHidden(true)}
              className="absolute right-3 top-3 rounded-md border border-slate-600 bg-slate-800 p-1 text-slate-300 transition hover:bg-slate-700 hover:text-white"
              aria-label="Esconder menu lateral"
              title="Esconder menu lateral"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
              <h2 className="text-base font-semibold">Navegação</h2>
              <p className="mt-1 text-xs text-slate-300">Fluxo rápido do painel</p>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </aside>
        )}

        {sidebarHidden && (
          <div className="hidden lg:flex">
            <button
              type="button"
              onClick={() => setSidebarHidden(false)}
              className="h-fit rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Mostrar menu lateral"
              title="Mostrar menu lateral"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <main className="flex-1 min-w-0 w-full p-2 sm:p-4 lg:p-6">
          <div className="min-w-0 w-full rounded-2xl bg-white/75 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
