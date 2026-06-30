const parseIntOrNull = (value) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

const parseFloatOrNull = (value) => {
  const parsed = Number.parseFloat(String(value || '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

const parsePriceRange = (car) => {
  const priceMin = Number.parseFloat(String(car.price_min || ''))
  const priceMax = Number.parseFloat(String(car.price_max || ''))
  return {
    min: Number.isFinite(priceMin) ? priceMin : null,
    max: Number.isFinite(priceMax) ? priceMax : null,
  }
}

export function parseCatalogSearchParams(searchParams) {
  const get = (key) => String(searchParams.get(key) || '').trim()
  return {
    modelSearch: get('model'),
    yearSearch: get('year'),
    keywordSearch: get('q'),
    engineSearch: get('engine'),
    vehicleTypeFilter: get('type') || 'all',
    statusFilter: get('status') || 'all',
    yearFrom: get('year_from'),
    yearTo: get('year_to'),
    horsepowerFrom: get('hp_from'),
    horsepowerTo: get('hp_to'),
    topSpeedFrom: get('speed_from'),
    topSpeedTo: get('speed_to'),
    fuelConsumptionSearch: get('fuel'),
    priceFrom: get('price_from'),
    priceTo: get('price_to'),
  }
}

export function catalogFiltersToSearchParams(filters) {
  const params = new URLSearchParams()
  const set = (key, value) => {
    const normalized = String(value ?? '').trim()
    if (!normalized || normalized === 'all') return
    params.set(key, normalized)
  }

  set('model', filters.modelSearch)
  set('year', filters.yearSearch)
  set('q', filters.keywordSearch)
  set('engine', filters.engineSearch)
  set('type', filters.vehicleTypeFilter)
  set('status', filters.statusFilter)
  set('year_from', filters.yearFrom)
  set('year_to', filters.yearTo)
  set('hp_from', filters.horsepowerFrom)
  set('hp_to', filters.horsepowerTo)
  set('speed_from', filters.topSpeedFrom)
  set('speed_to', filters.topSpeedTo)
  set('fuel', filters.fuelConsumptionSearch)
  set('price_from', filters.priceFrom)
  set('price_to', filters.priceTo)

  return params
}

export function buildCatalogSearchPath(selectedBrand, brandCatalog, filters) {
  const params = catalogFiltersToSearchParams(filters)
  const query = params.toString()

  if (selectedBrand && selectedBrand !== 'all') {
    const brand = (brandCatalog || []).find((entry) => entry.name === selectedBrand)
    if (brand?.slug) {
      return `/cars/brands/${brand.slug}${query ? `?${query}` : ''}`
    }
  }

  return `/cars${query ? `?${query}` : ''}`
}

export function filterCarsForCatalogSearch(cars, filters, { brandName } = {}) {
  const normalizedModel = String(filters.modelSearch || '').trim().toLowerCase()
  const normalizedKeyword = String(filters.keywordSearch || '').trim().toLowerCase()
  const normalizedEngine = String(filters.engineSearch || '').trim().toLowerCase()
  const normalizedFuelConsumption = String(filters.fuelConsumptionSearch || '').trim().toLowerCase()
  const parsedYearExact = parseIntOrNull(filters.yearSearch)
  const parsedYearFrom = parseIntOrNull(filters.yearFrom)
  const parsedYearTo = parseIntOrNull(filters.yearTo)
  const parsedHorsepowerFrom = parseIntOrNull(filters.horsepowerFrom)
  const parsedHorsepowerTo = parseIntOrNull(filters.horsepowerTo)
  const parsedTopSpeedFrom = parseIntOrNull(filters.topSpeedFrom)
  const parsedTopSpeedTo = parseIntOrNull(filters.topSpeedTo)
  const parsedPriceFrom = parseIntOrNull(filters.priceFrom)
  const parsedPriceTo = parseIntOrNull(filters.priceTo)

  return (cars || []).filter((car) => {
    if (brandName && String(car.brand_name || '') !== brandName) return false

    if (normalizedModel && !String(car.name || '').toLowerCase().includes(normalizedModel)) return false

    const haystack = `${car.brand_name || ''} ${car.name || ''} ${car.description || ''} ${car.engine_type || ''} ${car.price_range_display || ''}`.toLowerCase()
    if (normalizedKeyword && !haystack.includes(normalizedKeyword)) return false
    if (normalizedEngine && !String(car.engine_type || '').toLowerCase().includes(normalizedEngine)) return false
    if (filters.vehicleTypeFilter && filters.vehicleTypeFilter !== 'all' && String(car.vehicle_type || '') !== filters.vehicleTypeFilter) return false
    if (filters.statusFilter && filters.statusFilter !== 'all' && String(car.production_status || '') !== filters.statusFilter) return false
    if (normalizedFuelConsumption && !String(car.fuel_consumption || '').toLowerCase().includes(normalizedFuelConsumption)) return false

    const yearIntroduced = parseIntOrNull(car.year_introduced)
    if (parsedYearExact !== null) {
      if (yearIntroduced !== parsedYearExact) return false
    } else {
      if (parsedYearFrom !== null && yearIntroduced !== null && yearIntroduced < parsedYearFrom) return false
      if (parsedYearTo !== null && yearIntroduced !== null && yearIntroduced > parsedYearTo) return false
    }

    const horsepower = parseIntOrNull(car.horsepower)
    if (parsedHorsepowerFrom !== null && horsepower !== null && horsepower < parsedHorsepowerFrom) return false
    if (parsedHorsepowerTo !== null && horsepower !== null && horsepower > parsedHorsepowerTo) return false

    const topSpeed = parseIntOrNull(car.top_speed)
    if (parsedTopSpeedFrom !== null && topSpeed !== null && topSpeed < parsedTopSpeedFrom) return false
    if (parsedTopSpeedTo !== null && topSpeed !== null && topSpeed > parsedTopSpeedTo) return false

    const { min: carPriceMin, max: carPriceMax } = parsePriceRange(car)
    if (parsedPriceFrom !== null && carPriceMax !== null && carPriceMax < parsedPriceFrom) return false
    if (parsedPriceTo !== null && carPriceMin !== null && carPriceMin > parsedPriceTo) return false

    return true
  })
}

export function hasActiveCatalogFilters(filters) {
  return Boolean(
    String(filters.modelSearch || '').trim()
    || String(filters.yearSearch || '').trim()
    || String(filters.keywordSearch || '').trim()
    || String(filters.engineSearch || '').trim()
    || (filters.vehicleTypeFilter && filters.vehicleTypeFilter !== 'all')
    || (filters.statusFilter && filters.statusFilter !== 'all')
    || String(filters.fuelConsumptionSearch || '').trim()
    || String(filters.yearFrom || '').trim()
    || String(filters.yearTo || '').trim()
    || String(filters.horsepowerFrom || '').trim()
    || String(filters.horsepowerTo || '').trim()
    || String(filters.topSpeedFrom || '').trim()
    || String(filters.topSpeedTo || '').trim()
    || String(filters.priceFrom || '').trim()
    || String(filters.priceTo || '').trim(),
  )
}
