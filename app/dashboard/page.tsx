"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import ExcelJS from "exceljs"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const PAGE_SIZE = 30

type Auction = {
  id: string
  name: string
  auction_date: string
}

type CarInspection = {
  id?: string
  auction_car_id?: string
  overall_condition: string | null
  repair_estimate: number | null
}

type AuctionCar = {
  id: string
  auction_id: string
  run_number: string | null
  lane: string | null
  vin: string | null
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
  estimated_bid: number | null
  estimated_bid_min: number | null
  estimated_bid_max: number | null
  auction_fee: number | null
  estimated_total_cost: number | null
  real_bid: number | null
  suggested_max_bid: number | null
  confidence: string | null
  decision: string | null
  notes: string | null
  inspection_checked: boolean
  engine_lights_checked: boolean
  dirt_checked: boolean
  notes_checked: boolean
  car_inspections?: CarInspection[] | null
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function calculateAuctionFee(value: number | null) {
  if (value === null || value === undefined) return null
  if (value <= 1000) return 250
  if (value <= 2000) return 350
  if (value <= 3000) return 450
  if (value <= 4000) return 550
  if (value <= 5000) return 650
  return 750
}

function displayValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-"
  return value
}

function slugifyFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getRunSortParts(runNumber: string | null) {
  if (!runNumber) {
    return {
      letters: "\uffff",
      number: Number.MAX_SAFE_INTEGER,
      raw: "",
    }
  }

  const normalizedRun = runNumber.trim().toUpperCase()
  const lettersMatch = normalizedRun.match(/[A-Z]+/)
  const numberMatch = normalizedRun.match(/\d+/)

  return {
    letters: lettersMatch?.[0] || "",
    number: numberMatch ? Number(numberMatch[0]) : Number.MAX_SAFE_INTEGER,
    raw: normalizedRun,
  }
}

function sortCarsByRun(cars: AuctionCar[]) {
  return [...cars].sort((a, b) => {
    const runA = getRunSortParts(a.run_number)
    const runB = getRunSortParts(b.run_number)

    const numberCompare = runA.number - runB.number
    if (numberCompare !== 0) return numberCompare

    const letterCompare = runA.letters.localeCompare(runB.letters)
    if (letterCompare !== 0) return letterCompare

    return runA.raw.localeCompare(runB.raw)
  })
}

