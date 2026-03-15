"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { PageHeader } from "@/components/page-header"
import { MetricCard } from "@/components/metric-card"

type CarInspection = {
  overall_condition: string | null
  repair_estimate: number | null
}

type AuctionCar = {
  id: string
  auction_id: string
  run_number: string | null
  lane: string | null
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
  estimated_bid: number | null
  estimated_bid_min: number | null
  estimated_bid_max: number | null
  auction_fee: number | null
  estimated_total_cost: number | null
  suggested_max_bid: number | null
  confidence: string | null
  decision: string | null
  notes: string | null
  car_inspections?: CarInspection[] | null
}

type Auction = {
  id: string
  name: string
  auction_date: string
}

function avg(values: number[]) {
  if (!values.length) return 0
  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.round(total / values.length)
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export default function DashboardPage() {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [cars, setCars] = useState<AuctionCar[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

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

  const metrics = useMemo(() => {
    const estimatedBids = cars
      .map((car) => car.estimated_bid)
      .filter((value): value is number => value !== null)

    const totalCosts = cars
      .map((car) => car.estimated_total_cost)
      .filter((value): value is number => value !== null)

    const targetCount = cars.filter((car) => car.decision === "Target").length
    const maybeCount = cars.filter((car) => car.decision === "Maybe").length
    const avoidCount = cars.filter((car) => car.decision === "Avoid").length

    const laneCounts = cars.reduce<Record<string, number>>((acc, car) => {
      const lane = car.lane || "Unknown"
      acc[lane] = (acc[lane] || 0) + 1
      return acc
    }, {})

    return {
      totalCars: cars.length,
      avgEstimatedBid: avg(estimatedBids),
      avgTotalCost: avg(totalCosts),
      targetCount,
      maybeCount,
      avoidCount,
      laneCounts,
    }
  }, [cars])

  const topOpportunities = useMemo(() => {
    return [...cars]
      .filter(
        (car) =>
          car.suggested_max_bid !== null &&
          car.estimated_bid !== null &&
          car.decision !== "Avoid"
      )
      .map((car) => ({
        ...car,
        opportunityGap:
          (car.estimated_bid || 0) - (car.suggested_max_bid || 0),
      }))
      .sort((a, b) => a.opportunityGap - b.opportunityGap)
      .slice(0, 10)
  }, [cars])

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
            <MetricCard title="Avg Estimated Bid" value={currency(metrics.avgEstimatedBid)} />
            <MetricCard title="Avg Total Cost" value={currency(metrics.avgTotalCost)} />
            <MetricCard title="Target" value={String(metrics.targetCount)} />
            <MetricCard title="Maybe" value={String(metrics.maybeCount)} />
            <MetricCard title="Avoid" value={String(metrics.avoidCount)} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Lane Distribution</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(metrics.laneCounts)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([lane, count]) => (
                  <div key={lane} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-700">Lane {lane}</p>
                    <p className="text-2xl font-bold text-slate-900">{count}</p>
                  </div>
                ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Top Opportunities</h2>
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Run</th>
                    <th className="px-3 py-2">Lane</th>
                    <th className="px-3 py-2">Year</th>
                    <th className="px-3 py-2">Make</th>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Miles</th>
                    <th className="px-3 py-2">Estimated Bid</th>
                    <th className="px-3 py-2">Total Cost</th>
                    <th className="px-3 py-2">Max Bid</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2">Decision</th>
                    <th className="px-3 py-2">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {topOpportunities.map((car) => {
                    const inspection = car.car_inspections?.[0]
                    return (
                      <tr key={car.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">{car.run_number || "-"}</td>
                        <td className="px-3 py-2">{car.lane || "-"}</td>
                        <td className="px-3 py-2">{car.year || "-"}</td>
                        <td className="px-3 py-2">{car.make || "-"}</td>
                        <td className="px-3 py-2">{car.model || "-"}</td>
                        <td className="px-3 py-2">{car.odometer ?? "-"}</td>
                        <td className="px-3 py-2">{car.estimated_bid ? currency(car.estimated_bid) : "-"}</td>
                        <td className="px-3 py-2">{car.estimated_total_cost ? currency(car.estimated_total_cost) : "-"}</td>
                        <td className="px-3 py-2">{car.suggested_max_bid ? currency(car.suggested_max_bid) : "-"}</td>
                        <td className="px-3 py-2">{car.confidence || "-"}</td>
                        <td className="px-3 py-2">{car.decision || "-"}</td>
                        <td className="px-3 py-2">{inspection?.overall_condition || "-"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
