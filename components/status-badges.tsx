import { Badge } from "@/components/ui/badge"

export function DecisionBadge({ value }: { value: string | null }) {
  if (value === "Target") {
    return <Badge className="bg-green-600 hover:bg-green-600">Target</Badge>
  }

  if (value === "Avoid") {
    return <Badge variant="destructive">Avoid</Badge>
  }

  return <Badge variant="secondary">Maybe</Badge>
}

export function ConfidenceBadge({ value }: { value: string | null }) {
  if (value === "High") {
    return <Badge className="bg-blue-600 hover:bg-blue-600">High</Badge>
  }

  if (value === "Medium") {
    return <Badge className="bg-amber-500 hover:bg-amber-500">Medium</Badge>
  }

  return <Badge variant="outline">Low</Badge>
}

export function ConditionBadge({ value }: { value: string | null }) {
  if (value === "excellent") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Excellent</Badge>
  }

  if (value === "good") {
    return <Badge className="bg-green-600 hover:bg-green-600">Good</Badge>
  }

  if (value === "ok") {
    return <Badge className="bg-amber-500 hover:bg-amber-500">OK</Badge>
  }

  if (value === "poor") {
    return <Badge variant="destructive">Poor</Badge>
  }

  return <Badge variant="outline">Unknown</Badge>
}
