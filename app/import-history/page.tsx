"use client"

import { useState } from "react"
import { CalendarRange, History, UploadCloud } from "lucide-react"
import Papa from "papaparse"
import { supabase } from "@/lib/supabase"

type CsvRow = {
  [key: string]: string
}

function normalizeText(value: string | undefined | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function normalizeUpper(value: string | undefined | null): string {
  return (value ?? "").trim().toUpperCase()
}

function parseNumber(value: string | undefined | null): number | null {
  if (!value) return null
  const cleaned = String(value).replace(/[^0-9.-]/g, "").trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

function parseDate(value: string | undefined | null): string | null {
  if (!value) return null
  const trimmed = value.trim()

  // já está em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // tenta MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) {
    const [, mm, dd, yyyy] = usMatch
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
  }

  return null
}

function buildFingerprint(params: {
  auctionDate: string | null
  runNumber: string | null
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
  bidPrice: number | null
}) {
  return [
    params.auctionDate ?? "",
    normalizeUpper(params.runNumber),
    params.year ?? "",
    normalizeUpper(params.make),
    normalizeUpper(params.model),
    params.odometer ?? "",
    params.bidPrice ?? "",
  ].join("|")
}

function isEmptySupabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  // Se for um erro com mensagem em branco ou sem propriedades enumeráveis
  const errorObj = error as Record<string, unknown>
  const message =
    typeof (errorObj as { message?: unknown }).message === "string"
      ? String((errorObj as { message?: unknown }).message).trim()
      : ""

  const stringified = (() => {
    try {
      return JSON.stringify(errorObj)
    } catch {
      return ""
    }
  })()

  return (
    Object.keys(errorObj).length === 0 ||
    message === "" ||
    stringified === "{}" ||
    stringified === ""
  )
}

