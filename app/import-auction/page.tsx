"use client"

import { useState } from "react"
import Papa from "papaparse"
import { supabase } from "@/lib/supabase"

type CsvRow = {
  [key: string]: string
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
  const [message, setMessage] = useState("")
  const [previewCount, setPreviewCount] = useState(0)

  async function handleFileUpload(file: File) {
    setLoading(true)
    setMessage("")
    setPreviewCount(0)

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data
          setPreviewCount(rows.length)

          if (!rows.length) {
            setMessage("CSV vazio ou sem linhas válidas.")
            setLoading(false)
            return
          }

          const auctionDate = new Date().toISOString().slice(0, 10)

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
            setMessage("Erro ao criar registro do leilão.")
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
            setMessage("Erro ao inserir carros no banco.")
            setLoading(false)
            return
          }

          setMessage(`Importação concluída com sucesso: ${carsToInsert.length} carros.`)
        } catch (err) {
          console.error(err)
          setMessage("Erro inesperado ao importar arquivo.")
        } finally {
          setLoading(false)
        }
      },
      error: (error) => {
        console.error(error)
        setMessage("Erro ao ler CSV.")
        setLoading(false)
      },
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Import Upcoming Auction</h1>
      <p className="text-sm text-slate-600">Selecione o CSV do próximo leilão para importar os carros.</p>

      <input
        type="file"
        accept=".csv"
        className="block w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-700"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file)
        }}
      />

      {loading && <p className="text-sm text-slate-600">Importando arquivo...</p>}
      {!!previewCount && !loading && <p className="text-sm text-slate-600">Linhas lidas: {previewCount}</p>}
      {!!message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  )
}
