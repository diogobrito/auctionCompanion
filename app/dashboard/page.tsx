"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { PageHeader } from "@/components/page-header"
import { MetricCard } from "@/components/metric-card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const PAGE_SIZE = 30

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
  const [cars, setCars] = useState<AuctionCar[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [selectedCar, setSelectedCar] = useState<AuctionCar | null>(null)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [targetPage, setTargetPage] = useState(1)
  const [maybePage, setMaybePage] = useState(1)

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
    field: "inspection_checked" | "engine_lights_checked",
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
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-20 px-3 py-2">Run</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Make</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">VIN</th>
                <th className="px-3 py-2">Miles</th>
                <th className="px-3 py-2">Market Estimate</th>
                <th className="px-3 py-2">Safe Max Bid</th>
                <th className="px-3 py-2">Real Bid</th>
                <th className="px-3 py-2">Inspection</th>
                <th className="px-3 py-2">Engine Lights</th>
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
                    <td className="w-20 whitespace-nowrap px-3 py-2">{car.run_number || "-"}</td>
                    <td className="px-3 py-2">{car.year || "-"}</td>
                    <td className="px-3 py-2">{car.make || "-"}</td>
                    <td className="px-3 py-2">{car.model || "-"}</td>
                    <td className="px-3 py-2">{car.vin || "-"}</td>
                    <td className="px-3 py-2">{car.odometer ?? "-"}</td>
                    <td className="px-3 py-2">{car.estimated_bid ? currency(car.estimated_bid) : "-"}</td>
                    <td className="px-3 py-2">{car.suggested_max_bid ? currency(car.suggested_max_bid) : "-"}</td>
                    <td className="px-3 py-2">{car.real_bid !== null ? currency(car.real_bid) : "-"}</td>
                    <td className="px-3 py-2">{car.inspection_checked ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{car.engine_lights_checked ? "Yes" : "No"}</td>
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
      <PageHeader
        title="Dashboard"
        description="Auction summary"
        actions={
          <Link href="/upcoming-auction" className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Upcoming Auction
          </Link>
        }
      />

      {loading && <p className="rounded-md bg-slate-100 p-4 text-sm text-slate-600">Loading dashboard...</p>}
      {message && <p className="rounded-md bg-rose-50 p-4 text-sm text-rose-700">{message}</p>}

      {!loading && !message && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard title="Total Cars" value={String(metrics.totalCars)} />
            <MetricCard title="Target" value={String(metrics.targetCount)} />
            <MetricCard title="Maybe" value={String(metrics.maybeCount)} />
            <MetricCard title="Avoid" value={String(metrics.avoidCount)} />
          </div>

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
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
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
                <div className="space-y-4 px-3 pb-4">
                  <section className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-3 py-2.5">
                      <h3 className="text-xs font-semibold text-slate-900">Checklist</h3>
                    </div>
                    <div className="space-y-2.5 px-3 py-3">
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
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
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
                      {savingField && (
                        <p className="text-xs text-slate-500">Saving changes...</p>
                      )}
                    </div>
                  </section>

                  <section className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:col-span-2">
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
