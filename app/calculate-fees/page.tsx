"use client"

import { useState } from "react"
import { Calculator, Coins, Sparkles } from "lucide-react"
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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="rounded-[30px] border border-white/80 bg-white/86 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-200/60">
            <Coins className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Automation</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calculate Fees</h1>
            <p className="text-sm leading-6 text-slate-600">
              Calculate auction fee and estimated total cost for the latest presale auction.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/80 bg-white/86 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-200/60">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Run fee calculation</p>
              <p className="text-xs text-slate-500">Updates auction fee and total cost for every car in the latest auction.</p>
            </div>
          </div>

          <Button onClick={calculateFees} disabled={loading} variant="default" size="lg">
            <Sparkles className="h-4 w-4" />
            {loading ? "Calculating..." : "Run Fee Calculation"}
          </Button>
        </div>

        {processed > 0 && <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Cars processed: {processed}</p>}
        {message && <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
      </section>
    </div>
  )
}
