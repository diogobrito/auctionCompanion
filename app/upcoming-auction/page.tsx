"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import ExcelJS from "exceljs"
import { CarFront, Download, Filter, Route, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { findComparableSales } from "@/lib/historical-comparables"
import { PageHeader } from "@/components/page-header"
import { MetricCard } from "@/components/metric-card"
import {
  DecisionBadge,
  ConfidenceBadge,
} from "@/components/status-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type AuctionCar = {
  id: string
  auction_id: string
  run_number: string | null
  lane: string | null
  year: number | null
  make: string | null
  model: string | null
  style: string | null
  vin: string | null
  odometer: number | null
  color: string | null
  cr: number | null
  estimated_bid: number | null
  estimated_bid_min: number | null
  estimated_bid_max: number | null
  auction_fee: number | null
  estimated_total_cost: number | null
  suggested_max_bid: number | null
  confidence: string | null
  decision: string | null
  similar_cars_count?: number
}

type Auction = {
  id: string
  name: string
  auction_date: string
  source_type: string
}

type HistoricalSale = {
  id: string
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
  bid_price: number | null
}

function getSimilarCarsCount(car: AuctionCar, historicalSales: HistoricalSale[]) {
  return findComparableSales(car, historicalSales).length
}


function currency(value: number | null) {
  if (value === null || value === undefined) return "-"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function slugifyFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function UpcomingAuctionPage() {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [cars, setCars] = useState<AuctionCar[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [minBid, setMinBid] = useState("")
  const [maxBid, setMaxBid] = useState("")
  const [minMileage, setMinMileage] = useState("")
  const [maxMileage, setMaxMileage] = useState("")
  const [minYear, setMinYear] = useState("")
  const [maxYear, setMaxYear] = useState("")
  const [laneFilter, setLaneFilter] = useState<string[]>([])

  async function loadLatestPresaleAuction() {
    setLoading(true)
    setMessage("")

    const { data: latestAuction, error: auctionError } = await supabase
      .from("auctions")
      .select("*")
      .eq("source_type", "presale")
      .order("auction_date", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (auctionError) {
      console.error(auctionError)
      setMessage("Error loading the latest presale auction.")
      setLoading(false)
      return
    }

    if (!latestAuction) {
      setMessage("No presale auction found.")
      setLoading(false)
      return
    }

    setAuction(latestAuction)

    const { data: carsData, error: carsError } = await supabase
      .from("auction_cars")
      .select("*")
      .eq("auction_id", latestAuction.id)
      .order("run_number", { ascending: true })

    if (carsError) {
      console.error(carsError)
      setMessage("Error loading cars for the upcoming auction.")
      setLoading(false)
      return
    }

    const { data: historicalSales, error: historicalError } = await supabase
      .from("historical_sales")
      .select("id, year, make, model, odometer, bid_price")

    if (historicalError) {
      console.error(historicalError)
      setMessage("Error loading history to compare cars.")
      setLoading(false)
      return
    }

    const carsWithSimilarCount = (carsData || []).map((car) => ({
      ...car,
      similar_cars_count: getSimilarCarsCount(car as AuctionCar, (historicalSales || []) as HistoricalSale[]),
    }))

    setCars(carsWithSimilarCount)
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadLatestPresaleAuction()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  async function updateDecision(id: string, decision: string) {
    const { error } = await supabase
      .from("auction_cars")
      .update({ decision })
      .eq("id", id)

    if (error) {
      console.error(error)
      return
    }

    setCars((prev) =>
      prev.map((car) => (car.id === id ? { ...car, decision } : car))
    )
  }

  const laneOptions = useMemo(() => {
    const uniqueLanes = Array.from(
      new Set(cars.map((car) => car.lane?.trim()).filter((lane): lane is string => Boolean(lane)))
    )
    return uniqueLanes.sort((a, b) => a.localeCompare(b))
  }, [cars])

  const filteredCars = useMemo(() => {
    const min = Number(minBid)
    const max = Number(maxBid)
    const hasMin = minBid.trim() !== "" && !Number.isNaN(min)
    const hasMax = maxBid.trim() !== "" && !Number.isNaN(max)

    const minM = Number(minMileage)
    const maxM = Number(maxMileage)
    const hasMinMiles = minMileage.trim() !== "" && !Number.isNaN(minM)
    const hasMaxMiles = maxMileage.trim() !== "" && !Number.isNaN(maxM)

    const minY = Number(minYear)
    const maxY = Number(maxYear)
    const hasMinYear = minYear.trim() !== "" && !Number.isNaN(minY)
    const hasMaxYear = maxYear.trim() !== "" && !Number.isNaN(maxY)

    const activeLanes = laneFilter.map((lane) => lane.trim().toLowerCase()).filter(Boolean)
    const hasLaneFilter = activeLanes.length > 0

    return cars.filter((car) => {
      const matchesSearch =
        `${car.year ?? ""} ${car.make ?? ""} ${car.model ?? ""} ${car.style ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())

      const bidValue = car.estimated_bid
      const matchesMin = !hasMin || (bidValue !== null && bidValue >= min)
      const matchesMax = !hasMax || (bidValue !== null && bidValue <= max)

      const milesValue = car.odometer
      const matchesMinMiles = !hasMinMiles || (milesValue !== null && milesValue >= minM)
      const matchesMaxMiles = !hasMaxMiles || (milesValue !== null && milesValue <= maxM)

      const yearValue = car.year
      const matchesMinYear = !hasMinYear || (yearValue !== null && yearValue >= minY)
      const matchesMaxYear = !hasMaxYear || (yearValue !== null && yearValue <= maxY)

      const carLane = car.lane?.trim().toLowerCase() || ""
      const matchesLane =
        !hasLaneFilter ||
        (carLane && activeLanes.includes(carLane))

      return (
        matchesSearch &&
        matchesMin &&
        matchesMax &&
        matchesMinMiles &&
        matchesMaxMiles &&
        matchesMinYear &&
        matchesMaxYear &&
        matchesLane
      )
    })
  }, [cars, search, minBid, maxBid, minMileage, maxMileage, minYear, maxYear, laneFilter])

  const metrics = useMemo(() => {
    const targetCount = cars.filter((car) => car.decision === "Target").length
    const maybeCount = cars.filter((car) => car.decision === "Maybe").length
    const avoidCount = cars.filter((car) => car.decision === "Avoid").length

    const avgBid =
      cars
        .map((car) => car.estimated_bid)
        .filter((v): v is number => v !== null)
        .reduce((sum, v, _, arr) => sum + v / arr.length, 0) || 0

    return {
      totalCars: cars.length,
      targetCount,
      maybeCount,
      avoidCount,
      avgBid,
    }
  }, [cars])

  async function exportToXlsx() {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Upcoming Auction", {
      views: [{ state: "frozen", ySplit: 1 }],
    })

    worksheet.columns = [
      { header: "Row", key: "row", width: 8 },
      { header: "Num", key: "num", width: 10 },
      { header: "Year", key: "year", width: 8 },
      { header: "Make", key: "make", width: 16 },
      { header: "Model", key: "model", width: 24 },
      { header: "Mileage", key: "mileage", width: 12 },
      { header: "VIN", key: "vin", width: 22 },
      { header: "Inspection", key: "inspection", width: 14 },
      { header: "Engine Lights", key: "engine_lights", width: 16 },
      { header: "Body", key: "body", width: 14 },
      { header: "Sugested Bid", key: "suggested_bid", width: 14 },
      { header: "Real view", key: "real_view", width: 14 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.alignment = { vertical: "middle", horizontal: "center" }

    filteredCars.forEach((car, index) => {
      worksheet.addRow({
        row: index + 1,
        num: car.run_number || "",
        year: car.year ?? "",
        make: car.make || "",
        model: car.model || "",
        mileage: car.odometer ?? "",
        vin: car.vin || "",
        inspection: "",
        engine_lights: "",
        body: "",
        suggested_bid: car.suggested_max_bid ?? "",
        real_view: "",
      })
    })

    worksheet.autoFilter = {
      from: "A1",
      to: "L1",
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")

    const fileParts = [
      "upcoming-auction",
      auction?.auction_date || "",
      auction?.name ? slugifyFilePart(auction.name) : "",
    ].filter(Boolean)

    link.href = url
    link.download = `${fileParts.join("-") || "upcoming-auction"}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upcoming Auction"
        description={
          auction
            ? `${auction.name} • ${auction.auction_date}`
            : "Review and inspect cars for the next auction"
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button
              variant="outline"
              onClick={exportToXlsx}
              disabled={filteredCars.length === 0}
            >
              <Download className="h-4 w-4" />
              Export XLSX
            </Button>
            <Button asChild>
              <Link href="/run-pipeline">
                <Sparkles className="h-4 w-4" />
                Run Pipeline
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Cars" value={String(metrics.totalCars)} />
        <MetricCard title="Avg Estimated Bid" value={currency(Math.round(metrics.avgBid))} />
        <MetricCard title="Target Cars" value={String(metrics.targetCount)} />
        <MetricCard title="Avoid Cars" value={String(metrics.avoidCount)} />
      </div>

      <div className="flex items-center gap-3 rounded-[24px] border border-white/80 bg-white/82 p-4 text-sm font-medium text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-400 text-white shadow-lg shadow-sky-200/60">
          <CarFront className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Live View</p>
          <p className="mt-1">Filtered cars: {filteredCars.length} of {cars.length} total</p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-[28px] border-white/80 bg-white/86 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <CardContent className="pt-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-lg shadow-amber-200/60">
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Filters</p>
              <p className="text-sm text-slate-600">Refine by bid, mileage, year, lane, and search terms.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-6">
            <Input
              placeholder="Search by year, make, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="col-span-6 md:col-span-2 w-full"
            />
            <Input
              type="number"
              placeholder="Min Est. Bid"
              value={minBid}
              onChange={(e) => setMinBid(e.target.value)}
              className="col-span-3 md:col-span-1 w-full"
            />
            <Input
              type="number"
              placeholder="Max Est. Bid"
              value={maxBid}
              onChange={(e) => setMaxBid(e.target.value)}
              className="col-span-3 md:col-span-1 w-full"
            />
            <Input
              type="number"
              placeholder="Min Year"
              value={minYear}
              onChange={(e) => setMinYear(e.target.value)}
              className="col-span-3 md:col-span-1 w-full"
            />
            <Input
              type="number"
              placeholder="Max Year"
              value={maxYear}
              onChange={(e) => setMaxYear(e.target.value)}
              className="col-span-3 md:col-span-1 w-full"
            />
            <Input
              type="number"
              placeholder="Min Miles"
              value={minMileage}
              onChange={(e) => setMinMileage(e.target.value)}
              className="col-span-3 md:col-span-1 w-full"
            />
            <Input
              type="number"
              placeholder="Max Miles"
              value={maxMileage}
              onChange={(e) => setMaxMileage(e.target.value)}
              className="col-span-3 md:col-span-1 w-full"
            />
            <div className="col-span-6 md:col-span-2 grid gap-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <Route className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lane filter</p>
              </div>
              {laneOptions.length === 0 ? (
                <span className="text-xs text-slate-500">No lanes available</span>
              ) : (
                laneOptions.map((lane) => (
                  <label key={lane} className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      value={lane}
                      checked={laneFilter.includes(lane)}
                      onChange={(e) => {
                        const value = e.target.value
                        setLaneFilter((prev) =>
                          prev.includes(value)
                            ? prev.filter((item) => item !== value)
                            : [...prev, value]
                        )
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    {lane}
                  </label>
                ))
              )}
            </div>
            <p className="col-span-6 text-xs text-amber-700">
              *Low-confidence estimates (few comparables or incomplete data) are highlighted in yellow.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground shadow-sm">Loading cars...</p>}
      {message && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-red-600 shadow-sm">{message}</p>}

      {!loading && filteredCars.length > 0 && (
        <Card className="overflow-hidden rounded-[28px] border-white/80 bg-white/86 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
          <CardContent className="p-0">
            <div className="space-y-4">
              <div className="space-y-3 p-4 sm:hidden">
                {filteredCars.map((car) => {
                  return (
                    <div key={car.id} className="rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                        <span>{car.year} {car.make} {car.model}</span>
                        <span>{car.run_number || "-"}</span>
                      </div>
                      <div className="grid gap-1 text-xs text-slate-700">
                        <div>VIN: {car.vin || "-"}</div>
                        <div>Miles: {car.odometer?.toLocaleString() || "-"}</div>
                        <div>Est. Bid: {currency(car.estimated_bid)}</div>
                        <div>Total Cost: {currency(car.estimated_total_cost)}</div>
                        <div>Max Bid: {currency(car.suggested_max_bid)}</div>
                        <div>Similar Cars: {car.similar_cars_count ?? 0}</div>
                        <div>Decision: <DecisionBadge value={car.decision} /></div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto pb-2 sm:block">
                <table className="w-full table-auto text-sm">
                  <thead className="border-b bg-slate-50/90">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Run</th>
                    <th className="px-4 py-3 font-medium">Vehicle</th>
                    <th className="px-4 py-3 font-medium">VIN</th>
                    <th className="px-4 py-3 font-medium">Miles</th>
                    <th className="px-4 py-3 font-medium">Est. Bid</th>
                    <th className="px-4 py-3 font-medium">Total Cost</th>
                    <th className="px-4 py-3 font-medium">Max Bid</th>
                    <th className="px-4 py-3 font-medium">Similar Cars</th>
                    <th className="px-4 py-3 font-medium">Confidence</th>
                    <th className="px-4 py-3 font-medium">Decision</th>
                  </tr>

                </thead>

                <tbody>
                  {filteredCars.map((car) => {
                    return (
                      <tr
                      key={car.id}
                      className={`border-b border-slate-100 transition-colors hover:bg-sky-50/35 ${car.confidence === "Low" ? "bg-amber-50/70" : ""}`}
                    >
                        <td className="px-4 py-3">{car.run_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {car.year} {car.make} {car.model}
                          </div>
                          <div className="text-xs text-muted-foreground">{car.style || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{car.vin || "-"}</td>
                        <td className="px-4 py-3">{car.odometer?.toLocaleString() || "-"}</td>
                        <td className="px-4 py-3 font-medium">
                          {currency(car.estimated_bid)}
                          {car.confidence === "Low" ? " *" : ""}
                        </td>
                        <td className="px-4 py-3">
                          {currency(car.estimated_total_cost)}
                          {car.confidence === "Low" ? " *" : ""}
                        </td>
                        <td className="px-4 py-3">{currency(car.suggested_max_bid)}</td>
                        <td className="px-4 py-3">{car.similar_cars_count ?? 0}</td>
                        <td className="px-4 py-3">
                          <ConfidenceBadge value={car.confidence} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="mb-2">
                            <DecisionBadge value={car.decision} />
                          </div>
                          <select
                            className="w-full rounded-md border border-slate-300 px-2 py-1"
                            value={car.decision || "Maybe"}
                            onChange={(e) => updateDecision(car.id, e.target.value)}
                          >
                            <option value="Target">Target</option>
                            <option value="Maybe">Maybe</option>
                            <option value="Avoid">Avoid</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
