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

type Auction = {
  id: string
  name: string
  auction_date: string
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function displayValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-"
  return value
}

function getRunSortValue(runNumber: string | null) {
  if (!runNumber) return Number.MAX_SAFE_INTEGER

  const match = runNumber.match(/\d+/)
  if (!match) return Number.MAX_SAFE_INTEGER

  return Number(match[0])
}

function sortCarsByRun(cars: AuctionCar[]) {
  return [...cars].sort((a, b) => {
    const runCompare = getRunSortValue(a.run_number) - getRunSortValue(b.run_number)
    if (runCompare !== 0) return runCompare

    return (a.run_number || "").localeCompare(b.run_number || "")
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
      setMessage("Erro ao buscar o último leilão.")
      setLoading(false)
      return
    }

    if (!latestAuction) {
      setMessage("Nenhum leilão presale encontrado.")
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
      setMessage("Erro ao buscar os carros do dashboard.")
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
      setMessage(`Erro ao salvar os checkboxes do carro: ${error.message}`)
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
      setMessage(`Erro ao salvar as notes: ${error.message}`)
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
      setMessage(`Erro ao salvar a decision: ${error.message}`)
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
      setMessage(`Erro ao salvar o real bid: ${error.message}`)
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
      setMessage(`Erro ao salvar a condition: ${error.message}`)
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
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Make</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Miles</th>
                <th className="px-3 py-2">Estimated Bid</th>
                <th className="px-3 py-2">Max Bid</th>
                <th className="px-3 py-2">Real Bid</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Condition</th>
                <th className="px-3 py-2">Inspection</th>
                <th className="px-3 py-2">Engine Lights</th>
                <th className="px-3 py-2">Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {carsToRender.map((car) => {
                const inspection = car.car_inspections?.[0]
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
                    <td className="px-3 py-2">{car.run_number || "-"}</td>
                    <td className="px-3 py-2">{car.year || "-"}</td>
                    <td className="px-3 py-2">{car.make || "-"}</td>
                    <td className="px-3 py-2">{car.model || "-"}</td>
                    <td className="px-3 py-2">{car.odometer ?? "-"}</td>
                    <td className="px-3 py-2">{car.estimated_bid ? currency(car.estimated_bid) : "-"}</td>
                    <td className="px-3 py-2">{car.suggested_max_bid ? currency(car.suggested_max_bid) : "-"}</td>
                    <td className="px-3 py-2">{car.real_bid !== null ? currency(car.real_bid) : "-"}</td>
                    <td className="px-3 py-2">{car.confidence || "-"}</td>
                    <td className="px-3 py-2">{inspection?.overall_condition || "-"}</td>
                    <td className="px-3 py-2">{car.inspection_checked ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{car.engine_lights_checked ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{car.auction_fee !== null ? currency(car.auction_fee) : "-"}</td>
                  </tr>
                )
              })}
              {carsToRender.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-slate-500">
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
            Primeira
          </button>
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={currentPage === 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span>
            Pagina {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={currentPage === totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proxima
          </button>
          <button
            type="button"
            onClick={onLastPage}
            disabled={currentPage === totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ultima
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          auction
            ? `${auction.name} • ${auction.auction_date}`
            : "Resumo dos dados do leilão"
        }
        actions={
          <Link href="/upcoming-auction" className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Upcoming Auction
          </Link>
        }
      />

      {loading && <p className="rounded-md bg-slate-100 p-4 text-sm text-slate-600">Carregando dashboard...</p>}
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
            "Nenhum carro marcado como Target neste leilao.",
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
            "Nenhum carro marcado como Maybe neste leilao.",
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
                <SheetTitle>
                  {selectedCar
                    ? `${displayValue(selectedCar.year)} ${displayValue(selectedCar.make)} ${displayValue(selectedCar.model)}`
                    : "Detalhes do carro"}
                </SheetTitle>
                <SheetDescription>
                  {selectedCar
                    ? `Run ${displayValue(selectedCar.run_number)} • Lane ${displayValue(selectedCar.lane)}`
                    : "Informacoes detalhadas do veiculo selecionado."}
                </SheetDescription>
              </SheetHeader>

              {selectedCar && (
                <div className="space-y-6 px-4 pb-6">
                  <section className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <h3 className="text-sm font-semibold text-slate-900">Checklist</h3>
                    </div>
                    <div className="space-y-3 px-4 py-4">
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-sm font-medium text-slate-800">Inspection</span>
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
                        <span className="text-sm font-medium text-slate-800">Engine Lights</span>
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
                        <p className="text-sm font-medium text-slate-800">Condition</p>
                        <select
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800"
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
                        <p className="text-sm font-medium text-slate-800">Decision</p>
                        <select
                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
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
                        <p className="text-sm font-medium text-slate-800">Real Bid</p>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          defaultValue={selectedCar.real_bid ?? ""}
                          placeholder="Informe o valor real"
                          onInput={(event) => {
                            event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "")
                          }}
                          onBlur={(event) =>
                            void updateRealBid(
                              selectedCar.id,
                              event.target.value.trim() === "" ? null : Number(event.target.value)
                            )
                          }
                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                        />
                      </div>
                      {savingField && (
                        <p className="text-xs text-slate-500">Salvando alteracao...</p>
                      )}
                    </div>
                  </section>

                  <section className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">VIN</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{displayValue(selectedCar.vin)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Odometer</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{displayValue(selectedCar.odometer)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Auction Fee</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {selectedCar.auction_fee !== null ? currency(selectedCar.auction_fee) : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estimated Bid</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {selectedCar.estimated_bid !== null ? currency(selectedCar.estimated_bid) : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estimated Total Cost</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {selectedCar.estimated_total_cost !== null ? currency(selectedCar.estimated_total_cost) : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Suggested Max Bid</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {selectedCar.suggested_max_bid !== null ? currency(selectedCar.suggested_max_bid) : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Confidence</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{displayValue(selectedCar.confidence)}</p>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
                    </div>
                    <div className="px-4 py-4">
                      <textarea
                        className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800"
                        defaultValue={selectedCar.notes || ""}
                        placeholder="Adicione observacoes sobre este carro..."
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
