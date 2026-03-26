export type ComparableAuctionCar = {
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
}

export type HistoricalComparableSale = {
  id: string
  year: number | null
  make: string | null
  model: string | null
  odometer: number | null
  bid_price: number | null
}

export function getMileageRange(mileage: number | null): string {
  if (!mileage) return "unknown"
  if (mileage < 80000) return "0-80k"
  if (mileage < 120000) return "80-120k"
  if (mileage < 160000) return "120-160k"
  if (mileage < 200000) return "160-200k"
  return "200k+"
}

export function sameMileageRange(a: number | null, b: number | null) {
  return getMileageRange(a) === getMileageRange(b)
}

export function findComparableSales(
  car: ComparableAuctionCar,
  historicalSales: HistoricalComparableSale[]
) {
  let comps: HistoricalComparableSale[] = []

  if (car.make && car.model) {
    comps = historicalSales.filter(
      (sale) =>
        sale.year === car.year &&
        sale.make?.toUpperCase() === car.make?.toUpperCase() &&
        sale.model?.toUpperCase() === car.model?.toUpperCase() &&
        sameMileageRange(sale.odometer, car.odometer) &&
        sale.bid_price !== null
    )

    if (comps.length < 3 && car.year) {
      comps = historicalSales.filter(
        (sale) =>
          sale.year === car.year &&
          sale.make?.toUpperCase() === car.make?.toUpperCase() &&
          sale.model?.toUpperCase() === car.model?.toUpperCase() &&
          sale.bid_price !== null
      )
    }

    if (comps.length < 3 && car.year) {
      comps = historicalSales.filter(
        (sale) =>
          sale.year !== null &&
          Math.abs(sale.year - car.year) <= 2 &&
          sale.make?.toUpperCase() === car.make?.toUpperCase() &&
          sale.model?.toUpperCase() === car.model?.toUpperCase() &&
          sale.bid_price !== null
      )
    }

    if (comps.length < 3) {
      comps = historicalSales.filter(
        (sale) =>
          sale.make?.toUpperCase() === car.make?.toUpperCase() &&
          sale.model?.toUpperCase() === car.model?.toUpperCase() &&
          sale.bid_price !== null
      )
    }

    if (comps.length === 0) {
      comps = historicalSales.filter(
        (sale) =>
          (sale.make?.toUpperCase() === car.make?.toUpperCase() ||
            sale.model?.toUpperCase() === car.model?.toUpperCase() ||
            sale.year === car.year) &&
          sale.bid_price !== null
      )
    }
  }

  return comps
}
