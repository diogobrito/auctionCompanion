"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

type AuctionCar = {
  id: string
  auction_id: string
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
}

type HistoricalSale = {
  id: string
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
  bid_price: number | null
}

function getMileageRange(mileage: number | null): string {
  if (!mileage) return "unknown"
  if (mileage < 80000) return "0-80k"
  if (mileage < 120000) return "80-120k"
  if (mileage < 160000) return "120-160k"
  if (mileage < 200000) return "160-200k"
  return "200k+"
}

function sameMileageRange(a: number | null, b: number | null) {
  return getMileageRange(a) === getMileageRange(b)
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

function getConfidence(sampleSize: number): "High" | "Medium" | "Low" {
  if (sampleSize >= 8) return "High"
  if (sampleSize >= 4) return "Medium"
  return "Low"
}

export default function CalculateEstimatesPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [processed, setProcessed] = useState(0)

  async function calculateEstimates() {
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
        .select("id, auction_id, year, make, model, odometer")
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
        if (!car.year || !car.make || !car.model) continue

        const exactMatches = (historicalSales as HistoricalSale[]).filter(
          (sale) =>
            sale.year === car.year &&
            sale.make?.toUpperCase() === car.make?.toUpperCase() &&
            sale.model?.toUpperCase() === car.model?.toUpperCase() &&
            sameMileageRange(sale.odometer, car.odometer) &&
            sale.bid_price !== null
        )

        let comps = exactMatches

        if (comps.length < 3) {
          comps = (historicalSales as HistoricalSale[]).filter(
            (sale) =>
              sale.year !== null &&
              Math.abs(sale.year - car.year!) <= 1 &&
              sale.make?.toUpperCase() === car.make?.toUpperCase() &&
              sale.model?.toUpperCase() === car.model?.toUpperCase() &&
              sameMileageRange(sale.odometer, car.odometer) &&
              sale.bid_price !== null
          )
        }

        if (comps.length < 3) {
          comps = (historicalSales as HistoricalSale[]).filter(
            (sale) =>
              sale.year !== null &&
              Math.abs(sale.year - car.year!) <= 2 &&
              sale.make?.toUpperCase() === car.make?.toUpperCase() &&
              sale.model?.toUpperCase() === car.model?.toUpperCase() &&
              sale.bid_price !== null
          )
        }

        if (comps.length < 3) {
          comps = (historicalSales as HistoricalSale[]).filter(
            (sale) =>
              sale.make?.toUpperCase() === car.make?.toUpperCase() &&
              sale.model?.toUpperCase() === car.model?.toUpperCase() &&
              sale.bid_price !== null
          )
        }

        const prices = comps
          .map((sale) => sale.bid_price)
          .filter((price): price is number => price !== null)

        const stats = calculateStats(prices)
        const confidence = getConfidence(prices.length)

        const { error: updateError } = await supabase
          .from("auction_cars")
          .update({
            estimated_bid: stats.avg,
            estimated_bid_min: stats.min,
            estimated_bid_max: stats.max,
            confidence,
          })
          .eq("id", car.id)

        if (updateError) {
          console.error("Update error for car:", car.id, updateError)
        }

        setProcessed((prev) => prev + 1)
      }

      setMessage("Estimate calculation completed.")
    } catch (error) {
      console.error(error)
      setMessage("Unexpected error while calculating estimates.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Calculate Estimates</h1>
      <p className="text-sm text-slate-600">
        This will calculate estimated bid, price range, and confidence for the
        latest presale auction.
      </p>

      <Button
        onClick={calculateEstimates}
        disabled={loading}
        variant="default"
        size="lg"
      >
        {loading ? "Calculating..." : "Run Estimate Calculation"}
      </Button>

      {processed > 0 && <p className="text-sm text-slate-700">Cars processed: {processed}</p>}
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  )
}