"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function UpcomingAuction() {
  const [cars, setCars] = useState([])

  async function loadCars() {
    const { data, error } = await supabase
      .from("auction_cars")
      .select("*")
      .order("run_number", { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setCars(data)
  }

  useEffect(() => {
    loadCars()
    async function updateDecision(id: string, decision: string) {
  const { error } = await supabase
    .from("auction_cars")
    .update({ decision })
    .eq("id", id)

  if (error) console.error(error)
}

async function updateNotes(id: string, notes: string) {
  const { error } = await supabase
    .from("auction_cars")
    .update({ notes })
    .eq("id", id)

  if (error) console.error(error)
}

  }, [])

  return (
    <div style={{ padding: 30 }}>
      <h1>Upcoming Auction</h1>

      <table border={1} cellPadding={6}>
        <thead>
          <tr>
            <th>Run</th>
            <th>Lane</th>
            <th>Year</th>
            <th>Make</th>
            <th>Model</th>
            <th>Miles</th>
            <th>Decision</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {cars.map((car: any) => (
            <tr key={car.id}>
              <td>{car.run_number}</td>
              <td>{car.lane}</td>
              <td>{car.year}</td>
              <td>{car.make}</td>
              <td>{car.model}</td>
              <td>{car.odometer}</td>

              <td>
                <select
                  value={car.decision || "Maybe"}
                  onChange={(e) =>
                    updateDecision(car.id, e.target.value)
                  }
                >
                  <option>Target</option>
                  <option>Maybe</option>
                  <option>Avoid</option>
                </select>
              </td>

              <td>
                <input
                  defaultValue={car.notes || ""}
                  onBlur={(e) =>
                    updateNotes(car.id, e.target.value)
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
