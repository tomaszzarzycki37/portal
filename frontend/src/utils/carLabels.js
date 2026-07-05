function polishPlural(count, forms) {
  const abs = Math.abs(Number(count))
  if (abs === 1) return forms.one
  const lastTwo = abs % 100
  const lastOne = abs % 10
  if (lastOne >= 2 && lastOne <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return forms.few
  }
  return forms.many
}

export function formatEngineVariantCount(count, t, lang) {
  const n = Number(count) || 0
  if (lang === 'pl') {
    return `${n} ${polishPlural(n, {
      one: t.pages.modelFamilyVariantOne,
      few: t.pages.modelFamilyVariantFew,
      many: t.pages.modelFamilyVariantMany,
    })}`
  }
  return `${n} ${n === 1 ? t.pages.modelFamilyVariantSingle : t.pages.modelFamilyVariantPlural}`
}

export function formatVehicleType(value, t) {
  const key = String(value || '').trim().toLowerCase()
  return t.pages.vehicleTypes?.[key] || value || '—'
}

export function formatProductionStatus(value, t) {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'active') return t.pages.statusActive
  if (key === 'discontinued') return t.pages.statusDiscontinued
  if (key === 'upcoming') return t.pages.statusUpcoming
  return value || '—'
}

export function formatVariantSelectLabel(variant, t) {
  return [
    variant.year_introduced,
    variant.engine_type || t.pages.engineUnknown,
    formatVehicleType(variant.vehicle_type, t),
    formatProductionStatus(variant.production_status, t),
  ].filter(Boolean).join(' · ')
}