export default function ImportHistoryPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [stats, setStats] = useState<{
    read: number
    existing: number
    inserted: number
  } | null>(null)
  const [manualAuctionDate, setManualAuctionDate] = useState("")

  async function handleFileUpload(file: File) {
    setLoading(true)
    setMessage("")
    setStats(null)

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data

          if (!rows.length) {
            setMessage("CSV is empty or has no valid rows.")
            setLoading(false)
            return
          }

          const mappedRows = rows.map((row) => {
            const auctionDate =
              parseDate(manualAuctionDate) ||
              parseDate(row["Sale Date"]) ||
              parseDate(row["Auction Date"]) ||
              null

            const stock =
              normalizeText(row["Stock"]) ||
              normalizeText(row["STOCK"]) ||
              normalizeText(row["Stock #"]) ||
              normalizeText(row["Stock#"])

            const runNumber =
              normalizeText(row["Run Number"]) ||
              normalizeText(row["Run#"]) ||
              normalizeText(row["Run"])

            const year = parseNumber(row["Year"])
            const make = normalizeText(row["Make"])
            const model = normalizeText(row["Model"])
            const style =
              normalizeText(row["Style"]) ||
              normalizeText(row["Body Style"]) ||
              normalizeText(row["Trim"])

            const odometer =
              parseNumber(row["Odometer"]) ||
              parseNumber(row["Mileage"]) ||
              parseNumber(row["Miles"])

            const color = normalizeText(row["Color"])
            const lane = normalizeText(row["Lane"])

            const cr =
              parseNumber(row["CR"]) ||
              parseNumber(row["Condition Report"])

            const grade = parseNumber(row["Grade"])
            const bidPrice =
              parseNumber(row["Price"]) ||
              parseNumber(row["Bid Price"]) ||
              parseNumber(row["Sale Price"])

            const fingerprint = buildFingerprint({
              auctionDate,
              runNumber,
              year,
              make,
              model,
              odometer,
              bidPrice,
            })

            return {
              auction_date: auctionDate,
              stock,
              run_number: runNumber,
              lane,
              year,
              make,
              model,
              style,
              odometer,
              color,
              cr,
              grade,
              bid_price: bidPrice,
              import_fingerprint: fingerprint,
            }
          })

          const validRows = mappedRows.filter(
            (row) =>
              row.stock &&
              row.auction_date &&
              row.year &&
              row.make &&
              row.model &&
              row.bid_price !== null
          )

          if (!validRows.length) {
            setMessage(
              "No valid rows found. Check Stock, Sale Date, Year, Make, Model, and Price."
            )
            setLoading(false)
            return
          }

          const stocks = Array.from(
            new Set(
              validRows
                .map((row) => row.stock)
                .filter((stock): stock is string => typeof stock === "string" && stock.length > 0)
            )
          )

          if (!stocks.length) {
            setMessage("No valid Stock found to check duplicates.")
            setLoading(false)
            return
          }

          const existingSet = new Set<string>()
          const chunkSize = 1000

          for (let i = 0; i < stocks.length; i += chunkSize) {
            const chunk = stocks.slice(i, i + chunkSize)
            const { data: existingRows, error: existingError } = await supabase
              .from("historical_sales")
              .select("stock")
              .in("stock", chunk)

            if (existingError) {
              if (isEmptySupabaseError(existingError)) {
                console.warn("Erro ao verificar duplicados retornou objeto vazio para chunk", chunk, existingError)
              } else {
                const existingErrorMessage =
                  (existingError as { message?: unknown }).message ?? ""
                const effectiveErrorMessage = String(existingErrorMessage).trim() ||
                  (JSON.stringify(existingError) || "")

                console.error("Error checking duplicates by Stock:", existingError)
                setMessage("Error checking duplicates: " + effectiveErrorMessage)
              }

              // Continua sem filtro de duplicados, para não bloquear a importação.
              continue
            }

            const existingRowsArray = Array.isArray(existingRows) ? existingRows : []
            for (const row of existingRowsArray) {
              if (typeof row?.stock === "string" && row.stock.length > 0) {
                existingSet.add(row.stock)
              }
            }
          }

          let rowsToInsert = validRows.filter(
            (row) => row.stock && !existingSet.has(row.stock)
          )

          // Deduplica carros do mesmo arquivo antes da inserção usando Stock como identificador único.
          const deduped = new Map<string, typeof rowsToInsert[number]>()
          for (const row of rowsToInsert) {
            if (row.stock && !deduped.has(row.stock)) {
              deduped.set(row.stock, row)
            }
          }
          rowsToInsert = Array.from(deduped.values())

          if (!rowsToInsert.length) {
            setStats({
              read: rows.length,
              existing: validRows.length,
              inserted: 0,
            })
            setMessage("All cars from this file already exist in the database.")
            setLoading(false)
            return
          }

          const auctionDateForRecord =
            rowsToInsert[0].auction_date || new Date().toISOString().slice(0, 10)

          const { data: auctionData, error: auctionError } = await supabase
            .from("auctions")
            .insert([
              {
                name: `Historical Auction ${auctionDateForRecord}`,
                auction_date: auctionDateForRecord,
                source_type: "historical",
              },
            ])
            .select()
            .single()

          if (auctionError || !auctionData) {
            console.error(auctionError)
            setMessage("Error creating historical auction record.")
            setLoading(false)
            return
          }

          const payload = rowsToInsert.map((row) => ({
            auction_id: auctionData.id,
            ...row,
          }))

          const { error: insertError } = await supabase
            .from("historical_sales")
            .upsert(payload, { onConflict: "stock" })

          if (insertError) {
            if (isEmptySupabaseError(insertError)) {
              console.warn("Erro ao inserir histórico retornou objeto vazio", insertError)
            } else {
              const insertErrorMessage =
                (insertError as { message?: unknown }).message ?? ""
              const effectiveInsertErrorMessage = String(insertErrorMessage).trim() ||
                JSON.stringify(insertError)

              console.error(insertError)
              setMessage("Error inserting history: " + effectiveInsertErrorMessage)
              setLoading(false)
              return
            }
          }

          setStats({
            read: rows.length,
            existing: validRows.length - rowsToInsert.length,
            inserted: rowsToInsert.length,
          })
          setMessage("Historical import completed successfully.")
        } catch (err) {
          console.error(err)
          setMessage("Unexpected error while importing history.")
        } finally {
          setLoading(false)
        }
      },
      error: (error) => {
        console.error(error)
        setMessage("Error reading the CSV.")
        setLoading(false)
      },
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <section className="rounded-[30px] border border-white/80 bg-white/86 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-400 text-white shadow-lg shadow-fuchsia-200/60">
            <History className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Import</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Import Historical Auction</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Import CSVs from past auctions. The system checks for duplicates before inserting.</p>
          </div>
        </div>
      </section>

      <div className="rounded-[30px] border border-white/80 bg-white/86 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <CalendarRange className="h-4 w-4 text-slate-500" />
            Manual auction date (optional)
          </label>
          <input
            type="date"
            value={manualAuctionDate}
            onChange={(e) => setManualAuctionDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
          />
          <p className="text-xs text-slate-500">
            Use this if the CSV does not have the Sale Date column or if you want to force the auction date.
          </p>
        </div>
      </div>

      <div className="rounded-[30px] border border-dashed border-slate-300 bg-white/70 p-5 text-center shadow-sm">
        <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-medium text-slate-700">Choose a CSV file to import historical auction data.</p>
        <input
          type="file"
          accept=".csv"
          className="mt-4 block w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-700"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file)
          }}
        />
      </div>

      {loading && <p className="rounded-2xl bg-white/80 p-4 text-sm text-slate-600 shadow-sm">Importing history...</p>}
      {message && <p className="rounded-2xl bg-white/80 p-4 text-sm text-slate-600 shadow-sm">{message}</p>}
      {stats && (
        <div className="rounded-[28px] border border-white/80 bg-white/86 p-5 text-sm font-medium text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
          <p>Rows read: {stats.read}</p>
          <p>Already existing: {stats.existing}</p>
          <p>Inserted: {stats.inserted}</p>
        </div>
      )}
    </div>
  )
}
