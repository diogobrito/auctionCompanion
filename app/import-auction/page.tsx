"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import Papa from "papaparse"
import { supabase } from "@/lib/supabase"

type CsvRow = {
  [key: string]: string
}

type AuctionSummary = {
  id: string
  name: string
  auction_date: string
}

function parseNumber(value: string | undefined | null): number | null {
  if (!value) return null
  const cleaned = String(value).replace(/[^0-9.-]/g, "").trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

function normalizeText(value: string | undefined | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export default function ImportAuctionPage() {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState("")
  const [previewCount, setPreviewCount] = useState(0)
  const [currentAuction, setCurrentAuction] = useState<AuctionSummary | null>(null)
  const [currentAuctionCars, setCurrentAuctionCars] = useState(0)
  const [auctionDate, setAuctionDate] = useState(() => new Date().toISOString().slice(0, 10))

  async function loadCurrentAuction() {
    const { data: latestAuction, error: auctionError } = await supabase
      .from("auctions")
      .select("id, name, auction_date")
      .eq("source_type", "presale")
      .order("auction_date", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (auctionError) {
      console.error(auctionError)
      return
    }

    if (!latestAuction) {
      setCurrentAuction(null)
      setCurrentAuctionCars(0)
      return
    }

    setCurrentAuction(latestAuction)

    const { count, error: carsError } = await supabase
      .from("auction_cars")
      .select("id", { count: "exact", head: true })
      .eq("auction_id", latestAuction.id)

    if (carsError) {
      console.error(carsError)
      setCurrentAuctionCars(0)
      return
    }

    setCurrentAuctionCars(count ?? 0)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCurrentAuction()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  async function handleDeleteCurrentAuction() {
    if (!currentAuction) return

    const confirmed = window.confirm(
      `Delete the current auction "${currentAuction.name}" and all imported vehicles?`
    )

    if (!confirmed) return

    setDeleting(true)
    setMessage("")

    try {
      const { data: auctionCars, error: auctionCarsError } = await supabase
        .from("auction_cars")
        .select("id")
        .eq("auction_id", currentAuction.id)

      if (auctionCarsError) {
        console.error(auctionCarsError)
        setMessage("Error locating cars from the current auction.")
        setDeleting(false)
        return
      }

      const auctionCarIds = (auctionCars ?? []).map((car) => car.id)

      if (auctionCarIds.length) {
        const { error: inspectionsError } = await supabase
          .from("car_inspections")
          .delete()
          .in("auction_car_id", auctionCarIds)

        if (inspectionsError) {
          console.error(inspectionsError)
          setMessage("Error deleting inspections from the current auction.")
          setDeleting(false)
          return
        }
      }

      const { error: deleteCarsError } = await supabase
        .from("auction_cars")
        .delete()
        .eq("auction_id", currentAuction.id)

      if (deleteCarsError) {
        console.error(deleteCarsError)
        setMessage("Error deleting vehicles from the current auction.")
        setDeleting(false)
        return
      }

      const { error: deleteAuctionError } = await supabase
        .from("auctions")
        .delete()
        .eq("id", currentAuction.id)

      if (deleteAuctionError) {
        console.error(deleteAuctionError)
        setMessage("Error deleting the current auction.")
        setDeleting(false)
        return
      }

      setCurrentAuction(null)
      setCurrentAuctionCars(0)
      setPreviewCount(0)
      setMessage("Current auction deleted successfully. You can now import another CSV.")
    } catch (error) {
      console.error(error)
      setMessage("Unexpected error while deleting the current auction.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleFileUpload(file: File) {
    setLoading(true)
    setMessage("")
    setPreviewCount(0)

    if (!auctionDate) {
      setMessage("Enter the auction date before importing the CSV.")
      setLoading(false)
      return
    }

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data
          setPreviewCount(rows.length)

          if (!rows.length) {
            setMessage("CSV is empty or has no valid rows.")
            setLoading(false)
            return
          }

          const { data: auctionData, error: auctionError } = await supabase
            .from("auctions")
            .insert([
              {
                name: `Upcoming Auction ${auctionDate}`,
                auction_date: auctionDate,
                source_type: "presale",
              },
            ])
            .select()
            .single()

          if (auctionError || !auctionData) {
            console.error(auctionError)
            setMessage("Error creating auction record.")
            setLoading(false)
            return
          }

          const carsToInsert = rows.map((row) => ({
            auction_id: auctionData.id,
            run_number:
              normalizeText(row["Run Number"]) ??
              normalizeText(row["Run#"]) ??
              normalizeText(row["Run"]),
            lane: normalizeText(row["Lane"]),
            vin:
              normalizeText(row["VIN"]) ??
              normalizeText(row["Vin"]) ??
              normalizeText(row["vin"]),
            year: parseNumber(row["Year"]),
            make: normalizeText(row["Make"]),
            model: normalizeText(row["Model"]),
            style:
              normalizeText(row["Style"]) ??
              normalizeText(row["Body Style"]) ??
              normalizeText(row["Trim"]),
            odometer:
              parseNumber(row["Odometer"]) ??
              parseNumber(row["Miles"]) ??
              parseNumber(row["Mileage"]),
            color: normalizeText(row["Color"]),
            cr:
              parseNumber(row["CR"]) ??
              parseNumber(row["Condition Report"]) ??
              parseNumber(row["Grade"]),
            decision: "Maybe",
            notes: null,
          }))

          const { error: carsError } = await supabase
            .from("auction_cars")
            .insert(carsToInsert)

          if (carsError) {
            console.error(carsError)
            setMessage("Error inserting cars into the database.")
            setLoading(false)
            return
          }

          setMessage(`Import completed successfully: ${carsToInsert.length} cars.`)
          await loadCurrentAuction()
        } catch (err) {
          console.error(err)
          setMessage("Unexpected error while importing the file.")
        } finally {
          setLoading(false)
        }
      },
      error: (error) => {
        console.error(error)
        setMessage("Error reading CSV.")
        setLoading(false)
      },
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Import Upcoming Auction</h1>
      <p className="text-sm text-slate-600">Select the next auction CSV to import the cars.</p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 space-y-2">
          <label htmlFor="auction-date" className="text-sm font-semibold text-slate-900">
            Auction date
          </label>
          <input
            id="auction-date"
            type="date"
            value={auctionDate}
            onChange={(event) => setAuctionDate(event.target.value)}
            className="block w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-700"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Current auction</p>
            {currentAuction ? (
              <>
                <p className="text-sm text-slate-700">
                  {currentAuction.name} • {currentAuction.auction_date}
                </p>
                <p className="text-xs text-slate-500">
                  {currentAuctionCars} vehicles linked to this auction.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">No active presale auction at the moment.</p>
            )}
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDeleteCurrentAuction()}
            disabled={!currentAuction || deleting || loading}
          >
            {deleting ? "Deleting..." : "Delete current auction"}
          </Button>
        </div>
      </div>

      <input
        type="file"
        accept=".csv"
        className="block w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-700"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file)
        }}
      />

      {loading && <p className="text-sm text-slate-600">Importing file...</p>}
      {!!previewCount && !loading && <p className="text-sm text-slate-600">Rows read: {previewCount}</p>}
      {!!message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  )
}
