"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

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
    loadDashboard()
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
    <div style={{ padding: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Dashboard</h1>
        <Link href="/upcoming-auction">Go to Upcoming Auction</Link>
      </div>

      {auction && (
        <div style={{ marginBottom: 24 }}>
          <p><strong>Auction:</strong> {auction.name}</p>
          <p><strong>Date:</strong> {auction.auction_date}</p>
        </div>
      )}

      {loading && <p>Loading dashboard...</p>}
      {message && <p>{message}</p>}

      {!loading && !message && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <Card title="Total Cars" value={String(metrics.totalCars)} />
            <Card
              title="Avg Estimated Bid"
              value={currency(metrics.avgEstimatedBid)}
            />
            <Card
              title="Avg Total Cost"
              value={currency(metrics.avgTotalCost)}
            />
            <Card title="Target" value={String(metrics.targetCount)} />
            <Card title="Maybe" value={String(metrics.maybeCount)} />
            <Card title="Avoid" value={String(metrics.avoidCount)} />
          </div>

          <section style={{ marginBottom: 32 }}>
            <h2>Lane Distribution</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
                gap: 12,
              }}
            >
              {Object.entries(metrics.laneCounts)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([lane, count]) => (
                  <div
                    key={lane}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <strong>Lane {lane}</strong>
                    <div>{count} cars</div>
                  </div>
                ))}
            </div>
          </section>

          <section>
            <h2>Top Opportunities</h2>
            <div style={{ overflowX: "auto" }}>
              <table
                border={1}
                cellPadding={6}
                style={{ borderCollapse: "collapse", minWidth: 1000 }}
              >
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Lane</th>
                    <th>Year</th>
                    <th>Make</th>
                    <th>Model</th>
                    <th>Miles</th>
                    <th>Estimated Bid</th>
                    <th>Total Cost</th>
                    <th>Max Bid</th>
                    <th>Confidence</th>
                    <th>Decision</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {topOpportunities.map((car) => {
                    const inspection = car.car_inspections?.[0]
                    return (
                      <tr key={car.id}>
                        <td>{car.run_number}</td>
                        <td>{car.lane}</td>
                        <td>{car.year}</td>
                        <td>{car.make}</td>
                        <td>{car.model}</td>
                        <td>{car.odometer}</td>
                        <td>{car.estimated_bid ? currency(car.estimated_bid) : "-"}</td>
                        <td>
                          {car.estimated_total_cost
                            ? currency(car.estimated_total_cost)
                            : "-"}
                        </td>
                        <td>
                          {car.suggested_max_bid
                            ? currency(car.suggested_max_bid)
                            : "-"}
                        </td>
                        <td>{car.confidence || "-"}</td>
                        <td>{car.decision || "-"}</td>
                        <td>{inspection?.overall_condition || "-"}</td>
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

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  )
}
