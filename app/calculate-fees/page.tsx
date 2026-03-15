"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

type AuctionCar = {
  id: string
  estimated_bid: number | null
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

export default function CalculateFeesPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [processed, setProcessed] = useState(0)

  async function calculateFees() {
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
        .select("id, estimated_bid")
        .eq("auction_id", latestAuction.id)

      if (carsError || !cars) {
        console.error(carsError)
        setMessage("Could not load auction cars.")
        setLoading(false)
        return
      }

      for (const car of cars as AuctionCar[]) {
        const fee = calculateAuctionFee(car.estimated_bid)
        const totalCost =
          car.estimated_bid !== null && fee !== null
            ? car.estimated_bid + fee
            : null

        const { error: updateError } = await supabase
          .from("auction_cars")
          .update({
            auction_fee: fee,
            estimated_total_cost: totalCost,
          })
          .eq("id", car.id)

        if (updateError) {
          console.error("Update error for car:", car.id, updateError)
        }

        setProcessed((prev) => prev + 1)
      }

      setMessage("Fee calculation completed.")
    } catch (error) {
      console.error(error)
      setMessage("Unexpected error while calculating fees.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Calculate Fees</h1>
      <p className="text-sm text-slate-600">
        This will calculate auction fee and estimated total cost for the latest
        presale auction.
      </p>

      <Button
        onClick={calculateFees}
        disabled={loading}
        variant="default"
        size="lg"
      >
        {loading ? "Calculating..." : "Run Fee Calculation"}
      </Button>

      {processed > 0 && <p className="text-sm text-slate-700">Cars processed: {processed}</p>}
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  )
}