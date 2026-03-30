import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type MetricCardProps = {
  title: string
  value: string
  hint?: string
}

export function MetricCard({ title, value, hint }: MetricCardProps) {
  return (
    <Card className="overflow-hidden border-white/80 bg-white/85 text-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
      <CardHeader className="pb-1">
        <div className="mb-3 h-1.5 w-16 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" />
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight text-slate-900">{value}</div>
        {hint ? (
          <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
