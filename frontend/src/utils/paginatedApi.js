export async function fetchAllPaginated(api, path, pageSize = 500) {
  const results = []
  let page = 1

  while (true) {
    const separator = path.includes('?') ? '&' : '?'
    const response = await api.get(`${path}${separator}page=${page}&page_size=${pageSize}`)
    const data = response.data
    const pageResults = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []

    results.push(...pageResults)

    if (!data?.next || pageResults.length === 0) {
      break
    }

    page += 1
  }

  return results
}

export function sortCarsForSelect(cars) {
  return [...cars].sort((left, right) => {
    const brandCmp = String(left.brand_name || '').localeCompare(String(right.brand_name || ''), undefined, { sensitivity: 'base' })
    if (brandCmp !== 0) return brandCmp

    const nameCmp = String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base' })
    if (nameCmp !== 0) return nameCmp

    return (Number(right.year_introduced) || 0) - (Number(left.year_introduced) || 0)
  })
}

export function groupCarsByBrand(cars) {
  const groups = new Map()

  sortCarsForSelect(cars).forEach((car) => {
    const brand = String(car.brand_name || '—').trim() || '—'
    if (!groups.has(brand)) {
      groups.set(brand, [])
    }
    groups.get(brand).push(car)
  })

  return Array.from(groups.entries())
}

export function formatCarSelectOptionLabel(car) {
  const parts = [
    car.name,
    car.year_introduced,
    car.engine_type,
  ].filter(Boolean)

  return parts.join(' · ')
}
