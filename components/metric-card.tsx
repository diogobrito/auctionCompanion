import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type MetricCardProps = {
  title: string
  value: string
  hint?: string
}

export function MetricCard({ title, value, hint }: MetricCardProps) {
  return (
    <Card className="border-slate-200 bg-white text-slate-900 shadow-sm transition hover:shadow-md">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight text-slate-900">{value}</div>
        {hint ? (
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
