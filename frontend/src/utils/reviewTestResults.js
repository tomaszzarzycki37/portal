export const TEST_RESULT_FIELDS = [
  {
    key: '0-100 km/h (measured)',
    unit: 's',
    labels: { en: '0-100 km/h (measured)', pl: '0-100 km/h (pomiar)' },
    aliases: ['0-100 km/h (measured)', '0-100 km/h'],
  },
  {
    key: '80-120 km/h',
    unit: 's',
    labels: { en: '80-120 km/h', pl: '80-120 km/h' },
    aliases: ['80-120 km/h'],
  },
  {
    key: '100-0 km/h braking distance',
    unit: 'm',
    labels: { en: '100-0 km/h braking distance', pl: 'Droga hamowania 100-0 km/h' },
    aliases: ['100-0 km/h braking distance'],
  },
  {
    key: 'Top speed',
    unit: 'km/h',
    labels: { en: 'Top speed', pl: 'Prędkość maksymalna' },
    aliases: ['Top speed'],
  },
  {
    key: 'Real-world mixed consumption',
    unit: 'kWh/100 km',
    labels: { en: 'Real-world mixed consumption', pl: 'Realne zużycie mieszane' },
    aliases: ['Real-world mixed consumption', 'Real-world consumption (mixed)'],
  },
  {
    key: 'Real-world motorway consumption (130 km/h)',
    unit: 'kWh/100 km',
    labels: { en: 'Real-world motorway consumption (130 km/h)', pl: 'Realne zużycie na autostradzie (130 km/h)' },
    aliases: ['Real-world motorway consumption (130 km/h)', 'Real-world motorway consumption'],
  },
  {
    key: 'Real-world range (mixed)',
    unit: 'km',
    labels: { en: 'Real-world range (mixed)', pl: 'Realny zasięg (mieszany)' },
    aliases: ['Real-world range (mixed)', 'Real-world mixed range'],
  },
  {
    key: 'Real-world motorway range (120 km/h)',
    unit: 'km',
    labels: { en: 'Real-world motorway range (120 km/h)', pl: 'Realny zasięg na autostradzie (120 km/h)' },
    aliases: ['Real-world motorway range (120 km/h)', 'Real-world motorway range'],
  },
  {
    key: 'Battery-swap station total stop time',
    unit: 'min',
    labels: { en: 'Battery-swap station total stop time', pl: 'Łączny postój na stacji wymiany baterii' },
    aliases: ['Battery-swap station total stop time', 'Battery swap station total stop time'],
  },
  {
    key: 'WLTP range',
    unit: 'km',
    labels: { en: 'WLTP range', pl: 'Zasięg WLTP' },
    aliases: ['WLTP range'],
  },
  {
    key: 'DC charging 10-80%',
    unit: 'min',
    labels: { en: 'DC charging 10-80%', pl: 'Ładowanie DC 10-80%' },
    aliases: ['DC charging 10-80%', 'DC charging 20-80%'],
  },
  {
    key: 'AC charging 0-100%',
    unit: 'h',
    labels: { en: 'AC charging 0-100%', pl: 'Ładowanie AC 0-100%' },
    aliases: ['AC charging 0-100%', 'AC charging 10-100%'],
  },
  {
    key: 'Battery capacity (net)',
    unit: 'kWh',
    labels: { en: 'Battery capacity (net)', pl: 'Pojemność baterii (netto)' },
    aliases: ['Battery capacity (net)', 'Net battery capacity'],
  },
  {
    key: 'System power',
    unit: 'kW',
    labels: { en: 'System power', pl: 'Moc systemowa' },
    aliases: ['System power', 'Power'],
  },
  {
    key: 'Torque',
    unit: 'Nm',
    labels: { en: 'Torque', pl: 'Moment obrotowy' },
    aliases: ['Torque'],
  },
  {
    key: 'Curb weight',
    unit: 'kg',
    labels: { en: 'Curb weight', pl: 'Masa własna' },
    aliases: ['Curb weight'],
  },
  {
    key: 'Boot capacity',
    unit: 'L',
    labels: { en: 'Boot capacity', pl: 'Pojemność bagażnika' },
    aliases: ['Boot capacity'],
  },
]

function normalizeTestKey(value) {
  return String(value || '').trim().toLowerCase()
}

export function getTestFieldByKey(key) {
  const normalized = normalizeTestKey(key)
  return TEST_RESULT_FIELDS.find((field) =>
    field.aliases.some((alias) => normalizeTestKey(alias) === normalized)
    || normalizeTestKey(field.key) === normalized,
  ) || null
}

function stripKnownUnit(value, unit) {
  const current = String(value || '').trim()
  if (!current || !unit) return current
  if (current.toLowerCase().endsWith(` ${unit.toLowerCase()}`)) {
    return current.slice(0, -(unit.length + 1)).trim()
  }
  if (current.toLowerCase() === unit.toLowerCase()) {
    return ''
  }
  return current
}

export function appendUnit(value, unit) {
  const base = String(value || '').trim()
  if (!base) return ''
  if (!unit) return base
  if (base.toLowerCase().endsWith(` ${unit.toLowerCase()}`) || base.toLowerCase() === unit.toLowerCase()) {
    return base
  }
  return `${base} ${unit}`
}

export function getTestLabel(key, lang) {
  const field = getTestFieldByKey(key)
  if (!field) return key
  return field.labels[lang] || field.labels.en || key
}

export function buildTestResultRows(existingResults = []) {
  const normalizedExisting = Array.isArray(existingResults) ? existingResults : []

  const predefinedRows = TEST_RESULT_FIELDS.map((fieldDef) => {
    const existing = normalizedExisting.find((item) => {
      const incomingKey = String(item?.key || '')
      return !!fieldDef.aliases.find((alias) => normalizeTestKey(alias) === normalizeTestKey(incomingKey))
        || normalizeTestKey(fieldDef.key) === normalizeTestKey(incomingKey)
    })

    return {
      key: fieldDef.key,
      unit: fieldDef.unit,
      value: stripKnownUnit(existing?.value || '', fieldDef.unit),
    }
  })

  const customRows = normalizedExisting
    .filter((item) => {
      const key = String(item?.key || '').trim()
      if (!key) return false
      return !getTestFieldByKey(key)
    })
    .map((item) => ({
      key: String(item.key || '').trim(),
      unit: '',
      value: String(item.value || '').trim(),
    }))

  return [...predefinedRows, ...customRows]
}

export function serializeTestResultRows(rows) {
  return (rows || [])
    .map((item) => {
      const key = String(item.key || '').trim()
      const fieldDef = getTestFieldByKey(key)
      const unit = fieldDef?.unit || String(item.unit || '').trim()
      const value = String(item.value || '').trim()
      return {
        key,
        value: appendUnit(value, unit),
      }
    })
    .filter((item) => item.key && item.value)
}
