"use client"

import { useState } from "react"
import { Cog, ListChecks, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { findComparableSales } from "@/lib/historical-comparables"

type AuctionCar = {
  id: string
  auction_id: string
  lane: string | null
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
  estimated_bid: number | null
  car_inspections?: {
    overall_condition: string | null
    repair_estimate: number | null
  }[] | null
}

type HistoricalSale = {
  id: string
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
  bid_price: number | null
}

function calculateStats(prices: number[]) {
  if (!prices.length) {
    return {
      avg: null,
      min: null,
      max: null,
    }
  }

  const sorted = [...prices].sort((a, b) => a - b)
  const total = prices.reduce((sum, price) => sum + price, 0)

  return {
    avg: Math.round(total / prices.length),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

function getConfidence(sampleSize: number): "High" | "Medium" | null {
  if (sampleSize >= 8) return "High"
  if (sampleSize >= 4) return "Medium"
  return null
}

function calculateAuctionFee(estimatedBid: number | null): number | null {
  if (!estimatedBid) return null

  if (estimatedBid <= 1000) return 250
  if (estimatedBid <= 2000) return 350
  if (estimatedBid <= 3000) return 450
  if (estimatedBid <= 4000) return 550
  if (estimatedBid <= 5000) return 650
  return 750
}

function getRiskBuffer(lane: string | null, overallCondition: string | null): number {
  if (lane?.toUpperCase() === "N") return 800

  if (overallCondition === "poor") return 700
  if (overallCondition === "ok") return 500
  if (overallCondition === "good") return 300
  if (overallCondition === "excellent") return 200

  return 600
}

export default function RunPipelinePage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [processed, setProcessed] = useState(0)

  async function runPipeline() {
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
          auction_id,
          lane,
          year,
          make,
          model,
          odometer,
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

      const { data: historicalSales, error: historicalError } = await supabase
        .from("historical_sales")
        .select("id, year, make, model, odometer, bid_price")

      if (historicalError || !historicalSales) {
        console.error(historicalError)
        setMessage("Could not load historical sales.")
        setLoading(false)
        return
      }

      for (const car of cars as AuctionCar[]) {
        let estimatedBid: number | null = null
        let estimatedBidMin: number | null = null
        let estimatedBidMax: number | null = null
        let confidence: "High" | "Medium" | null = null

        const comps = findComparableSales(car, historicalSales as HistoricalSale[])

        const prices = comps
          .map((sale) => sale.bid_price)
          .filter((price): price is number => price !== null)

          const stats = calculateStats(prices)
          estimatedBid = stats.avg
          estimatedBidMin = stats.min
          estimatedBidMax = stats.max
          confidence = getConfidence(prices.length)

        const auctionFee = calculateAuctionFee(estimatedBid)
        const estimatedTotalCost =
          estimatedBid !== null && auctionFee !== null
            ? estimatedBid + auctionFee
            : null

        const inspection = car.car_inspections?.[0]
        const repairEstimate = inspection?.repair_estimate ?? 0
        const overallCondition = inspection?.overall_condition ?? null
        const riskBuffer = getRiskBuffer(car.lane, overallCondition)

        const suggestedMaxBid =
          estimatedBid !== null
            ? Math.max(0, estimatedBid - repairEstimate - riskBuffer)
            : null

        const laneDecision = car.lane?.toUpperCase() === "N" ? "Avoid" : undefined

        const updatePayload = {
          estimated_bid: estimatedBid,
          estimated_bid_min: estimatedBidMin,
          estimated_bid_max: estimatedBidMax,
          confidence,
          auction_fee: auctionFee,
          estimated_total_cost: estimatedTotalCost,
          suggested_max_bid: suggestedMaxBid,
          ...(laneDecision ? { decision: laneDecision } : {}),
        }

        const { error: updateError } = await supabase
          .from("auction_cars")
          .update(updatePayload)
          .eq("id", car.id)

        // Supabase can sometimes provide an empty error object; só trate como erro quando há conteúdo.
        if (updateError && Object.keys(updateError).length > 0) {
          console.error("Update error for car:", car.id, updateError)
          setMessage((prev) => `${prev} Error updating car ${car.id}.`)
        } else if (updateError) {
          console.warn("Update call responded with empty error for car:", car.id, updateError)
        }

        setProcessed((prev) => prev + 1)
      }

      setMessage("Pipeline completed successfully.")
    } catch (error) {
      console.error(error)
      setMessage("Unexpected error while running pipeline.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="rounded-[30px] border border-white/80 bg-white/86 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-sky-700 to-emerald-500 text-white shadow-lg shadow-sky-200/60">
            <Cog className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pipeline</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Run Auction Pipeline</h1>
            <p className="mt-2 text-sm text-slate-600">Process the latest presale auction and calculate all key decision metrics in one run.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/80 bg-white/86 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
      <p className="mb-4 text-sm text-slate-600">This will process the latest presale auction and calculate:</p>

      <ul className="list-disc pl-5 text-sm text-slate-600">
        <li>Estimated bid</li>
        <li>Bid range</li>
        <li>Confidence</li>
        <li>Auction fee</li>
        <li>Estimated total cost</li>
        <li>Suggested max bid</li>
      </ul>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-200/60">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Full workflow</p>
            <p className="text-xs text-slate-500">Estimate, fees, confidence, and max bid in a single pass.</p>
          </div>
        </div>

        <Button onClick={runPipeline} disabled={loading} variant="default" size="lg">
          <Sparkles className="h-4 w-4" />
          {loading ? "Running pipeline..." : "Run Full Pipeline"}
        </Button>
      </div>

      {processed > 0 && <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Cars processed: {processed}</p>}
      {message && <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
      </section>
    </div>
  )
}
