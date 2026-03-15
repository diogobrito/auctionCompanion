"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

type CarInspection = {
  overall_condition: string | null
  repair_estimate: number | null
}

type AuctionCar = {
  id: string
  lane: string | null
  estimated_bid: number | null
  car_inspections?: CarInspection[] | null
}

function getRiskBuffer(lane: string | null, overallCondition: string | null): number {
  if (lane?.toUpperCase() === "N") return 800

  if (overallCondition === "poor") return 700
  if (overallCondition === "ok") return 500
  if (overallCondition === "good") return 300
  if (overallCondition === "excellent") return 200

  return 600
}

export default function CalculateMaxBidPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [processed, setProcessed] = useState(0)

  async function calculateMaxBid() {
    setLoading(true)
    setMessage("")
    setProcessed(0)

    try {
      const { data: latestAuction, error: auctionError } = await supabase
        .from("auctions")
        .select("*")
        .eq("source_type", "presale")
        .order("auction_date", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (auctionError || !latestAuction) {
        console.error(auctionError)
        setMessage("Could not find latest presale auction.")
        setLoading(false)
        return
      }

      const { data: cars, error: carsError } = await supabase
        .from("auction_cars")
        .select(`
          id,
          lane,
          estimated_bid,
          car_inspections (
            overall_condition,
            repair_estimate
          )
        `)
        .eq("auction_id", latestAuction.id)

      if (carsError || !cars) {
        console.error(carsError)
        setMessage("Could not load auction cars.")
        setLoading(false)
        return
      }

      for (const car of cars as AuctionCar[]) {
        const inspection = car.car_inspections?.[0]
        const repairEstimate = inspection?.repair_estimate ?? 0
        const overallCondition = inspection?.overall_condition ?? null

        const riskBuffer = getRiskBuffer(car.lane, overallCondition)

        const suggestedMaxBid =
          car.estimated_bid !== null
            ? Math.max(0, car.estimated_bid - repairEstimate - riskBuffer)
            : null

        const { error: updateError } = await supabase
          .from("auction_cars")
          .update({
            suggested_max_bid: suggestedMaxBid,
          })
          .eq("id", car.id)

        if (updateError) {
          console.error("Update error for car:", car.id, updateError)
        }

        setProcessed((prev) => prev + 1)
      }

      setMessage("Suggested max bid calculation completed.")
    } catch (error) {
      console.error(error)
      setMessage("Unexpected error while calculating suggested max bid.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Calculate Suggested Max Bid</h1>
      <p className="text-sm text-slate-600">
        This will calculate the suggested max bid for the latest presale auction.
      </p>

      <Button
        onClick={calculateMaxBid}
        disabled={loading}
        variant="default"
        size="lg"
      >
        {loading ? "Calculating..." : "Run Max Bid Calculation"}
      </Button>

      {processed > 0 && <p className="text-sm text-slate-700">Cars processed: {processed}</p>}
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  )
}
