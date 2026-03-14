"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type CarInspection = {
  id: string
  auction_car_id: string
  inspection_valid: boolean | null
  dashboard_lights: string | null
  tires_condition: string | null
  body_condition: string | null
  engine_functioning: string | null
  interior_cleanliness: string | null
  overall_condition: string | null
  repair_estimate: number | null
  personal_notes: string | null
}

type AuctionCar = {
  id: string
  auction_id: string
  run_number: string | null
  lane: string | null
  year: number | null
  make: string | null
  model: string | null
  style: string | null
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
  notes: string | null
  car_inspections?: CarInspection[] | null
}

type Auction = {
  id: string
  name: string
  auction_date: string
  source_type: string
}

export default function UpcomingAuctionPage() {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [cars, setCars] = useState<AuctionCar[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

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
      setMessage("Erro ao buscar o último leilão presale.")
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
        car_inspections (*)
      `)
      .eq("auction_id", latestAuction.id)
      .order("run_number", { ascending: true })

    if (carsError) {
      console.error(carsError)
      setMessage("Erro ao buscar carros do próximo leilão.")
      setLoading(false)
      return
    }

    setCars(carsData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadLatestPresaleAuction()
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

  async function updateNotes(id: string, notes: string) {
    const { error } = await supabase
      .from("auction_cars")
      .update({ notes })
      .eq("id", id)

    if (error) {
      console.error(error)
      return
    }

    setCars((prev) =>
      prev.map((car) => (car.id === id ? { ...car, notes } : car))
    )
  }

  async function upsertInspection(
    carId: string,
    updates: Partial<CarInspection>
  ) {
    const car = cars.find((item) => item.id === carId)
    const existingInspection = car?.car_inspections?.[0]

    if (existingInspection) {
      const { data, error } = await supabase
        .from("car_inspections")
        .update(updates)
        .eq("id", existingInspection.id)
        .select()
        .single()

      if (error) {
        console.error(error)
        return
      }

      setCars((prev) =>
        prev.map((item) =>
          item.id === carId
            ? { ...item, car_inspections: [data] }
            : item
        )
      )
    } else {
      const { data, error } = await supabase
        .from("car_inspections")
        .insert([
          {
            auction_car_id: carId,
            ...updates,
          },
        ])
        .select()
        .single()

      if (error) {
        console.error(error)
        return
      }

      setCars((prev) =>
        prev.map((item) =>
          item.id === carId
            ? { ...item, car_inspections: [data] }
            : item
        )
      )
    }
  }

  return (
    <div style={{ padding: 30 }}>
      <h1>Upcoming Auction</h1>

      {auction && (
        <div style={{ marginBottom: 20 }}>
          <p><strong>Auction:</strong> {auction.name}</p>
          <p><strong>Date:</strong> {auction.auction_date}</p>
          <p><strong>Total cars:</strong> {cars.length}</p>
        </div>
      )}

      {loading && <p>Loading cars...</p>}
      {message && <p>{message}</p>}

      {!loading && cars.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            border={1}
            cellPadding={6}
            style={{ borderCollapse: "collapse", minWidth: 1400 }}
          >
            <thead>
              <tr>
                <th>Run</th>
                <th>Lane</th>
                <th>Year</th>
                <th>Make</th>
                <th>Model</th>
                <th>Style</th>
                <th>Miles</th>
                <th>CR</th>
                <th>Decision</th>
                <th>Notes</th>
                <th>Overall Condition</th>
                <th>Repair Estimate</th>
                <th>Estimated Bid</th>
                <th>Min</th>
                <th>Max</th>
                <th>Fee</th>
                <th>Total Cost</th>
                <th>Confidence</th>
                <th>Suggested Max Bid</th>
              </tr>
            </thead>

            <tbody>
              {cars.map((car) => {
                const inspection = car.car_inspections?.[0]

                return (
                  <tr key={car.id}>
                    <td>{car.run_number}</td>
                    <td>{car.lane}</td>
                    <td>{car.year}</td>
                    <td>{car.make}</td>
                    <td>{car.model}</td>
                    <td>{car.style}</td>
                    <td>{car.odometer}</td>
                    <td>{car.cr}</td>

                    <td>
                      <select
                        value={car.decision || "Maybe"}
                        onChange={(e) => updateDecision(car.id, e.target.value)}
                      >
                        <option value="Target">Target</option>
                        <option value="Maybe">Maybe</option>
                        <option value="Avoid">Avoid</option>
                      </select>
                    </td>

                    <td>
                      <input
                        defaultValue={car.notes || ""}
                        onBlur={(e) => updateNotes(car.id, e.target.value)}
                        style={{ minWidth: 180 }}
                      />
                    </td>

                    <td>
                      <select
                        value={inspection?.overall_condition || ""}
                        onChange={(e) =>
                          upsertInspection(car.id, {
                            overall_condition: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Select</option>
                        <option value="poor">Poor</option>
                        <option value="ok">OK</option>
                        <option value="good">Good</option>
                        <option value="excellent">Excellent</option>
                      </select>
                    </td>

                    <td>
                      <input
                        type="number"
                        defaultValue={inspection?.repair_estimate ?? ""}
                        onBlur={(e) =>
                          upsertInspection(car.id, {
                            repair_estimate: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        style={{ width: 100 }}
                      />
                    </td>
                    <td>{car.estimated_bid ?? "-"}</td>
                    <td>{car.estimated_bid_min ?? "-"}</td>
                    <td>{car.estimated_bid_max ?? "-"}</td>
                    <td>{car.auction_fee ?? "-"}</td>
                    <td>{car.estimated_total_cost ?? "-"}</td>
                    <td>{car.confidence ?? "-"}</td>
                    <td>{car.suggested_max_bid ?? "-"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
