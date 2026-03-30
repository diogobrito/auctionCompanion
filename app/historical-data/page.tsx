"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarClock, Database, Search, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { PageHeader } from "@/components/page-header"
import { MetricCard } from "@/components/metric-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type HistoricalSale = {
  id: string
  auction_date: string | null
  stock: string | null
  run_number: string | null
  lane: string | null
  year: number | null
  make: string | null
  model: string | null
  style: string | null
  odometer: number | null
  color: string | null
  bid_price: number | null
}

type HistoricalFilters = {
  searchTerm: string
  makeFilter: string
  yearFilter: string
}

const PAGE_SIZE = 100

function formatCurrency(value: number | null) {
  if (value === null) return "-"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number | null) {
  if (value === null) return "-"
  return new Intl.NumberFormat("en-US").format(value)
}

async function fetchHistoricalSales(filters: HistoricalFilters, page: number) {
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from("historical_sales")
    .select("id, auction_date, stock, run_number, lane, year, make, model, style, odometer, color, bid_price", {
      count: "exact",
    })
    .order("auction_date", { ascending: false })
    .order("bid_price", { ascending: false })
    .range(from, to)

  const trimmedSearch = filters.searchTerm.trim()
  const trimmedMake = filters.makeFilter.trim()
  const trimmedYear = filters.yearFilter.trim()

  if (trimmedSearch) {
    query = query.or(
      `stock.ilike.%${trimmedSearch}%,run_number.ilike.%${trimmedSearch}%,make.ilike.%${trimmedSearch}%,model.ilike.%${trimmedSearch}%,style.ilike.%${trimmedSearch}%`
    )
  }

  if (trimmedMake) {
    query = query.ilike("make", `%${trimmedMake}%`)
  }

  if (trimmedYear) {
    const parsedYear = Number(trimmedYear)

    if (Number.isNaN(parsedYear)) {
      return {
        data: null,
        errorMessage: "Year must be numeric.",
      }
    }

    query = query.eq("year", parsedYear)
  }

  const { data, error, count } = await query

  if (error) {
    console.error(error)
    return {
      data: null,
      totalCount: 0,
      errorMessage: "Error querying historical data.",
    }
  }

  return {
    data: data ?? [],
    totalCount: count ?? 0,
    errorMessage: "",
  }
}

export default function HistoricalDataPage() {
  const [sales, setSales] = useState<HistoricalSale[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [yearFilter, setYearFilter] = useState("")
  const [makeFilter, setMakeFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  async function loadHistoricalSales(filters?: Partial<HistoricalFilters>, page = currentPage) {
    setLoading(true)
    setMessage("")

    const result = await fetchHistoricalSales({
      searchTerm: filters?.searchTerm ?? searchTerm,
      makeFilter: filters?.makeFilter ?? makeFilter,
      yearFilter: filters?.yearFilter ?? yearFilter,
    }, page)

    if (result.errorMessage) {
      setMessage(result.errorMessage)
      setSales([])
      setTotalCount(0)
      setLoading(false)
      return
    }

    setSales(result.data ?? [])
    setTotalCount(result.totalCount ?? 0)
    setCurrentPage(page)
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setMessage("")

        const result = await fetchHistoricalSales({
          searchTerm: "",
          makeFilter: "",
          yearFilter: "",
        }, 1)

        if (result.errorMessage) {
          setMessage(result.errorMessage)
          setSales([])
          setTotalCount(0)
          setLoading(false)
          return
        }

        setSales(result.data ?? [])
        setTotalCount(result.totalCount ?? 0)
        setCurrentPage(1)
        setLoading(false)
      })()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const displayedMetrics = useMemo(() => {
    const prices = sales
      .map((sale) => sale.bid_price)
      .filter((value): value is number => value !== null)

    const averagePrice = prices.length
      ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length)
      : 0

    const latestAuctionDate = sales[0]?.auction_date ?? "-"
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

    return {
      total: totalCount,
      pageCount: totalPages,
      averagePrice,
      latestAuctionDate,
    }
  }, [sales, totalCount])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historical Data"
        description="Review cars sold in past auctions to support comparisons and decisions."
        actions={
          <Button asChild>
            <Link href="/import-history">
              <Sparkles className="h-4 w-4" />
              Import History
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Displayed Records" value={String(displayedMetrics.total)} hint={`Page ${currentPage} of ${displayedMetrics.pageCount}`} />
        <MetricCard title="Average Price" value={formatCurrency(displayedMetrics.averagePrice)} />
        <MetricCard title="Most Recent Auction" value={displayedMetrics.latestAuctionDate} />
      </section>

      <section className="rounded-[28px] border border-white/80 bg-white/86 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-200/60">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Search History</p>
            <p className="text-sm text-slate-600">Filter by stock, run, make, model, style, and year.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <form
            className="grid gap-3 md:col-span-4 md:grid-cols-[2fr_1fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              void loadHistoricalSales(undefined, 1)
            }}
          >
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by stock, run, make, model, or style"
            />
            <Input
              value={makeFilter}
              onChange={(event) => setMakeFilter(event.target.value)}
              placeholder="Filter by make"
            />
            <Input
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              inputMode="numeric"
              placeholder="Year"
            />
            <Button type="submit" className="w-full md:w-auto">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>
            Showing {sales.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}
            {" "}-{" "}
            {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} records.
          </span>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("")
              setMakeFilter("")
              setYearFilter("")
              void loadHistoricalSales({
                searchTerm: "",
                makeFilter: "",
                yearFilter: "",
              }, 1)
            }}
            className="font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        </div>
      </section>

      {loading && <p className="rounded-2xl bg-white/80 p-4 text-sm text-slate-600 shadow-sm">Loading history...</p>}
      {message && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">{message}</p>}

      {!loading && !message && (
        <section className="rounded-[28px] border border-white/80 bg-white/86 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-200/60">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Results</p>
              <p className="text-sm text-slate-600">Historical auction records ordered by most recent auction and price.</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Run</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Lane</TableHead>
                <TableHead>Odometer</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Bid Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length ? (
                sales.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-sky-50/35">
                    <TableCell>{sale.auction_date ?? "-"}</TableCell>
                    <TableCell>{sale.stock ?? "-"}</TableCell>
                    <TableCell>{sale.run_number ?? "-"}</TableCell>
                    <TableCell>{sale.year ?? "-"}</TableCell>
                    <TableCell>{sale.make ?? "-"}</TableCell>
                    <TableCell>{sale.model ?? "-"}</TableCell>
                    <TableCell>{sale.style ?? "-"}</TableCell>
                    <TableCell>{sale.lane ?? "-"}</TableCell>
                    <TableCell>{formatNumber(sale.odometer)}</TableCell>
                    <TableCell>{sale.color ?? "-"}</TableCell>
                    <TableCell>{formatCurrency(sale.bid_price)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-slate-500">
                    No records found for the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Page {currentPage} of {displayedMetrics.pageCount}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadHistoricalSales(undefined, currentPage - 1)}
                disabled={currentPage <= 1 || loading}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadHistoricalSales(undefined, currentPage + 1)}
                disabled={currentPage >= displayedMetrics.pageCount || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
