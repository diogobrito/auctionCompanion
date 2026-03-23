"use client"

import { useState } from "react"
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
            setMessage("CSV vazio ou sem linhas válidas.")
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
              "Nenhuma linha válida encontrada. Verifique Stock, Sale Date, Year, Make, Model e Price."
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
            setMessage("Nenhum Stock válido encontrado para verificar duplicados.")
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

                console.error("Erro ao verificar duplicados por Stock:", existingError)
                setMessage("Erro ao verificar duplicados: " + effectiveErrorMessage)
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
            setMessage("Todos os carros desse arquivo já existem na base.")
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
            setMessage("Erro ao criar registro do leilão histórico.")
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
              setMessage("Erro ao inserir histórico: " + effectiveInsertErrorMessage)
              setLoading(false)
              return
            }
          }

          setStats({
            read: rows.length,
            existing: validRows.length - rowsToInsert.length,
            inserted: rowsToInsert.length,
          })
          setMessage("Importação do histórico concluída com sucesso.")
        } catch (err) {
          console.error(err)
          setMessage("Erro inesperado ao importar histórico.")
        } finally {
          setLoading(false)
        }
      },
      error: (error) => {
        console.error(error)
        setMessage("Erro ao ler o CSV.")
        setLoading(false)
      },
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Import Historical Auction</h1>
      <p className="text-sm text-slate-600">
        Importe os CSVs dos leilões passados. O sistema verifica duplicados antes
        de inserir.
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Data manual do leilão (opcional)</label>
        <input
          type="date"
          value={manualAuctionDate}
          onChange={(e) => setManualAuctionDate(e.target.value)}
          className="w-full rounded-md border border-slate-300 p-2 text-sm"
        />
        <p className="text-xs text-slate-500">
          Use isso se o CSV não tiver a coluna Sale Date ou se quiser forçar a
          data do leilão.
        </p>
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

      {loading && <p className="mt-4 text-sm text-slate-600">Importando histórico...</p>}

      {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}

      {stats && (
        <div className="mt-5 space-y-1 text-sm font-medium text-slate-700">
          <p>Linhas lidas: {stats.read}</p>
          <p>Já existentes: {stats.existing}</p>
          <p>Inseridas: {stats.inserted}</p>
        </div>
      )}
    </div>
  )
}