export default function DashboardPage() {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [cars, setCars] = useState<AuctionCar[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [selectedCar, setSelectedCar] = useState<AuctionCar | null>(null)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [targetPage, setTargetPage] = useState(1)
  const [maybePage, setMaybePage] = useState(1)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  async function loadDashboard() {
    setLoading(true)
    setMessage("")

    const { data: latestAuction, error: auctionError } = await supabase
      .from("auctions")
      .select("id, name, auction_date")
      .eq("source_type", "presale")
      .order("auction_date", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (auctionError) {
      console.error(auctionError)
      setMessage("Error loading the latest auction.")
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
      .select(`
        *,
        car_inspections (
          id,
          auction_car_id,
          overall_condition,
          repair_estimate
        )
      `)
      .eq("auction_id", latestAuction.id)

    if (carsError) {
      console.error(carsError)
      setMessage("Error loading dashboard cars.")
      setLoading(false)
      return
    }

    setCars(carsData || [])
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboard()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  async function updateCheckboxField(
    carId: string,
    field: "inspection_checked" | "engine_lights_checked" | "dirt_checked",
    value: boolean
  ) {
    setSavingField(field)
    setMessage("")

    const { error } = await supabase
      .from("auction_cars")
      .update({ [field]: value })
      .eq("id", carId)

    if (error) {
      console.error(error)
      setMessage(`Error saving car checkboxes: ${error.message}`)
      setSavingField(null)
      return
    }

    setCars((prev) =>
      prev.map((car) => (car.id === carId ? { ...car, [field]: value } : car))
    )
    setSelectedCar((prev) => (prev && prev.id === carId ? { ...prev, [field]: value } : prev))
    setSavingField(null)
  }

  async function updateNotes(carId: string, notes: string) {
    setSavingField("notes")
    setMessage("")

    const { error } = await supabase
      .from("auction_cars")
      .update({ notes })
      .eq("id", carId)

    if (error) {
      console.error(error)
      setMessage(`Error saving notes: ${error.message}`)
      setSavingField(null)
      return
    }

    setCars((prev) =>
      prev.map((car) => (car.id === carId ? { ...car, notes } : car))
    )
    setSelectedCar((prev) => (prev && prev.id === carId ? { ...prev, notes } : prev))
    setSavingField(null)
  }

  async function updateDecision(carId: string, decision: string) {
    setSavingField("decision")
    setMessage("")

    const { error } = await supabase
      .from("auction_cars")
      .update({ decision })
      .eq("id", carId)

    if (error) {
      console.error(error)
      setMessage(`Error saving decision: ${error.message}`)
      setSavingField(null)
      return
    }

    setCars((prev) =>
      prev.map((car) => (car.id === carId ? { ...car, decision } : car))
    )
    setSelectedCar((prev) => (prev && prev.id === carId ? { ...prev, decision } : prev))
    setSavingField(null)
  }

  async function updateRealBid(carId: string, realBid: number | null) {
    setSavingField("real_bid")
    setMessage("")

    const { error } = await supabase
      .from("auction_cars")
      .update({ real_bid: realBid })
      .eq("id", carId)

    if (error) {
      console.error(error)
      setMessage(`Error saving real bid: ${error.message}`)
      setSavingField(null)
      return
    }

    setCars((prev) =>
      prev.map((car) => (car.id === carId ? { ...car, real_bid: realBid } : car))
    )
    setSelectedCar((prev) => (prev && prev.id === carId ? { ...prev, real_bid: realBid } : prev))
    setSavingField(null)
  }

  async function upsertInspectionCondition(
    carId: string,
    overallCondition: string | null
  ) {
    setSavingField("overall_condition")
    setMessage("")

    const { data, error } = await supabase
      .from("car_inspections")
      .upsert(
        [{ auction_car_id: carId, overall_condition: overallCondition }],
        { onConflict: "auction_car_id" }
      )
      .select("id, auction_car_id, overall_condition, repair_estimate")
      .single()

    if (error) {
      console.error(error)
      setMessage(`Error saving condition: ${error.message}`)
      setSavingField(null)
      return
    }

    setCars((prev) =>
      prev.map((car) =>
        car.id === carId ? { ...car, car_inspections: [data] } : car
      )
    )
    setSelectedCar((prev) =>
      prev && prev.id === carId ? { ...prev, car_inspections: [data] } : prev
    )
    setSavingField(null)
  }

  const metrics = useMemo(() => {
    const targetCount = cars.filter((car) => car.decision === "Target").length
    const maybeCount = cars.filter((car) => car.decision === "Maybe").length
    const avoidCount = cars.filter((car) => car.decision === "Avoid").length

    return {
      totalCars: cars.length,
      targetCount,
      maybeCount,
      avoidCount,
    }
  }, [cars])

  const chartData = useMemo(() => {
    const total = Math.max(metrics.totalCars, 1)
    const targetAngle = (metrics.targetCount / total) * 360
    const maybeAngle = (metrics.maybeCount / total) * 360
    const avoidAngle = (metrics.avoidCount / total) * 360

    return {
      targetPercent: Math.round((metrics.targetCount / total) * 100),
      maybePercent: Math.round((metrics.maybeCount / total) * 100),
      avoidPercent: Math.round((metrics.avoidCount / total) * 100),
      background: `conic-gradient(from 210deg, #10b981 0deg ${targetAngle}deg, #f59e0b ${targetAngle}deg ${targetAngle + maybeAngle}deg, #f43f5e ${targetAngle + maybeAngle}deg ${targetAngle + maybeAngle + avoidAngle}deg, #e2e8f0 ${targetAngle + maybeAngle + avoidAngle}deg 360deg)`,
    }
  }, [metrics])

  const targetCars = useMemo(() => {
    return sortCarsByRun(cars.filter((car) => car.decision === "Target"))
  }, [cars])

  const maybeCars = useMemo(() => {
    return sortCarsByRun(cars.filter((car) => car.decision === "Maybe"))
  }, [cars])

  const targetTotalPages = Math.max(1, Math.ceil(targetCars.length / PAGE_SIZE))
  const maybeTotalPages = Math.max(1, Math.ceil(maybeCars.length / PAGE_SIZE))
  const currentTargetPage = Math.min(targetPage, targetTotalPages)
  const currentMaybePage = Math.min(maybePage, maybeTotalPages)

  const paginatedTargetCars = useMemo(() => {
    const start = (currentTargetPage - 1) * PAGE_SIZE
    return targetCars.slice(start, start + PAGE_SIZE)
  }, [currentTargetPage, targetCars])

  const paginatedMaybeCars = useMemo(() => {
    const start = (currentMaybePage - 1) * PAGE_SIZE
    return maybeCars.slice(start, start + PAGE_SIZE)
  }, [currentMaybePage, maybeCars])

  const selectedInspection = selectedCar?.car_inspections?.[0]

  async function exportCarsToXlsx(decision: "Target" | "Maybe", carsToExport: AuctionCar[]) {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(decision, {
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

    carsToExport.forEach((car, index) => {
      worksheet.addRow({
        row: index + 1,
        num: car.run_number || "",
        year: car.year ?? "",
        make: car.make || "",
        model: car.model || "",
        mileage: car.odometer ?? "",
        vin: car.vin || "",
        inspection: car.inspection_checked ? "Yes" : "",
        engine_lights: car.engine_lights_checked ? "Yes" : "",
        body: car.dirt_checked ? "Yes" : "",
        suggested_bid: car.suggested_max_bid ?? "",
        real_view: car.real_bid ?? "",
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
      "dashboard",
      decision.toLowerCase(),
      auction?.auction_date || "",
      auction?.name ? slugifyFilePart(auction.name) : "",
    ].filter(Boolean)

    link.href = url
    link.download = `${fileParts.join("-") || `dashboard-${decision.toLowerCase()}`}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  function renderCarsTable(
    title: string,
    carsToRender: AuctionCar[],
    emptyMessage: string,
    currentPage: number,
    totalPages: number,
    onFirstPage: () => void,
    onPreviousPage: () => void,
    onNextPage: () => void,
    onLastPage: () => void
  ) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
        <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-[1000px] divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-20 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-20 px-3 py-2">Run</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Make</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Miles</th>
                <th className="px-3 py-2">Market Estimate</th>
                <th className="px-3 py-2">Safe Max Bid</th>
                <th className="px-3 py-2">Real Bid</th>
                <th className="px-3 py-2">Inspection</th>
                <th className="px-3 py-2">Engine Lights</th>
                <th className="px-3 py-2">Dirt</th>
                <th className="px-3 py-2">Condition</th>
                <th className="px-3 py-2">Fees</th>
                <th className="px-3 py-2">Real Bid + Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {carsToRender.map((car) => {
                const inspection = car.car_inspections?.[0]
                const displayedFee =
                  car.real_bid !== null
                    ? calculateAuctionFee(car.real_bid)
                    : car.auction_fee
                const realBidPlusFees =
                  car.real_bid !== null && displayedFee !== null
                    ? car.real_bid + displayedFee
                    : null
                const hasNotes = Boolean(car.notes?.trim())
                return (
                  <tr
                    key={car.id}
                    className="cursor-pointer hover:bg-slate-50 focus-within:bg-slate-50"
                    onClick={() => setSelectedCar(car)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setSelectedCar(car)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalhes de ${displayValue(car.year)} ${displayValue(car.make)} ${displayValue(car.model)}`}
                  >
                    <td className="w-20 whitespace-nowrap px-3 py-2 font-medium">
                      {car.run_number || "-"}
                      {hasNotes && <span className="ml-1 text-amber-600">*</span>}
                    </td>
                    <td className="px-3 py-2">{car.year || "-"}</td>
                    <td className="px-3 py-2">{car.make || "-"}</td>
                    <td className="px-3 py-2">{car.model || "-"}</td>
                    <td className="px-3 py-2">{car.odometer ?? "-"}</td>
                    <td className="px-3 py-2">{car.estimated_bid ? currency(car.estimated_bid) : "-"}</td>
                    <td className="px-3 py-2">{car.suggested_max_bid ? currency(car.suggested_max_bid) : "-"}</td>
                    <td className="px-3 py-2">{car.real_bid !== null ? currency(car.real_bid) : "-"}</td>
                    <td className="px-3 py-2">{car.inspection_checked ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{car.engine_lights_checked ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{car.dirt_checked ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{inspection?.overall_condition || "-"}</td>
                    <td className="px-3 py-2">{displayedFee !== null ? currency(displayedFee) : "-"}</td>
                    <td className="px-3 py-2">{realBidPlusFees !== null ? currency(realBidPlusFees) : "-"}</td>
                  </tr>
                )
              })}
              {carsToRender.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-6 text-center text-slate-500">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
          <button
            type="button"
            onClick={onFirstPage}
            disabled={currentPage === 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            First
          </button>
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={currentPage === 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={currentPage === totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
          <button
            type="button"
            onClick={onLastPage}
            disabled={currentPage === totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Last
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-emerald-50/60 to-amber-50/80 p-6 shadow-sm">
        <div className="absolute -top-20 right-0 h-48 w-48 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                <p className="mt-1 text-sm text-slate-500">Auction summary</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setExportMenuOpen((open) => !open)}
                    disabled={targetCars.length === 0 && maybeCars.length === 0}
                  >
                    Export Excel
                  </Button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 z-30 mt-2 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setExportMenuOpen(false)
                          void exportCarsToXlsx("Target", targetCars)
                        }}
                        disabled={targetCars.length === 0}
                        className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Export Target
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExportMenuOpen(false)
                          void exportCarsToXlsx("Maybe", maybeCars)
                        }}
                        disabled={maybeCars.length === 0}
                        className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Export Maybe
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-8 sm:flex-row sm:items-center sm:justify-center xl:mx-0 xl:justify-start">
              <div
                className="relative flex h-56 w-56 items-center justify-center rounded-full shadow-inner"
                style={{ background: chartData.background }}
              >
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border border-white/90 bg-white/95 text-center shadow-lg">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Total</span>
                  <span className="mt-1 text-4xl font-bold tracking-tight text-slate-900">{metrics.totalCars}</span>
                  <span className="mt-1 text-xs text-slate-500">Cars in dashboard</span>
                </div>
              </div>

              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.15)]" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-950">Target</p>
                      <p className="text-xs text-emerald-700">{chartData.targetPercent}% of total</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-emerald-950">{metrics.targetCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_0_5px_rgba(245,158,11,0.15)]" />
                    <div>
                      <p className="text-sm font-semibold text-amber-950">Maybe</p>
                      <p className="text-xs text-amber-700">{chartData.maybePercent}% of total</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-amber-950">{metrics.maybeCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_0_5px_rgba(244,63,94,0.14)]" />
                    <div>
                      <p className="text-sm font-semibold text-rose-950">Avoid</p>
                      <p className="text-xs text-rose-700">{chartData.avoidPercent}% of total</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-rose-950">{metrics.avoidCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading && <p className="rounded-md bg-slate-100 p-4 text-sm text-slate-600">Loading dashboard...</p>}
      {message && <p className="rounded-md bg-rose-50 p-4 text-sm text-rose-700">{message}</p>}

      {!loading && !message && (
        <>
          {renderCarsTable(
            "Target Cars",
            paginatedTargetCars,
            "No cars marked as Target in this auction.",
            currentTargetPage,
            targetTotalPages,
            () => setTargetPage(1),
            () => setTargetPage((page) => Math.max(1, page - 1)),
            () => setTargetPage((page) => Math.min(targetTotalPages, page + 1)),
            () => setTargetPage(targetTotalPages)
          )}

          {renderCarsTable(
            "Maybe Cars",
            paginatedMaybeCars,
            "No cars marked as Maybe in this auction.",
            currentMaybePage,
            maybeTotalPages,
            () => setMaybePage(1),
            () => setMaybePage((page) => Math.max(1, page - 1)),
            () => setMaybePage((page) => Math.min(maybeTotalPages, page + 1)),
            () => setMaybePage(maybeTotalPages)
          )}

          <Sheet open={selectedCar !== null} onOpenChange={(open) => !open && setSelectedCar(null)}>
            <SheetContent side="center" className="border-slate-200 bg-slate-50">
              <SheetHeader className="border-b border-slate-200 bg-white pr-12">
                <SheetTitle className="text-xl">
                  {selectedCar
                    ? `${displayValue(selectedCar.year)} ${displayValue(selectedCar.make)} ${displayValue(selectedCar.model)}`
                    : "Car details"}
                </SheetTitle>
                <SheetDescription>
                  {selectedCar
                    ? ""
                    : "Detailed information for the selected vehicle."}
                </SheetDescription>
              </SheetHeader>

              {selectedCar && (
                <div className="space-y-4 overflow-y-auto px-4 pb-4">
                  <section className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-3 py-2.5">
                      <h3 className="text-xs font-semibold text-slate-900">Checklist</h3>
                    </div>
                    <div className="grid gap-2.5 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-xs font-medium text-slate-800">Inspection</span>
                        <input
                          type="checkbox"
                          checked={selectedCar.inspection_checked}
                          onChange={(event) =>
                            void updateCheckboxField(selectedCar.id, "inspection_checked", event.target.checked)
                          }
                          disabled={savingField === "inspection_checked"}
                          className="h-4 w-4 accent-slate-900"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-xs font-medium text-slate-800">Engine Lights</span>
                        <input
                          type="checkbox"
                          checked={selectedCar.engine_lights_checked}
                          onChange={(event) =>
                            void updateCheckboxField(selectedCar.id, "engine_lights_checked", event.target.checked)
                          }
                          disabled={savingField === "engine_lights_checked"}
                          className="h-4 w-4 accent-slate-900"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-xs font-medium text-slate-800">Dirt</span>
                        <input
                          type="checkbox"
                          checked={selectedCar.dirt_checked}
                          onChange={(event) =>
                            void updateCheckboxField(selectedCar.id, "dirt_checked", event.target.checked)
                          }
                          disabled={savingField === "dirt_checked"}
                          className="h-4 w-4 accent-slate-900"
                        />
                      </label>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-medium text-slate-800">Condition</p>
                        <select
                          className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
                          value={selectedInspection?.overall_condition ?? "unknown"}
                          onChange={(event) =>
                            void upsertInspectionCondition(
                              selectedCar.id,
                              event.target.value === "unknown" ? null : event.target.value
                            )
                          }
                          disabled={savingField === "overall_condition"}
                        >
                          <option value="unknown">Unknown</option>
                          <option value="poor">Poor</option>
                          <option value="ok">OK</option>
                          <option value="good">Good</option>
                          <option value="excellent">Excellent</option>
                        </select>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-medium text-slate-800">Decision</p>
                        <select
                          className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                          value={selectedCar.decision ?? "Maybe"}
                          onChange={(event) => void updateDecision(selectedCar.id, event.target.value)}
                          disabled={savingField === "decision"}
                        >
                          <option value="Target">Target</option>
                          <option value="Maybe">Maybe</option>
                          <option value="Avoid">Avoid</option>
                        </select>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2 lg:col-span-1">
                        <p className="text-xs font-medium text-slate-800">Real Bid</p>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          defaultValue={selectedCar.real_bid ?? ""}
                          placeholder="Enter the real bid"
                          onInput={(event) => {
                            event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "")
                          }}
                          onBlur={(event) =>
                            void updateRealBid(
                              selectedCar.id,
                              event.target.value.trim() === "" ? null : Number(event.target.value)
                            )
                          }
                          className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                        />
                      </div>
                    </div>
                    {savingField && (
                      <div className="px-3 pb-3">
                        <p className="text-xs text-slate-500">Saving changes...</p>
                      </div>
                    )}
                  </section>

                  <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:col-span-2 lg:col-span-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">VIN</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-900">{displayValue(selectedCar.vin)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Odometer</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-900">{displayValue(selectedCar.odometer)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Auction Fee</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-900">
                        {selectedCar.auction_fee !== null ? currency(selectedCar.auction_fee) : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Market Estimate</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-900">
                        {selectedCar.estimated_bid !== null ? currency(selectedCar.estimated_bid) : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Estimated Total Cost</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-900">
                        {selectedCar.estimated_total_cost !== null ? currency(selectedCar.estimated_total_cost) : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Safe Max Bid</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-900">
                        {selectedCar.suggested_max_bid !== null ? currency(selectedCar.suggested_max_bid) : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Confidence</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-900">{displayValue(selectedCar.confidence)}</p>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-3 py-2.5">
                      <h3 className="text-xs font-semibold text-slate-900">Notes</h3>
                    </div>
                    <div className="px-3 py-3">
                      <textarea
                        className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-800"
                        defaultValue={selectedCar.notes || ""}
                        placeholder="Add notes about this car..."
                        onBlur={(event) => void updateNotes(selectedCar.id, event.target.value)}
                      />
                    </div>
                  </section>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}

