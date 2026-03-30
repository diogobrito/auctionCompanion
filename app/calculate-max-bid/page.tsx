"use client"

import { useState } from "react"
import { BadgeDollarSign, ShieldCheck, Sparkles } from "lucide-react"
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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="rounded-[30px] border border-white/80 bg-white/86 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 text-white shadow-lg shadow-amber-200/60">
            <BadgeDollarSign className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bidding</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calculate Suggested Max Bid</h1>
            <p className="text-sm leading-6 text-slate-600">
              Generate a safer max bid for the latest presale auction using lane risk and inspection condition.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/80 bg-white/86 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-200/60">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Run max bid calculation</p>
              <p className="text-xs text-slate-500">Applies condition-based risk buffers before saving the suggested max bid.</p>
            </div>
          </div>

          <Button onClick={calculateMaxBid} disabled={loading} variant="default" size="lg">
            <Sparkles className="h-4 w-4" />
            {loading ? "Calculating..." : "Run Max Bid Calculation"}
          </Button>
        </div>

        {processed > 0 && <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Cars processed: {processed}</p>}
        {message && <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
      </section>
    </div>
  )
}
