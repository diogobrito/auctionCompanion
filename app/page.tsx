import Link from "next/link"

export default function Home() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-4xl flex-col justify-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Auction Buy Assistant</span>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Welcome to the smart dashboard</h1>
        <p className="mt-2 text-slate-600">Use the menu to navigate through the modules: auctions, history, imports, estimates, and pipeline execution.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-100">Dashboard</Link>
        <Link href="/upcoming-auction" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-100">Upcoming Auction</Link>
        <Link href="/historical-data" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-100">Historical Data</Link>
        <Link href="/import-auction" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-100">Import Auction</Link>
      </div>
    </div>
  )
}
