import { useEffect, useMemo, useRef, useState } from 'react'
import { getBaseTranslationValue, getTranslationKeys, useTranslation } from '../i18n'
import api from '../services/api'
import { getCurrentUser, isAdminUser } from '../utils/auth'
import { getCarImage } from '../utils/carImages'

const CURRENCY_CONFIG = {
  USD: { symbol: '$', rateToUsd: 1 },
  EUR: { symbol: 'EUR ', rateToUsd: 1.09 },
  PLN: { symbol: 'PLN ', rateToUsd: 0.25 },
  GBP: { symbol: 'GBP ', rateToUsd: 1.27 },
}

const CURRENCY_KEYS = Object.keys(CURRENCY_CONFIG)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const API_ORIGIN = import.meta.env.VITE_API_URL
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:8000'
    : ''

// ── Review content helpers ──────────────────────────────────
function parseContentToStructured(content) {
  const lines = (content || '').split('\n')
  const overview = []
  const images = ['', '', '']
  const testResults = []
  const verdict = []
  let imageIdx = 0
  let section = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'Overview') { section = 'overview'; continue }
    if (trimmed === 'Example photo gallery') { section = 'gallery'; continue }
    if (trimmed === 'Test results') { section = 'results'; continue }
    if (trimmed === 'Verdict') { section = 'verdict'; continue }
    if (!trimmed) continue
    if (section === 'overview') overview.push(trimmed)
    else if (section === 'gallery') {
      const m = trimmed.match(/^\d+\.\s+(https?:\/\/.+)/)
      if (m && imageIdx < 3) { images[imageIdx++] = m[1].trim() }
    } else if (section === 'results') {
      const m = trimmed.match(/^-\s+(.+?):\s+(.+)/)
      if (m) testResults.push({ key: m[1].trim(), value: m[2].trim() })
    } else if (section === 'verdict') verdict.push(trimmed)
  }
  return {
    overview: overview.join(' '),
    images,
    testResults: testResults.length ? testResults : [{ key: '', value: '' }],
    verdict: verdict.join(' '),
  }
}

function buildContentFromStructured({ overview, images, testResults, verdict }) {
  const lines = []
  if (overview) { lines.push('Overview', overview, '') }
  const validImgs = images.filter((u) => u.trim())
  if (validImgs.length) {
    lines.push('Example photo gallery')
    validImgs.forEach((u, i) => lines.push(`${i + 1}. ${u.trim()}`))
    lines.push('')
  }
  const validResults = testResults.filter((r) => r.key.trim())
  if (validResults.length) {
    lines.push('Test results')
    validResults.forEach((r) => lines.push(`- ${r.key.trim()}: ${r.value.trim()}`))
    lines.push('')
  }
  if (verdict) { lines.push('Verdict', verdict) }
  return lines.join('\n').trim()
}

function estimateReadingTimeMinutes(text) {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean).length
  if (!words) return 0
  return Math.max(1, Math.ceil(words / 200))
}

function RichTextEditor({ id, label, value, onChange, rows = 4 }) {
  const textRef = useRef(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const insertAtSelection = (before, after = before) => {
    const textarea = textRef.current
    if (!textarea) return

    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? 0
    const selected = value.slice(start, end)
    const nextValue = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    onChange(nextValue)

    requestAnimationFrame(() => {
      textarea.focus()
      const cursorPos = start + before.length + selected.length + after.length
      textarea.setSelectionRange(cursorPos, cursorPos)
    })
  }

  const insertListItem = () => {
    const textarea = textRef.current
    if (!textarea) return
    const start = textarea.selectionStart ?? 0
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const nextValue = `${value.slice(0, lineStart)}- ${value.slice(lineStart)}`
    onChange(nextValue)
  }

  const insertLink = () => {
    const url = window.prompt('Enter URL')
    if (!url) return
    insertAtSelection('[', `](${url.trim()})`)
  }

  return (
    <div className="admin-rich-editor">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="admin-rich-toolbar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => insertAtSelection('**')}>B</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => insertAtSelection('_')}>I</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => insertAtSelection('## ', '')}>H2</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={insertListItem}>List</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={insertLink}>Link</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAdvanced((prev) => !prev)}>
          {showAdvanced ? 'Hide advanced' : 'Advanced tools'}
        </button>
      </div>
      {showAdvanced && (
        <div className="admin-rich-toolbar admin-rich-toolbar-advanced">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => insertAtSelection('[size=sm]', '[/size]')}>A-</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => insertAtSelection('[size=md]', '[/size]')}>A</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => insertAtSelection('[size=lg]', '[/size]')}>A+</button>
        </div>
      )}
      <textarea
        ref={textRef}
        id={id}
        className="form-input form-textarea admin-rich-textarea"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
// ── End review content helpers ──────────────────────────────

function resolveMediaUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('file_read_failed'))
    reader.readAsDataURL(file)
  })
}

function extractApiErrorMessage(error, fallbackMessage) {
  const payload = error?.response?.data
  if (!payload) return fallbackMessage

  if (typeof payload === 'string') return payload
  if (Array.isArray(payload)) {
    const joined = payload.map((item) => String(item || '').trim()).filter(Boolean).join(' ')
    return joined || fallbackMessage
  }

  if (typeof payload === 'object') {
    if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim()
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim()

    const messages = []
    Object.entries(payload).forEach(([field, value]) => {
      if (!value) return
      if (Array.isArray(value)) {
        const text = value.map((entry) => String(entry || '').trim()).filter(Boolean).join(' ')
        if (!text) return
        if (field === 'non_field_errors') messages.push(text)
        else messages.push(`${field}: ${text}`)
        return
      }

      const text = String(value).trim()
      if (!text) return
      if (field === 'non_field_errors') messages.push(text)
      else messages.push(`${field}: ${text}`)
    })

    if (messages.length > 0) return messages.join(' | ')
  }

  return fallbackMessage
}

export default function AdminDashboard() {
  const { t, lang } = useTranslation()
  const [density, setDensity] = useState(() => localStorage.getItem('admin_density') || 'comfortable')
  const [cars, setCars] = useState([])
  const [brands, setBrands] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  const [description, setDescription] = useState('')
  const [yearIntroduced, setYearIntroduced] = useState('')
  const [vehicleType, setVehicleType] = useState('sedan')
  const [engineType, setEngineType] = useState('')
  const [horsepower, setHorsepower] = useState('')
  const [acceleration, setAcceleration] = useState('')
  const [topSpeed, setTopSpeed] = useState('')
  const [fuelConsumption, setFuelConsumption] = useState('')
  const [priceMinK, setPriceMinK] = useState('')
  const [priceMaxK, setPriceMaxK] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [selectedCurrencies, setSelectedCurrencies] = useState(['USD', 'EUR'])
  const [productionStatus, setProductionStatus] = useState('active')
  const [isFeatured, setIsFeatured] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [brandSlug, setBrandSlug] = useState('')
  const [brandLogoFile, setBrandLogoFile] = useState(null)
  const [brandLogoPreview, setBrandLogoPreview] = useState('')
  const [originalValues, setOriginalValues] = useState(null)
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [contentLang, setContentLang] = useState('en')
  const [contentKey, setContentKey] = useState('home.titleA')
  const [contentValue, setContentValue] = useState('')
  const [contentRecordId, setContentRecordId] = useState(null)
  const [contentSaving, setContentSaving] = useState(false)
  const [contentMessage, setContentMessage] = useState('')
  const [contentError, setContentError] = useState('')
  const [headerLang, setHeaderLang] = useState('en')
  const [headerTitle, setHeaderTitle] = useState('')
  const [headerIcon, setHeaderIcon] = useState('')
  const [headerLogoUrl, setHeaderLogoUrl] = useState('')
  const [headerLogoFile, setHeaderLogoFile] = useState(null)
  const [headerLogoFilePreview, setHeaderLogoFilePreview] = useState('')
  const [headerRecordIds, setHeaderRecordIds] = useState({
    title: null,
    icon: null,
    logoUrl: null,
  })
  const [headerOriginalValues, setHeaderOriginalValues] = useState({
    title: '',
    icon: '',
    logoUrl: '',
  })
  const [headerSaving, setHeaderSaving] = useState(false)
  const [headerMessage, setHeaderMessage] = useState('')
  const [headerError, setHeaderError] = useState('')
  const [footerEmail, setFooterEmail] = useState('')
  const [footerPhone, setFooterPhone] = useState('')
  const [footerRecordIds, setFooterRecordIds] = useState({
    en: { email: null, phone: null },
    pl: { email: null, phone: null },
  })
  const [footerSaving, setFooterSaving] = useState(false)
  const [footerMessage, setFooterMessage] = useState('')
  const [footerError, setFooterError] = useState('')
  const [isCreateBrandSectionOpen, setIsCreateBrandSectionOpen] = useState(false)
  const [isCreateModelSectionOpen, setIsCreateModelSectionOpen] = useState(false)
  const [isHeaderSectionOpen, setIsHeaderSectionOpen] = useState(false)
  const [isFooterSectionOpen, setIsFooterSectionOpen] = useState(false)
  const [isTextManagerSectionOpen, setIsTextManagerSectionOpen] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandSlug, setNewBrandSlug] = useState('')
  const [newBrandYear, setNewBrandYear] = useState('')
  const [newBrandWebsite, setNewBrandWebsite] = useState('')
  const [newBrandDescriptionEn, setNewBrandDescriptionEn] = useState('')
  const [newBrandDescriptionPl, setNewBrandDescriptionPl] = useState('')
  const [creatingBrand, setCreatingBrand] = useState(false)
  const [createBrandMessage, setCreateBrandMessage] = useState('')
  const [createBrandError, setCreateBrandError] = useState('')
  const [newModelBrandId, setNewModelBrandId] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [newModelSlug, setNewModelSlug] = useState('')
  const [newModelYear, setNewModelYear] = useState('')
  const [newModelType, setNewModelType] = useState('sedan')
  const [newModelEngine, setNewModelEngine] = useState('')
  const [newModelPriceRange, setNewModelPriceRange] = useState('')
  const [newModelDescription, setNewModelDescription] = useState('')
  const [newModelStatus, setNewModelStatus] = useState('active')
  const [newModelFeatured, setNewModelFeatured] = useState(false)
  const [creatingModel, setCreatingModel] = useState(false)
  const [createModelMessage, setCreateModelMessage] = useState('')
  const [createModelError, setCreateModelError] = useState('')
  const [isCreateReviewSectionOpen, setIsCreateReviewSectionOpen] = useState(false)
  const [newReviewCarId, setNewReviewCarId] = useState('')
  const [newReviewTitle, setNewReviewTitle] = useState('')
  const [newReviewSummary, setNewReviewSummary] = useState('')
  const [newReviewOverview, setNewReviewOverview] = useState('')
  const [newReviewImages, setNewReviewImages] = useState(['', '', ''])
  const [newReviewTestResults, setNewReviewTestResults] = useState([{ key: '', value: '' }])
  const [newReviewVerdict, setNewReviewVerdict] = useState('')
  const [newReviewPublication, setNewReviewPublication] = useState('')
  const [newReviewSlug, setNewReviewSlug] = useState('')
  const [newReviewCategory, setNewReviewCategory] = useState('test')
  const [newReviewTags, setNewReviewTags] = useState('')
  const [newReviewReadingTime, setNewReviewReadingTime] = useState('')
  const [newReviewInternalNotes, setNewReviewInternalNotes] = useState('')
  const [newReviewAuthor, setNewReviewAuthor] = useState('')
  const [newReviewPublishedAt, setNewReviewPublishedAt] = useState('')
  const [newReviewFeatured, setNewReviewFeatured] = useState(false)
  const [newReviewPinned, setNewReviewPinned] = useState(false)
  const [newReviewPublished, setNewReviewPublished] = useState(true)
  const [creatingReview, setCreatingReview] = useState(false)
  const [createReviewMessage, setCreateReviewMessage] = useState('')
  const [createReviewError, setCreateReviewError] = useState('')
  const [isManageReviewsSectionOpen, setIsManageReviewsSectionOpen] = useState(false)
  const [pressReviews, setPressReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState('')
  const [reviewsMessage, setReviewsMessage] = useState('')
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [reviewEditDraft, setReviewEditDraft] = useState(null)

  const toSlug = (value) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  const loadInventoryData = async (preferredSelectedId = '') => {
    const [carsResponse, brandsResponse] = await Promise.all([
      api.get('/cars/?page_size=200'),
      api.get('/cars/brands/?page_size=200'),
    ])

    const carList = carsResponse.data.results || carsResponse.data || []
    const brandList = brandsResponse.data.results || brandsResponse.data || []
    setCars(carList)
    setBrands(brandList)

    if (brandList.length > 0 && !newModelBrandId) {
      setNewModelBrandId(String(brandList[0].id))
    }
    if (carList.length > 0 && !newReviewCarId) {
      setNewReviewCarId(String(carList[0].id))
    }

    const preferred = String(preferredSelectedId || selectedId || '')
    if (preferred && carList.some((car) => String(car.id) === preferred)) {
      setSelectedId(preferred)
    } else if (carList.length > 0) {
      setSelectedId(String(carList[0].id))
    } else {
      setSelectedId('')
    }
  }

  const loadPressReviews = async () => {
    setReviewsError('')
    setReviewsMessage('')
    setReviewsLoading(true)

    try {
      const response = await api.get('/reviews/?page_size=200&ordering=-published_at')
      const reviewList = response.data.results || response.data || []
      setPressReviews(reviewList)
    } catch {
      setReviewsError(t.adminPanel.reviewLoadError)
      setPressReviews([])
    } finally {
      setReviewsLoading(false)
    }
  }

  const currentUser = useMemo(() => getCurrentUser(), [])
  const dashboardOwner = useMemo(() => currentUser?.username || 'admin', [currentUser])
  const dashboardOwnerInitial = useMemo(() => dashboardOwner.slice(0, 1).toUpperCase(), [dashboardOwner])
  const contentKeys = useMemo(() => getTranslationKeys(contentLang), [contentLang])

  const baseContentValue = useMemo(
    () => getBaseTranslationValue(contentLang, contentKey) || '',
    [contentLang, contentKey],
  )

  useEffect(() => {
    localStorage.setItem('admin_density', density)
  }, [density])

  useEffect(() => {
    setContentLang(lang)
  }, [lang])

  useEffect(() => {
    setHeaderLang(lang)
  }, [lang])

  useEffect(() => {
    if (!contentKeys.includes(contentKey) && contentKeys.length > 0) {
      setContentKey(contentKeys[0])
    }
  }, [contentKeys, contentKey])

  const selectedCar = useMemo(
    () => cars.find((car) => String(car.id) === String(selectedId)) || null,
    [cars, selectedId],
  )

  const headerLogoPreview = useMemo(
    () => resolveMediaUrl(headerLogoUrl),
    [headerLogoUrl],
  )

  const filteredCars = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return cars.filter((car) => {
      const matchesTerm =
        !term ||
        car.name?.toLowerCase().includes(term) ||
        car.brand_name?.toLowerCase().includes(term)
      const matchesFeatured = !featuredOnly || !!car.is_featured
      return matchesTerm && matchesFeatured
    })
  }, [cars, searchTerm, featuredOnly])

  const groupedFilteredCars = useMemo(() => {
    const groups = new Map()

    ;[...filteredCars]
      .sort((a, b) => `${a.brand_name || ''} ${a.name || ''}`.localeCompare(`${b.brand_name || ''} ${b.name || ''}`))
      .forEach((car) => {
        const brandName = String(car.brand_name || '').trim() || 'Unknown brand'
        if (!groups.has(brandName)) {
          groups.set(brandName, [])
        }
        groups.get(brandName).push(car)
      })

    return Array.from(groups.entries()).map(([brandName, items]) => ({ brandName, items }))
  }, [filteredCars])

  const stats = useMemo(() => {
    const totalCars = cars.length
    const featuredCars = cars.filter((car) => car.is_featured).length
    const avgRating =
      totalCars > 0
        ? (cars.reduce((sum, car) => sum + (Number(car.avg_rating) || 0), 0) / totalCars).toFixed(1)
        : '0.0'

    return { totalCars, featuredCars, avgRating }
  }, [cars])

  const generatedPriceRange = useMemo(() => {
    const minValue = Number.parseFloat(String(priceMinK).replace(',', '.'))
    const maxValue = Number.parseFloat(String(priceMaxK).replace(',', '.'))

    if (Number.isNaN(minValue) || Number.isNaN(maxValue) || minValue <= 0 || maxValue <= 0 || minValue > maxValue) {
      return ''
    }

    const baseConfig = CURRENCY_CONFIG[baseCurrency]
    if (!baseConfig) return ''

    const minUsd = (minValue * baseConfig.rateToUsd)
    const maxUsd = (maxValue * baseConfig.rateToUsd)

    const formatK = (value) => {
      if (Number.isInteger(value)) return `${value}`
      return value.toFixed(1)
    }

    return selectedCurrencies
      .map((currencyKey) => {
        const config = CURRENCY_CONFIG[currencyKey]
        if (!config) return null
        const convertedMin = minUsd / config.rateToUsd
        const convertedMax = maxUsd / config.rateToUsd
        return `${currencyKey} ${config.symbol}${formatK(convertedMin)}k-${formatK(convertedMax)}k`
      })
      .filter(Boolean)
      .join(' | ')
  }, [priceMinK, priceMaxK, baseCurrency, selectedCurrencies])

  const parsePriceRange = (priceText) => {
    const price = String(priceText || '')
    const detectedCurrencies = CURRENCY_KEYS.filter(
      (key) => price.includes(`${key} `) || (key === 'USD' && price.includes('$')),
    )
    const currencies = detectedCurrencies.length > 0 ? detectedCurrencies : ['USD', 'EUR']
    const numericMatches = [...price.matchAll(/(\d+(?:[\.,]\d+)?)\s*k?/gi)]
      .map((match) => Number.parseFloat(match[1].replace(',', '.')))
      .filter((n) => !Number.isNaN(n))

    if (numericMatches.length >= 2) {
      return {
        minK: String(numericMatches[0]),
        maxK: String(numericMatches[1]),
        base: currencies[0],
        currencies,
      }
    }

    return {
      minK: '',
      maxK: '',
      base: currencies[0],
      currencies,
    }
  }

  const hydrateEditor = (car) => {
    if (!car) return

    setDescription(car.description || '')
    setYearIntroduced(car.year_introduced ? String(car.year_introduced) : '')
    setVehicleType(car.vehicle_type || 'sedan')
    setEngineType(car.engine_type || '')
    setHorsepower(car.horsepower !== null && car.horsepower !== undefined ? String(car.horsepower) : '')
    setAcceleration(car.acceleration || '')
    setTopSpeed(car.top_speed !== null && car.top_speed !== undefined ? String(car.top_speed) : '')
    setFuelConsumption(car.fuel_consumption || '')
    const parsedPrice = parsePriceRange(car.price_range)
    setPriceMinK(parsedPrice.minK)
    setPriceMaxK(parsedPrice.maxK)
    setBaseCurrency(parsedPrice.base)
    setSelectedCurrencies(parsedPrice.currencies)
    setProductionStatus(car.production_status || 'active')
    setIsFeatured(!!car.is_featured)
    setImagePreview(getCarImage(car))
    setBrandSlug(car.brand?.slug || '')
    setBrandLogoPreview(resolveMediaUrl(car.brand?.logo || ''))
    setImageFile(null)
    setBrandLogoFile(null)

    setOriginalValues({
      description: car.description || '',
      yearIntroduced: car.year_introduced ? String(car.year_introduced) : '',
      vehicleType: car.vehicle_type || 'sedan',
      engineType: car.engine_type || '',
      horsepower: car.horsepower !== null && car.horsepower !== undefined ? String(car.horsepower) : '',
      acceleration: car.acceleration || '',
      topSpeed: car.top_speed !== null && car.top_speed !== undefined ? String(car.top_speed) : '',
      fuelConsumption: car.fuel_consumption || '',
      priceMinK: parsedPrice.minK,
      priceMaxK: parsedPrice.maxK,
      baseCurrency: parsedPrice.base,
      selectedCurrencies: parsedPrice.currencies,
      productionStatus: car.production_status || 'active',
      isFeatured: !!car.is_featured,
      imagePreview: getCarImage(car),
      brandSlug: car.brand?.slug || '',
      brandLogoPreview: resolveMediaUrl(car.brand?.logo || ''),
    })
  }

  useEffect(() => {
    const loadCars = async () => {
      if (!isAdminUser()) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        await Promise.all([
          loadInventoryData(''),
          loadPressReviews(),
        ])
      } catch {
        setError(t.adminPanel.loadError)
      } finally {
        setLoading(false)
      }
    }

    loadCars()
  }, [t.adminPanel.loadError])

  useEffect(() => {
    if (!selectedId) return

    const loadSelectedCar = async () => {
      try {
        setMessage('')
        setError('')
        const response = await api.get(`/cars/${selectedId}/`)
        hydrateEditor(response.data)
      } catch {
        setError(t.adminPanel.loadError)
      }
    }

    loadSelectedCar()
  }, [selectedId, t.adminPanel.loadError])

  const handleCreateBrand = async (e) => {
    e.preventDefault()
    setCreateBrandMessage('')
    setCreateBrandError('')

    const name = newBrandName.trim()
    const slug = (newBrandSlug.trim() || toSlug(name))
    if (!name || !slug) {
      setCreateBrandError(t.adminPanel.createBrandValidation)
      return
    }

    const yearValue = newBrandYear.trim()
    const parsedYear = yearValue ? Number.parseInt(yearValue, 10) : null
    if (yearValue && Number.isNaN(parsedYear)) {
      setCreateBrandError(t.adminPanel.createBrandValidation)
      return
    }

    try {
      setCreatingBrand(true)
      await api.post('/cars/brands/', {
        name,
        slug,
        founded_year: parsedYear,
        website: newBrandWebsite.trim(),
        description_en: newBrandDescriptionEn,
        description_pl: newBrandDescriptionPl,
      })

      setNewBrandName('')
      setNewBrandSlug('')
      setNewBrandYear('')
      setNewBrandWebsite('')
      setNewBrandDescriptionEn('')
      setNewBrandDescriptionPl('')
      setCreateBrandMessage(t.adminPanel.brandCreated)
      await loadInventoryData(selectedId)
    } catch {
      setCreateBrandError(t.adminPanel.brandCreateError)
    } finally {
      setCreatingBrand(false)
    }
  }

  const handleCreateModel = async (e) => {
    e.preventDefault()
    setCreateModelMessage('')
    setCreateModelError('')

    const name = newModelName.trim()
    const slug = (newModelSlug.trim() || toSlug(name))
    const parsedYear = Number.parseInt(newModelYear.trim(), 10)
    const brandId = Number.parseInt(newModelBrandId, 10)
    if (!name || !slug || Number.isNaN(parsedYear) || Number.isNaN(brandId)) {
      setCreateModelError(t.adminPanel.createModelValidation)
      return
    }

    if (!newModelDescription.trim()) {
      setCreateModelError(t.adminPanel.createModelValidation)
      return
    }

    try {
      setCreatingModel(true)
      const response = await api.post('/cars/', {
        brand_id: brandId,
        name,
        slug,
        year_introduced: parsedYear,
        vehicle_type: newModelType,
        description: newModelDescription,
        engine_type: newModelEngine,
        price_range: newModelPriceRange,
        production_status: newModelStatus,
        is_featured: newModelFeatured,
      })

      const createdCarId = String(response.data.id || '')
      setNewModelName('')
      setNewModelSlug('')
      setNewModelYear('')
      setNewModelType('sedan')
      setNewModelEngine('')
      setNewModelPriceRange('')
      setNewModelDescription('')
      setNewModelStatus('active')
      setNewModelFeatured(false)
      setCreateModelMessage(t.adminPanel.modelCreated)
      await loadInventoryData(createdCarId)
    } catch {
      setCreateModelError(t.adminPanel.modelCreateError)
    } finally {
      setCreatingModel(false)
    }
  }

  const handleCreateReview = async (e) => {
    e.preventDefault()
    setCreateReviewMessage('')
    setCreateReviewError('')

    const parsedCarId = Number.parseInt(newReviewCarId, 10)
    const builtContent = buildContentFromStructured({ overview: newReviewOverview, images: newReviewImages, testResults: newReviewTestResults, verdict: newReviewVerdict })
    const parsedReadingTime = Number.parseInt(String(newReviewReadingTime || '').trim(), 10)
    if (
      Number.isNaN(parsedCarId) ||
      !newReviewTitle.trim() ||
      !builtContent.trim() ||
      !newReviewPublication.trim() ||
      !newReviewPublishedAt
    ) {
      setCreateReviewError(t.adminPanel.createReviewValidation)
      return
    }

    try {
      setCreatingReview(true)
      await api.post('/reviews/', {
        car_model: parsedCarId,
        title: newReviewTitle.trim(),
        slug: newReviewSlug.trim(),
        summary: newReviewSummary.trim(),
        content: builtContent,
        category: newReviewCategory,
        tags: newReviewTags.trim(),
        reading_time_minutes: Number.isNaN(parsedReadingTime) ? estimateReadingTimeMinutes(`${newReviewSummary} ${builtContent}`) : parsedReadingTime,
        internal_notes: newReviewInternalNotes.trim(),
        publication_name: newReviewPublication.trim(),
        author_name: newReviewAuthor.trim(),
        published_at: newReviewPublishedAt,
        is_featured: newReviewFeatured,
        is_pinned: newReviewPinned,
        is_published: newReviewPublished,
      })

      setNewReviewTitle('')
      setNewReviewSummary('')
      setNewReviewOverview('')
      setNewReviewImages(['', '', ''])
      setNewReviewTestResults([{ key: '', value: '' }])
      setNewReviewVerdict('')
      setNewReviewPublication('')
      setNewReviewSlug('')
      setNewReviewCategory('test')
      setNewReviewTags('')
      setNewReviewReadingTime('')
      setNewReviewInternalNotes('')
      setNewReviewAuthor('')
      setNewReviewPublishedAt('')
      setNewReviewFeatured(false)
      setNewReviewPinned(false)
      setNewReviewPublished(true)
      setCreateReviewMessage(t.adminPanel.reviewCreated)
      await loadPressReviews()
    } catch {
      setCreateReviewError(t.adminPanel.reviewCreateError)
    } finally {
      setCreatingReview(false)
    }
  }

  const handleEditReview = async (reviewId) => {
    setReviewsMessage('')
    setReviewsError('')
    try {
      const response = await api.get(`/reviews/${reviewId}/`)
      const detail = response.data
      const publishedDate = String(detail.published_at || '').slice(0, 10)
      setEditingReviewId(reviewId)
      setReviewEditDraft({
        car_model: String(detail.car_id || ''),
        title: detail.title || '',
        slug: detail.slug || '',
        summary: detail.summary || '',
        _structured: parseContentToStructured(detail.content || ''),
        content: detail.content || '',
        category: detail.category || 'test',
        tags: detail.tags || '',
        reading_time_minutes: String(detail.reading_time_minutes ?? ''),
        internal_notes: detail.internal_notes || '',
        publication_name: detail.publication_name || '',
        author_name: detail.author_name || '',
        published_at: publishedDate,
        is_featured: !!detail.is_featured,
        is_pinned: !!detail.is_pinned,
        is_published: !!detail.is_published,
      })
    } catch {
      setReviewsError(t.adminPanel.reviewLoadError)
    }
  }

  const handleCancelReviewEdit = () => {
    setEditingReviewId(null)
    setReviewEditDraft(null)
  }

  const handleSaveReviewEdit = async (reviewId) => {
    if (!reviewEditDraft) return
    const parsedReadingTime = Number.parseInt(String(reviewEditDraft.reading_time_minutes || '').trim(), 10)
    if (
      !reviewEditDraft.car_model ||
      !reviewEditDraft.title.trim() ||
      !buildContentFromStructured(reviewEditDraft._structured || parseContentToStructured(reviewEditDraft.content || '')).trim() ||
      !reviewEditDraft.publication_name.trim() ||
      !reviewEditDraft.published_at
    ) {
      setReviewsError(t.adminPanel.createReviewValidation)
      return
    }

    setReviewsMessage('')
    setReviewsError('')
    try {
      await api.patch(`/reviews/${reviewId}/`, {
        car_model: Number.parseInt(reviewEditDraft.car_model, 10),
        title: reviewEditDraft.title.trim(),
        slug: reviewEditDraft.slug.trim(),
        summary: reviewEditDraft.summary.trim(),
        content: buildContentFromStructured(reviewEditDraft._structured || parseContentToStructured(reviewEditDraft.content || '')),
        category: reviewEditDraft.category,
        tags: reviewEditDraft.tags.trim(),
        reading_time_minutes: Number.isNaN(parsedReadingTime)
          ? estimateReadingTimeMinutes(`${reviewEditDraft.summary} ${buildContentFromStructured(reviewEditDraft._structured || parseContentToStructured(reviewEditDraft.content || ''))}`)
          : parsedReadingTime,
        internal_notes: reviewEditDraft.internal_notes.trim(),
        publication_name: reviewEditDraft.publication_name.trim(),
        author_name: reviewEditDraft.author_name.trim(),
        published_at: reviewEditDraft.published_at,
        is_featured: !!reviewEditDraft.is_featured,
        is_pinned: !!reviewEditDraft.is_pinned,
        is_published: !!reviewEditDraft.is_published,
      })
      setReviewsMessage(t.adminPanel.reviewUpdated)
      setEditingReviewId(null)
      setReviewEditDraft(null)
      await loadPressReviews()
    } catch {
      setReviewsError(t.adminPanel.reviewUpdateError)
    }
  }

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm(t.adminPanel.reviewDeleteConfirm)) return
    setReviewsMessage('')
    setReviewsError('')
    try {
      await api.delete(`/reviews/${reviewId}/`)
      setReviewsMessage(t.adminPanel.reviewDeleted)
      if (editingReviewId === reviewId) {
        setEditingReviewId(null)
        setReviewEditDraft(null)
      }
      await loadPressReviews()
    } catch {
      setReviewsError(t.adminPanel.reviewDeleteError)
    }
  }

  const handleReset = () => {
    if (!originalValues) return
    setDescription(originalValues.description)
    setYearIntroduced(originalValues.yearIntroduced)
    setVehicleType(originalValues.vehicleType)
    setEngineType(originalValues.engineType)
    setHorsepower(originalValues.horsepower)
    setAcceleration(originalValues.acceleration)
    setTopSpeed(originalValues.topSpeed)
    setFuelConsumption(originalValues.fuelConsumption)
    setPriceMinK(originalValues.priceMinK)
    setPriceMaxK(originalValues.priceMaxK)
    setBaseCurrency(originalValues.baseCurrency)
    setSelectedCurrencies(originalValues.selectedCurrencies)
    setProductionStatus(originalValues.productionStatus)
    setIsFeatured(originalValues.isFeatured)
    setImagePreview(originalValues.imagePreview)
    setBrandSlug(originalValues.brandSlug)
    setBrandLogoPreview(originalValues.brandLogoPreview)
    setImageFile(null)
    setBrandLogoFile(null)
    setMessage('')
    setError('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (!yearIntroduced.trim()) {
      setError(t.adminInline.yearRequired)
      return
    }

    const parsedYear = Number.parseInt(yearIntroduced, 10)
    if (Number.isNaN(parsedYear)) {
      setError(t.adminInline.yearRequired)
      return
    }

    if (selectedCurrencies.length === 0) {
      setError(t.adminPanel.currencyRequired)
      return
    }

    if (!generatedPriceRange) {
      setError(t.adminPanel.priceInvalid)
      return
    }

    const toIntOrNull = (value) => {
      const trimmed = String(value || '').trim()
      if (!trimmed) return null
      const parsed = Number.parseInt(trimmed, 10)
      return Number.isNaN(parsed) ? null : parsed
    }

    try {
      setSaving(true)
      const formData = new FormData()
      formData.append('description', description)
      formData.append('year_introduced', String(parsedYear))
      formData.append('vehicle_type', vehicleType)
      formData.append('engine_type', engineType)
      formData.append('horsepower', String(toIntOrNull(horsepower) ?? ''))
      formData.append('acceleration', acceleration)
      formData.append('top_speed', String(toIntOrNull(topSpeed) ?? ''))
      formData.append('fuel_consumption', fuelConsumption)
      formData.append('price_range', generatedPriceRange)
      formData.append('production_status', productionStatus)
      formData.append('is_featured', String(isFeatured))
      if (imageFile) {
        formData.append('image', imageFile)
      }

      const response = await api.patch(`/cars/${selectedId}/`, formData)

      const updated = response.data
      setCars((prev) => prev.map((car) => (String(car.id) === String(selectedId) ? { ...car, ...updated } : car)))
      hydrateEditor(updated)

      if (brandLogoFile && brandSlug) {
        const brandFormData = new FormData()
        brandFormData.append('logo', brandLogoFile)
        const brandResponse = await api.patch(`/cars/brands/${brandSlug}/`, brandFormData)
        setBrandLogoPreview(resolveMediaUrl(brandResponse.data.logo || ''))
      }

      setImageFile(null)
      setBrandLogoFile(null)
      setMessage(t.adminPanel.saved)
    } catch (error) {
      setError(extractApiErrorMessage(error, t.adminPanel.loadError))
    } finally {
      setSaving(false)
    }
  }

  const saveContentOverride = async ({ recordId, key, value, language }) => {
    if (recordId) {
      await api.patch(`/common/content/${recordId}/`, { value })
      return recordId
    }

    const response = await api.post('/common/content/', {
      key,
      lang: language,
      value,
    })
    return response.data.id
  }

  useEffect(() => {
    const loadContentOverride = async () => {
      if (!contentKey) return

      try {
        setContentMessage('')
        setContentError('')
        const response = await api.get(`/common/content/?lang=${contentLang}&key=${contentKey}`)
        const list = response.data.results || response.data || []
        const record = list[0]

        if (record) {
          setContentRecordId(record.id)
          setContentValue(record.value || '')
        } else {
          setContentRecordId(null)
          setContentValue(String(getBaseTranslationValue(contentLang, contentKey) || ''))
        }
      } catch {
        setContentRecordId(null)
        setContentValue(String(getBaseTranslationValue(contentLang, contentKey) || ''))
      }
    }

    loadContentOverride()
  }, [contentLang, contentKey])

  useEffect(() => {
    const loadHeaderSettings = async () => {
      try {
        setHeaderMessage('')
        setHeaderError('')
        const response = await api.get(`/common/content/?lang=${headerLang}`)
        const list = response.data.results || response.data || []
        const titleRecord = list.find((item) => item.key === 'nav.brandTitle') || null
        const iconRecord = list.find((item) => item.key === 'nav.brandIcon') || null
        const logoRecord = list.find((item) => item.key === 'nav.brandLogoUrl') || null
        const nextValues = {
          title: String(titleRecord?.value ?? getBaseTranslationValue(headerLang, 'nav.brandTitle') ?? ''),
          icon: String(iconRecord?.value ?? getBaseTranslationValue(headerLang, 'nav.brandIcon') ?? ''),
          logoUrl: String(logoRecord?.value ?? getBaseTranslationValue(headerLang, 'nav.brandLogoUrl') ?? ''),
        }

        setHeaderTitle(nextValues.title)
        setHeaderIcon(nextValues.icon)
        setHeaderLogoUrl(nextValues.logoUrl)
        setHeaderOriginalValues(nextValues)
        setHeaderRecordIds({
          title: titleRecord?.id ?? null,
          icon: iconRecord?.id ?? null,
          logoUrl: logoRecord?.id ?? null,
        })
      } catch {
        const fallbackValues = {
          title: String(getBaseTranslationValue(headerLang, 'nav.brandTitle') ?? ''),
          icon: String(getBaseTranslationValue(headerLang, 'nav.brandIcon') ?? ''),
          logoUrl: String(getBaseTranslationValue(headerLang, 'nav.brandLogoUrl') ?? ''),
        }
        setHeaderTitle(fallbackValues.title)
        setHeaderIcon(fallbackValues.icon)
        setHeaderLogoUrl(fallbackValues.logoUrl)
        setHeaderOriginalValues(fallbackValues)
        setHeaderRecordIds({ title: null, icon: null, logoUrl: null })
      }
    }

    loadHeaderSettings()
  }, [headerLang])

  useEffect(() => {
    const loadFooterSettings = async () => {
      try {
        setFooterMessage('')
        setFooterError('')
        const [enResponse, plResponse] = await Promise.all([
          api.get('/common/content/?lang=en'),
          api.get('/common/content/?lang=pl'),
        ])

        const enList = enResponse.data.results || enResponse.data || []
        const plList = plResponse.data.results || plResponse.data || []
        const enEmailRecord = enList.find((item) => item.key === 'footer.email') || null
        const enPhoneRecord = enList.find((item) => item.key === 'footer.phone') || null
        const plEmailRecord = plList.find((item) => item.key === 'footer.email') || null
        const plPhoneRecord = plList.find((item) => item.key === 'footer.phone') || null

        const nextValues = {
          email: String(
            enEmailRecord?.value
            ?? plEmailRecord?.value
            ?? getBaseTranslationValue('en', 'footer.email')
            ?? '',
          ),
          phone: String(
            enPhoneRecord?.value
            ?? plPhoneRecord?.value
            ?? getBaseTranslationValue('en', 'footer.phone')
            ?? '',
          ),
        }

        setFooterEmail(nextValues.email)
        setFooterPhone(nextValues.phone)
        setFooterRecordIds({
          en: {
            email: enEmailRecord?.id ?? null,
            phone: enPhoneRecord?.id ?? null,
          },
          pl: {
            email: plEmailRecord?.id ?? null,
            phone: plPhoneRecord?.id ?? null,
          },
        })
      } catch {
        const fallbackValues = {
          email: String(getBaseTranslationValue('en', 'footer.email') ?? ''),
          phone: String(getBaseTranslationValue('en', 'footer.phone') ?? ''),
        }
        setFooterEmail(fallbackValues.email)
        setFooterPhone(fallbackValues.phone)
        setFooterRecordIds({
          en: { email: null, phone: null },
          pl: { email: null, phone: null },
        })
      }
    }

    loadFooterSettings()
  }, [])

  const handleResetHeader = () => {
    setHeaderTitle(headerOriginalValues.title)
    setHeaderIcon(headerOriginalValues.icon)
    setHeaderLogoUrl(headerOriginalValues.logoUrl)
    setHeaderLogoFile(null)
    setHeaderLogoFilePreview('')
    setHeaderMessage('')
    setHeaderError('')
  }

  const handleSaveHeader = async () => {
    try {
      setHeaderSaving(true)
      setHeaderMessage('')
      setHeaderError('')

      let finalLogoUrl = headerLogoUrl

      // Upload file if a new one was selected
      if (headerLogoFile) {
        try {
          const formData = new FormData()
          formData.append('file', headerLogoFile)
          // Don't set Content-Type header - let browser handle it with correct boundary
          const uploadResponse = await api.post('/common/content/upload/', formData)
          finalLogoUrl = uploadResponse.data.url
          setHeaderLogoFile(null)
          setHeaderLogoFilePreview('')
        } catch (uploadErr) {
          console.error('Logo upload failed:', uploadErr)
          setHeaderError(t.adminPanel.headerLogoUploadError)
          setHeaderSaving(false)
          return
        }
      }

      const [titleId, iconId, logoId] = await Promise.all([
        saveContentOverride({
          recordId: headerRecordIds.title,
          key: 'nav.brandTitle',
          value: headerTitle,
          language: headerLang,
        }),
        saveContentOverride({
          recordId: headerRecordIds.icon,
          key: 'nav.brandIcon',
          value: headerIcon,
          language: headerLang,
        }),
        saveContentOverride({
          recordId: headerRecordIds.logoUrl,
          key: 'nav.brandLogoUrl',
          value: finalLogoUrl,
          language: headerLang,
        }),
      ])

      const nextValues = {
        title: headerTitle,
        icon: headerIcon,
        logoUrl: finalLogoUrl,
      }
      setHeaderLogoUrl(finalLogoUrl)
      setHeaderRecordIds({ title: titleId, icon: iconId, logoUrl: logoId })
      setHeaderOriginalValues(nextValues)
      setHeaderMessage(t.adminPanel.headerSaved)
    } catch (err) {
      console.error('Header save failed:', err)
      setHeaderError(t.adminPanel.headerSaveError)
    } finally {
      setHeaderSaving(false)
    }
  }

  const handleHeaderLogoFileChange = async (e) => {
    const file = e.target.files?.[0] || null
    if (!file) return

    try {
      setHeaderError('')
      setHeaderMessage('')
      console.log('File selected:', file.name, file.size, file.type)
      // Store file for upload on save
      setHeaderLogoFile(file)
      // Create preview data URL for immediate UI display
      const dataUrl = await readFileAsDataUrl(file)
      console.log('Preview data URL created, length:', dataUrl.length)
      setHeaderLogoFilePreview(dataUrl)
    } catch (err) {
      console.error('File handling error:', err)
      setHeaderError(t.adminPanel.headerLogoUploadError)
    } finally {
      e.target.value = ''
    }
  }

  const handleSaveFooter = async () => {
    try {
      setFooterSaving(true)
      setFooterMessage('')
      setFooterError('')

      const [enEmailId, enPhoneId, plEmailId, plPhoneId] = await Promise.all([
        saveContentOverride({
          recordId: footerRecordIds.en.email,
          key: 'footer.email',
          value: footerEmail,
          language: 'en',
        }),
        saveContentOverride({
          recordId: footerRecordIds.en.phone,
          key: 'footer.phone',
          value: footerPhone,
          language: 'en',
        }),
        saveContentOverride({
          recordId: footerRecordIds.pl.email,
          key: 'footer.email',
          value: footerEmail,
          language: 'pl',
        }),
        saveContentOverride({
          recordId: footerRecordIds.pl.phone,
          key: 'footer.phone',
          value: footerPhone,
          language: 'pl',
        }),
      ])

      setFooterRecordIds({
        en: { email: enEmailId, phone: enPhoneId },
        pl: { email: plEmailId, phone: plPhoneId },
      })
      setFooterMessage(t.adminPanel.footerSaved)
    } catch (err) {
      console.error('Footer save failed:', err)
      setFooterError(t.adminPanel.footerSaveError)
    } finally {
      setFooterSaving(false)
    }
  }

  const handleSaveContent = async () => {
    if (!contentKey.trim()) return

    try {
      setContentSaving(true)
      setContentMessage('')
      setContentError('')

      const recordId = await saveContentOverride({
        recordId: contentRecordId,
        key: contentKey,
        value: contentValue,
        language: contentLang,
      })
      setContentRecordId(recordId)

      setContentMessage(t.adminPanel.textSaved)
    } catch {
      setContentError(t.adminPanel.textSaveError)
    } finally {
      setContentSaving(false)
    }
  }

  if (!isAdminUser()) {
    return <div className="page-card">{t.adminPanel.noAccess}</div>
  }

  return (
    <div className={`admin-wrap ${density === 'compact' ? 'density-compact' : 'density-comfortable'}`}>
      <div className="page-card admin-hero-card">
        <div>
          <h1 className="page-title">{t.adminPanel.title}</h1>
          <p className="admin-subtitle">{t.adminPanel.subtitle}</p>
        </div>
        <div className="admin-hero-right">
          <div className="admin-density-switch" role="group" aria-label={t.adminPanel.densityLabel}>
            <span className="admin-density-label">{t.adminPanel.densityLabel}</span>
            <button
              type="button"
              className={`admin-density-btn ${density === 'compact' ? 'active' : ''}`}
              onClick={() => setDensity('compact')}
            >
              {t.adminPanel.densityCompact}
            </button>
            <button
              type="button"
              className={`admin-density-btn ${density === 'comfortable' ? 'active' : ''}`}
              onClick={() => setDensity('comfortable')}
            >
              {t.adminPanel.densityComfortable}
            </button>
          </div>

          <div className="admin-owner-badge">
            <span className="admin-owner-avatar">{dashboardOwnerInitial}</span>
            <div>
              <p className="admin-owner-label">{t.adminPanel.ownerLabel}</p>
              <p className="admin-owner-name">{dashboardOwner}</p>
            </div>
          </div>
        </div>
      </div>

      {!loading && (
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <p className="admin-stat-label">{t.adminPanel.statsTotalCars}</p>
            <p className="admin-stat-value">{stats.totalCars}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">{t.adminPanel.statsFeaturedCars}</p>
            <p className="admin-stat-value">{stats.featuredCars}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">{t.adminPanel.statsAvgRating}</p>
            <p className="admin-stat-value">{stats.avgRating}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loading">{t.pages.loading}</div>
      ) : (
        <div className="admin-layout-grid">
          <aside className="admin-form-card">
            <h2 className="admin-section-heading">{t.adminPanel.inventory}</h2>
            <label className="form-label" htmlFor="admin-search">{t.adminPanel.searchCars}</label>
            <input
              id="admin-search"
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.adminPanel.searchPlaceholder}
            />

            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={(e) => setFeaturedOnly(e.target.checked)}
              />
              {t.adminPanel.featuredOnly}
            </label>

            <label className="form-label" htmlFor="car-select">{t.adminPanel.quickSelect}</label>
            <select
              id="car-select"
              className="form-input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {groupedFilteredCars.map((group) => (
                <optgroup key={group.brandName} label={group.brandName}>
                  {group.items.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div className="admin-car-list">
              {groupedFilteredCars.map((group) => (
                <div key={group.brandName}>
                  <p className="form-label" style={{ marginBottom: '0.5rem' }}>{group.brandName}</p>
                  {group.items.map((car) => (
                    <button
                      key={car.id}
                      type="button"
                      className={`admin-car-list-item ${String(car.id) === String(selectedId) ? 'active' : ''}`}
                      onClick={() => setSelectedId(String(car.id))}
                    >
                      <span>{car.name}</span>
                      <span>{car.year_introduced}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </aside>

          <form className="admin-form-card" onSubmit={handleSave}>
            <h2 className="admin-section-heading">{t.adminPanel.editor}</h2>

            {selectedCar && (
              <div className="admin-preview-meta">
                <img src={imagePreview || getCarImage(selectedCar)} alt={selectedCar.name} className="admin-preview-image" />
                <div>
                  <p className="admin-preview-title">{selectedCar.brand_name} {selectedCar.name}</p>
                  <p className="admin-preview-sub">{selectedCar.year_introduced} • {selectedCar.vehicle_type}</p>
                </div>
                <div className="admin-preview-actions">
                  <button
                    type="button"
                    className={`admin-inline-toggle admin-inline-gear ${isImageEditorOpen ? 'is-open' : ''}`}
                    onClick={() => setIsImageEditorOpen((prev) => !prev)}
                    aria-expanded={isImageEditorOpen}
                    aria-label={isImageEditorOpen ? t.adminPanel.hideImageEditor : t.adminPanel.editImage}
                    title={isImageEditorOpen ? t.adminPanel.hideImageEditor : t.adminPanel.editImage}
                  >
                    <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <p className="admin-section-caption">{t.adminInline.sectionBasics}</p>
            <div className="admin-form-grid">
              <div>
                <label className="form-label" htmlFor="year">{t.pages.year}</label>
                <input
                  id="year"
                  type="number"
                  className="form-input"
                  value={yearIntroduced}
                  onChange={(e) => setYearIntroduced(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="type">{t.pages.type}</label>
                <select id="type" className="form-input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="crossover">Crossover</option>
                  <option value="hatchback">Hatchback</option>
                  <option value="coupe">Coupe</option>
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <label className="form-label" htmlFor="description">{t.adminPanel.description}</label>
            <textarea
              id="description"
              className="form-input form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />

            <p className="admin-section-caption">{t.pages.sectionPerformance}</p>
            <div className="admin-form-grid">
              <div>
                <label className="form-label" htmlFor="engine">{t.pages.engine}</label>
                <input id="engine" className="form-input" value={engineType} onChange={(e) => setEngineType(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="hp">{t.pages.horsepower}</label>
                <input id="hp" type="number" className="form-input" value={horsepower} onChange={(e) => setHorsepower(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="acc">{t.pages.acceleration}</label>
                <input id="acc" className="form-input" value={acceleration} onChange={(e) => setAcceleration(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="top">{t.pages.topSpeed}</label>
                <input id="top" type="number" className="form-input" value={topSpeed} onChange={(e) => setTopSpeed(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="fuel">{t.pages.fuelConsumption}</label>
                <input id="fuel" className="form-input" value={fuelConsumption} onChange={(e) => setFuelConsumption(e.target.value)} />
              </div>
            </div>

            <p className="admin-section-caption">{t.pages.sectionMarket}</p>
            <div className="admin-form-grid">
              <div>
                <label className="form-label" htmlFor="price-min">{t.adminPanel.priceMinK}</label>
                <input
                  id="price-min"
                  type="number"
                  className="form-input"
                  value={priceMinK}
                  onChange={(e) => setPriceMinK(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="price-max">{t.adminPanel.priceMaxK}</label>
                <input
                  id="price-max"
                  type="number"
                  className="form-input"
                  value={priceMaxK}
                  onChange={(e) => setPriceMaxK(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label form-label-help" htmlFor="base-currency">
                  <span>{t.adminPanel.baseCurrency}</span>
                  <span
                    className="admin-help-tip"
                    tabIndex={0}
                    aria-label={t.adminPanel.currencyTooltipAria}
                    data-tooltip={t.adminPanel.currencyTooltip}
                  >
                    i
                  </span>
                </label>
                <select
                  id="base-currency"
                  className="form-input"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                >
                  {CURRENCY_KEYS.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="form-label form-label-help">
                  <span>{t.adminPanel.targetCurrencies}</span>
                  <span
                    className="admin-help-tip"
                    tabIndex={0}
                    aria-label={t.adminPanel.currencyTooltipAria}
                    data-tooltip={t.adminPanel.currencyTooltip}
                  >
                    i
                  </span>
                </p>
                <div className="admin-currency-grid">
                  {CURRENCY_KEYS.map((currency) => (
                    <label key={currency} className="form-checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedCurrencies.includes(currency)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCurrencies((prev) => [...prev, currency])
                          } else {
                            setSelectedCurrencies((prev) => prev.filter((item) => item !== currency))
                          }
                        }}
                      />
                      {currency}
                    </label>
                  ))}
                </div>
              </div>

              <div className="admin-form-grid-full">
                <label className="form-label form-label-help" htmlFor="price-preview">
                  <span>{t.adminPanel.pricePreview}</span>
                  <span
                    className="admin-help-tip"
                    tabIndex={0}
                    aria-label={t.adminPanel.currencyTooltipAria}
                    data-tooltip={t.adminPanel.currencyTooltip}
                  >
                    i
                  </span>
                </label>
                <input
                  id="price-preview"
                  className="form-input"
                  value={generatedPriceRange}
                  readOnly
                />
              </div>

              <div>
                <label className="form-label" htmlFor="status">{t.pages.productionStatus}</label>
                <select
                  id="status"
                  className="form-input"
                  value={productionStatus}
                  onChange={(e) => setProductionStatus(e.target.value)}
                >
                  <option value="active">{t.pages.statusActive}</option>
                  <option value="discontinued">{t.pages.statusDiscontinued}</option>
                  <option value="upcoming">{t.pages.statusUpcoming}</option>
                </select>
              </div>
            </div>

            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              {t.adminPanel.featured}
            </label>

            {isImageEditorOpen && (
              <>
                <p className="admin-section-caption">{t.adminPanel.imageEditorTitle}</p>

                <label className="form-label" htmlFor="image">{t.adminPanel.image}</label>
                <input
                  id="image"
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setImageFile(file)
                    if (file) {
                      setImagePreview(URL.createObjectURL(file))
                    } else if (selectedCar) {
                      setImagePreview(getCarImage(selectedCar))
                    }
                  }}
                />

                <label className="form-label" htmlFor="brand-logo">{t.adminPanel.brandLogo}</label>
                <input
                  id="brand-logo"
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setBrandLogoFile(file)
                    if (file) {
                      setBrandLogoPreview(URL.createObjectURL(file))
                    } else if (selectedCar) {
                      setBrandLogoPreview(resolveMediaUrl(selectedCar.brand?.logo || ''))
                    }
                  }}
                />
                {brandLogoPreview && (
                  <img
                    src={brandLogoPreview}
                    alt={t.adminPanel.brandLogo}
                    className="admin-brand-logo-preview"
                  />
                )}
              </>
            )}

            {message && <p className="form-success">{message}</p>}
            {error && <p className="form-error">{error}</p>}

            <div className="admin-actions-row">
              <button type="button" className="btn btn-secondary" onClick={handleReset}>
                {t.adminPanel.reset}
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t.pages.loading : t.adminPanel.save}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="admin-form-card admin-collapsible-card">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsCreateBrandSectionOpen((prev) => !prev)}
          aria-expanded={isCreateBrandSectionOpen}
          aria-controls="admin-create-brand-content"
        >
          <h2 className="admin-section-heading">{t.adminPanel.createBrandTitle}</h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isCreateBrandSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isCreateBrandSectionOpen && (
          <div id="admin-create-brand-content">
            <p className="admin-subtitle">{t.adminPanel.createBrandSubtitle}</p>

            <form onSubmit={handleCreateBrand}>
          <div className="admin-form-grid">
            <div>
              <label className="form-label" htmlFor="new-brand-name">{t.adminPanel.brandName}</label>
              <input
                id="new-brand-name"
                className="form-input"
                value={newBrandName}
                onChange={(e) => {
                  const value = e.target.value
                  setNewBrandName(value)
                  setNewBrandSlug((prev) => (prev.trim() ? prev : toSlug(value)))
                }}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-brand-slug">{t.adminPanel.brandSlug}</label>
              <input
                id="new-brand-slug"
                className="form-input"
                value={newBrandSlug}
                onChange={(e) => setNewBrandSlug(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-brand-year">{t.pages.brandFounded}</label>
              <input
                id="new-brand-year"
                type="number"
                className="form-input"
                value={newBrandYear}
                onChange={(e) => setNewBrandYear(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-brand-website">{t.pages.brandWebsite}</label>
              <input
                id="new-brand-website"
                className="form-input"
                value={newBrandWebsite}
                onChange={(e) => setNewBrandWebsite(e.target.value)}
              />
            </div>

            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="new-brand-description-en">{t.adminPanel.descriptionEn}</label>
              <textarea
                id="new-brand-description-en"
                className="form-input form-textarea"
                rows={3}
                value={newBrandDescriptionEn}
                onChange={(e) => setNewBrandDescriptionEn(e.target.value)}
              />
            </div>

            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="new-brand-description-pl">{t.adminPanel.descriptionPl}</label>
              <textarea
                id="new-brand-description-pl"
                className="form-input form-textarea"
                rows={3}
                value={newBrandDescriptionPl}
                onChange={(e) => setNewBrandDescriptionPl(e.target.value)}
              />
            </div>
          </div>

            {createBrandMessage && <p className="form-success">{createBrandMessage}</p>}
            {createBrandError && <p className="form-error">{createBrandError}</p>}

            <div className="admin-actions-row">
              <button type="submit" className="btn btn-primary" disabled={creatingBrand}>
                {creatingBrand ? t.pages.loading : t.adminPanel.createBrand}
              </button>
            </div>
            </form>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsManageReviewsSectionOpen((prev) => !prev)}
          aria-expanded={isManageReviewsSectionOpen}
          aria-controls="admin-manage-reviews-content"
        >
          <h2 className="admin-section-heading">{t.adminPanel.manageReviewsTitle}</h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isManageReviewsSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isManageReviewsSectionOpen && (
          <div id="admin-manage-reviews-content">
            <p className="admin-subtitle">{t.adminPanel.manageReviewsSubtitle}</p>

            <div className="admin-actions-row" style={{ justifyContent: 'flex-start', marginTop: '0.85rem' }}>
              <button type="button" className="btn btn-secondary" onClick={loadPressReviews} disabled={reviewsLoading}>
                {reviewsLoading ? t.pages.loading : t.adminPanel.refreshReviews}
              </button>
            </div>

            {reviewsMessage && <p className="form-success">{reviewsMessage}</p>}
            {reviewsError && <p className="form-error">{reviewsError}</p>}

            <div className="admin-review-list">
              {!reviewsLoading && pressReviews.length === 0 && (
                <p className="admin-meta">{t.adminPanel.noReviewsToManage}</p>
              )}

              {pressReviews.map((review) => (
                <article key={review.id} className="admin-review-card">
                  <div className="admin-review-card-head">
                    <div>
                      <h3 className="admin-review-title">{review.title}</h3>
                      <p className="admin-meta">{review.car_brand_name} {review.car_name} • {review.publication_name} • {String(review.category || 'test').toUpperCase()} {review.is_pinned ? '• PINNED' : ''}</p>
                    </div>
                    <div className="admin-actions-row">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleEditReview(review.id)}
                      >
                        {t.adminPanel.editReview}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleDeleteReview(review.id)}
                      >
                        {t.adminPanel.deleteReview}
                      </button>
                    </div>
                  </div>

                  {editingReviewId === review.id && reviewEditDraft && (
                    <div className="admin-review-edit-grid">
                      <div className="admin-form-grid">
                        <div>
                          <label className="form-label" htmlFor={`edit-review-car-${review.id}`}>{t.adminPanel.chooseModel}</label>
                          <select
                            id={`edit-review-car-${review.id}`}
                            className="form-input"
                            value={reviewEditDraft.car_model}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, car_model: e.target.value }))}
                          >
                            {cars.map((car) => (
                              <option key={car.id} value={car.id}>{car.brand_name} {car.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="form-label" htmlFor={`edit-review-title-${review.id}`}>{t.pages.opinionTitle}</label>
                          <input
                            id={`edit-review-title-${review.id}`}
                            className="form-input"
                            value={reviewEditDraft.title}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="form-label" htmlFor={`edit-review-publication-${review.id}`}>{t.adminPanel.reviewPublication}</label>
                          <input
                            id={`edit-review-publication-${review.id}`}
                            className="form-input"
                            value={reviewEditDraft.publication_name}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, publication_name: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="form-label" htmlFor={`edit-review-author-${review.id}`}>{t.adminPanel.reviewAuthor}</label>
                          <input
                            id={`edit-review-author-${review.id}`}
                            className="form-input"
                            value={reviewEditDraft.author_name}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, author_name: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="form-label" htmlFor={`edit-review-date-${review.id}`}>{t.adminPanel.reviewDate}</label>
                          <input
                            id={`edit-review-date-${review.id}`}
                            type="date"
                            className="form-input"
                            value={reviewEditDraft.published_at}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, published_at: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="form-label" htmlFor={`edit-review-slug-${review.id}`}>Slug</label>
                          <input
                            id={`edit-review-slug-${review.id}`}
                            className="form-input"
                            value={reviewEditDraft.slug}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, slug: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="form-label" htmlFor={`edit-review-category-${review.id}`}>Category</label>
                          <select
                            id={`edit-review-category-${review.id}`}
                            className="form-input"
                            value={reviewEditDraft.category}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, category: e.target.value }))}
                          >
                            <option value="test">Test</option>
                            <option value="news">News</option>
                            <option value="guide">Guide</option>
                            <option value="opinion">Opinion</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label" htmlFor={`edit-review-reading-time-${review.id}`}>Reading time (min)</label>
                          <input
                            id={`edit-review-reading-time-${review.id}`}
                            type="number"
                            min="0"
                            className="form-input"
                            value={reviewEditDraft.reading_time_minutes}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, reading_time_minutes: e.target.value }))}
                          />
                        </div>

                        <div className="admin-form-grid-full">
                          <label className="form-label" htmlFor={`edit-review-tags-${review.id}`}>Tags (comma separated)</label>
                          <input
                            id={`edit-review-tags-${review.id}`}
                            className="form-input"
                            value={reviewEditDraft.tags}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, tags: e.target.value }))}
                          />
                        </div>

                        <div className="admin-form-grid-full">
                          <label className="form-label" htmlFor={`edit-review-summary-${review.id}`}>{t.adminPanel.reviewSummary}</label>
                          <textarea
                            id={`edit-review-summary-${review.id}`}
                            className="form-input form-textarea"
                            rows={3}
                            value={reviewEditDraft.summary}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, summary: e.target.value }))}
                          />
                        </div>

                        <div className="admin-form-grid-full">
                          <RichTextEditor
                            id={`edit-review-overview-${review.id}`}
                            label="Overview"
                            rows={4}
                            value={reviewEditDraft._structured?.overview || ''}
                            onChange={(nextValue) => setReviewEditDraft((prev) => ({
                              ...prev,
                              _structured: { ...prev._structured, overview: nextValue },
                            }))}
                          />
                        </div>

                        <div className="admin-form-grid-full review-struct-section">
                          <label className="form-label">Photo URLs</label>
                          {[0, 1, 2].map((i) => (
                            <input
                              key={i}
                              type="url"
                              className="form-input"
                              placeholder={`Photo ${i + 1} URL`}
                              value={reviewEditDraft._structured?.images?.[i] || ''}
                              onChange={(e) => {
                                const imgs = [...(reviewEditDraft._structured?.images || ['', '', ''])]
                                imgs[i] = e.target.value
                                setReviewEditDraft((prev) => ({ ...prev, _structured: { ...prev._structured, images: imgs } }))
                              }}
                            />
                          ))}
                        </div>

                        <div className="admin-form-grid-full review-struct-section">
                          <label className="form-label">Test Results</label>
                          {(reviewEditDraft._structured?.testResults || []).map((row, i) => (
                            <div key={i} className="review-result-row">
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Metric (e.g. 0-100 km/h)"
                                value={row.key}
                                onChange={(e) => {
                                  const rows = [...(reviewEditDraft._structured?.testResults || [])]
                                  rows[i] = { ...rows[i], key: e.target.value }
                                  setReviewEditDraft((prev) => ({ ...prev, _structured: { ...prev._structured, testResults: rows } }))
                                }}
                              />
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Value (e.g. 5.8 s)"
                                value={row.value}
                                onChange={(e) => {
                                  const rows = [...(reviewEditDraft._structured?.testResults || [])]
                                  rows[i] = { ...rows[i], value: e.target.value }
                                  setReviewEditDraft((prev) => ({ ...prev, _structured: { ...prev._structured, testResults: rows } }))
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  const rows = (reviewEditDraft._structured?.testResults || []).filter((_, idx) => idx !== i)
                                  setReviewEditDraft((prev) => ({ ...prev, _structured: { ...prev._structured, testResults: rows.length ? rows : [{ key: '', value: '' }] } }))
                                }}
                              >✕</button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: '0.4rem', alignSelf: 'flex-start' }}
                            onClick={() => setReviewEditDraft((prev) => ({ ...prev, _structured: { ...prev._structured, testResults: [...(prev._structured?.testResults || []), { key: '', value: '' }] } }))}
                          >+ Add row</button>
                        </div>

                        <div className="admin-form-grid-full">
                          <RichTextEditor
                            id={`edit-review-verdict-${review.id}`}
                            label="Verdict"
                            rows={4}
                            value={reviewEditDraft._structured?.verdict || ''}
                            onChange={(nextValue) => setReviewEditDraft((prev) => ({
                              ...prev,
                              _structured: { ...prev._structured, verdict: nextValue },
                            }))}
                          />
                        </div>

                        <div className="admin-form-grid-full">
                          <RichTextEditor
                            id={`edit-review-notes-${review.id}`}
                            label="Internal notes (admin only)"
                            rows={4}
                            value={reviewEditDraft.internal_notes}
                            onChange={(nextValue) => setReviewEditDraft((prev) => ({ ...prev, internal_notes: nextValue }))}
                          />
                        </div>
                      </div>

                      <div className="admin-actions-row" style={{ justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const builtContent = buildContentFromStructured(reviewEditDraft._structured || parseContentToStructured(reviewEditDraft.content || ''))
                            setReviewEditDraft((prev) => ({
                              ...prev,
                              reading_time_minutes: String(estimateReadingTimeMinutes(`${prev.summary} ${builtContent}`)),
                              slug: prev.slug || toSlug(prev.title),
                            }))
                          }}
                        >
                          Auto calculate tools
                        </button>
                      </div>

                      <label className="form-checkbox-row">
                        <input
                          type="checkbox"
                          checked={reviewEditDraft.is_featured}
                          onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, is_featured: e.target.checked }))}
                        />
                        {t.adminPanel.reviewFeatured}
                      </label>

                      <label className="form-checkbox-row">
                        <input
                          type="checkbox"
                          checked={reviewEditDraft.is_pinned}
                          onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, is_pinned: e.target.checked }))}
                        />
                        Pin article at top
                      </label>

                      <label className="form-checkbox-row">
                        <input
                          type="checkbox"
                          checked={reviewEditDraft.is_published}
                          onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, is_published: e.target.checked }))}
                        />
                        {t.adminPanel.reviewPublished}
                      </label>

                      <div className="admin-actions-row">
                        <button type="button" className="btn btn-secondary" onClick={handleCancelReviewEdit}>
                          {t.adminPanel.cancelEdit}
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => handleSaveReviewEdit(review.id)}>
                          {t.adminPanel.saveReviewChanges}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsCreateReviewSectionOpen((prev) => !prev)}
          aria-expanded={isCreateReviewSectionOpen}
          aria-controls="admin-create-review-content"
        >
          <h2 className="admin-section-heading">{t.adminPanel.createReviewTitle}</h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isCreateReviewSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isCreateReviewSectionOpen && (
          <div id="admin-create-review-content">
            <p className="admin-subtitle">{t.adminPanel.createReviewSubtitle}</p>

            <form onSubmit={handleCreateReview}>
              <div className="admin-form-grid">
                <div>
                  <label className="form-label" htmlFor="new-review-car">{t.adminPanel.chooseModel}</label>
                  <select
                    id="new-review-car"
                    className="form-input"
                    value={newReviewCarId}
                    onChange={(e) => setNewReviewCarId(e.target.value)}
                  >
                    {cars.map((car) => (
                      <option key={car.id} value={car.id}>{car.brand_name} {car.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" htmlFor="new-review-title">{t.pages.opinionTitle}</label>
                  <input
                    id="new-review-title"
                    className="form-input"
                    value={newReviewTitle}
                    onChange={(e) => {
                      const value = e.target.value
                      setNewReviewTitle(value)
                      if (!newReviewSlug.trim()) setNewReviewSlug(toSlug(value))
                    }}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="new-review-publication">{t.adminPanel.reviewPublication}</label>
                  <input
                    id="new-review-publication"
                    className="form-input"
                    value={newReviewPublication}
                    onChange={(e) => setNewReviewPublication(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="new-review-author">{t.adminPanel.reviewAuthor}</label>
                  <input
                    id="new-review-author"
                    className="form-input"
                    value={newReviewAuthor}
                    onChange={(e) => setNewReviewAuthor(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="new-review-date">{t.adminPanel.reviewDate}</label>
                  <input
                    id="new-review-date"
                    type="date"
                    className="form-input"
                    value={newReviewPublishedAt}
                    onChange={(e) => setNewReviewPublishedAt(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="new-review-slug">Slug</label>
                  <input
                    id="new-review-slug"
                    className="form-input"
                    value={newReviewSlug}
                    onChange={(e) => setNewReviewSlug(e.target.value)}
                    placeholder="auto-from-title"
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="new-review-category">Category</label>
                  <select
                    id="new-review-category"
                    className="form-input"
                    value={newReviewCategory}
                    onChange={(e) => setNewReviewCategory(e.target.value)}
                  >
                    <option value="test">Test</option>
                    <option value="news">News</option>
                    <option value="guide">Guide</option>
                    <option value="opinion">Opinion</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" htmlFor="new-review-reading-time">Reading time (min)</label>
                  <input
                    id="new-review-reading-time"
                    type="number"
                    min="0"
                    className="form-input"
                    value={newReviewReadingTime}
                    onChange={(e) => setNewReviewReadingTime(e.target.value)}
                  />
                </div>

                <div className="admin-form-grid-full">
                  <label className="form-label" htmlFor="new-review-tags">Tags (comma separated)</label>
                  <input
                    id="new-review-tags"
                    className="form-input"
                    value={newReviewTags}
                    onChange={(e) => setNewReviewTags(e.target.value)}
                    placeholder="battery, range, comfort"
                  />
                </div>

                <div className="admin-form-grid-full">
                  <label className="form-label" htmlFor="new-review-summary">{t.adminPanel.reviewSummary}</label>
                  <textarea
                    id="new-review-summary"
                    className="form-input form-textarea"
                    rows={3}
                    value={newReviewSummary}
                    onChange={(e) => setNewReviewSummary(e.target.value)}
                  />
                </div>

                <div className="admin-form-grid-full">
                  <RichTextEditor
                    id="new-review-overview"
                    label="Overview"
                    rows={4}
                    value={newReviewOverview}
                    onChange={setNewReviewOverview}
                  />
                </div>

                <div className="admin-form-grid-full review-struct-section">
                  <label className="form-label">Photo URLs</label>
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      type="url"
                      className="form-input"
                      placeholder={`Photo ${i + 1} URL`}
                      value={newReviewImages[i]}
                      onChange={(e) => {
                        const imgs = [...newReviewImages]
                        imgs[i] = e.target.value
                        setNewReviewImages(imgs)
                      }}
                    />
                  ))}
                </div>

                <div className="admin-form-grid-full review-struct-section">
                  <label className="form-label">Test Results</label>
                  {newReviewTestResults.map((row, i) => (
                    <div key={i} className="review-result-row">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Metric (e.g. 0-100 km/h)"
                        value={row.key}
                        onChange={(e) => {
                          const rows = [...newReviewTestResults]
                          rows[i] = { ...rows[i], key: e.target.value }
                          setNewReviewTestResults(rows)
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Value (e.g. 5.8 s)"
                        value={row.value}
                        onChange={(e) => {
                          const rows = [...newReviewTestResults]
                          rows[i] = { ...rows[i], value: e.target.value }
                          setNewReviewTestResults(rows)
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const rows = newReviewTestResults.filter((_, idx) => idx !== i)
                          setNewReviewTestResults(rows.length ? rows : [{ key: '', value: '' }])
                        }}
                      >✕</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '0.4rem', alignSelf: 'flex-start' }}
                    onClick={() => setNewReviewTestResults((prev) => [...prev, { key: '', value: '' }])}
                  >+ Add row</button>
                </div>

                <div className="admin-form-grid-full">
                  <RichTextEditor
                    id="new-review-verdict"
                    label="Verdict"
                    rows={4}
                    value={newReviewVerdict}
                    onChange={setNewReviewVerdict}
                  />
                </div>

                <div className="admin-form-grid-full">
                  <RichTextEditor
                    id="new-review-internal-notes"
                    label="Internal notes (admin only)"
                    rows={4}
                    value={newReviewInternalNotes}
                    onChange={setNewReviewInternalNotes}
                  />
                </div>
              </div>

              <div className="admin-actions-row" style={{ justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const builtContent = buildContentFromStructured({
                      overview: newReviewOverview,
                      images: newReviewImages,
                      testResults: newReviewTestResults,
                      verdict: newReviewVerdict,
                    })
                    setNewReviewReadingTime(String(estimateReadingTimeMinutes(`${newReviewSummary} ${builtContent}`)))
                    if (!newReviewSlug.trim()) setNewReviewSlug(toSlug(newReviewTitle))
                  }}
                >
                  Auto calculate tools
                </button>
              </div>

              <label className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={newReviewFeatured}
                  onChange={(e) => setNewReviewFeatured(e.target.checked)}
                />
                {t.adminPanel.reviewFeatured}
              </label>

              <label className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={newReviewPinned}
                  onChange={(e) => setNewReviewPinned(e.target.checked)}
                />
                Pin article at top
              </label>

              <label className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={newReviewPublished}
                  onChange={(e) => setNewReviewPublished(e.target.checked)}
                />
                {t.adminPanel.reviewPublished}
              </label>

              {createReviewMessage && <p className="form-success">{createReviewMessage}</p>}
              {createReviewError && <p className="form-error">{createReviewError}</p>}

              <div className="admin-actions-row">
                <button type="submit" className="btn btn-primary" disabled={creatingReview}>
                  {creatingReview ? t.pages.loading : t.adminPanel.createReview}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsCreateModelSectionOpen((prev) => !prev)}
          aria-expanded={isCreateModelSectionOpen}
          aria-controls="admin-create-model-content"
        >
          <h2 className="admin-section-heading">{t.adminPanel.createModelTitle}</h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isCreateModelSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isCreateModelSectionOpen && (
          <div id="admin-create-model-content">
                            onChange={(e) => setReviewEditDraft((prev) => ({
                              ...prev,
                              title: e.target.value,
                              slug: prev.slug || toSlug(e.target.value),
                            }))}

            <form onSubmit={handleCreateModel}>
          <div className="admin-form-grid">
            <div>
              <label className="form-label" htmlFor="new-model-brand">{t.adminPanel.chooseBrand}</label>
              <select
                id="new-model-brand"
                className="form-input"
                value={newModelBrandId}
                onChange={(e) => setNewModelBrandId(e.target.value)}
              >
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="new-model-name">{t.adminInline.modelName}</label>
              <input
                id="new-model-name"
                className="form-input"
                value={newModelName}
                onChange={(e) => {
                  const value = e.target.value
                  setNewModelName(value)
                  setNewModelSlug((prev) => (prev.trim() ? prev : toSlug(value)))
                }}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-model-slug">{t.adminPanel.modelSlug}</label>
              <input
                id="new-model-slug"
                className="form-input"
                value={newModelSlug}
                onChange={(e) => setNewModelSlug(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-model-year">{t.pages.year}</label>
              <input
                id="new-model-year"
                type="number"
                className="form-input"
                value={newModelYear}
                onChange={(e) => setNewModelYear(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-model-type">{t.pages.type}</label>
              <select
                id="new-model-type"
                className="form-input"
                value={newModelType}
                onChange={(e) => setNewModelType(e.target.value)}
              >
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="crossover">Crossover</option>
                <option value="hatchback">Hatchback</option>
                <option value="coupe">Coupe</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="new-model-engine">{t.pages.engine}</label>
              <input
                id="new-model-engine"
                className="form-input"
                value={newModelEngine}
                onChange={(e) => setNewModelEngine(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-model-price">{t.adminInline.priceRange}</label>
              <input
                id="new-model-price"
                className="form-input"
                value={newModelPriceRange}
                onChange={(e) => setNewModelPriceRange(e.target.value)}
                placeholder="$20k-$35k"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-model-status">{t.pages.productionStatus}</label>
              <select
                id="new-model-status"
                className="form-input"
                value={newModelStatus}
                onChange={(e) => setNewModelStatus(e.target.value)}
              >
                <option value="active">{t.pages.statusActive}</option>
                <option value="discontinued">{t.pages.statusDiscontinued}</option>
                <option value="upcoming">{t.pages.statusUpcoming}</option>
              </select>
            </div>

            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="new-model-description">{t.adminPanel.description}</label>
              <textarea
                id="new-model-description"
                className="form-input form-textarea"
                rows={4}
                value={newModelDescription}
                onChange={(e) => setNewModelDescription(e.target.value)}
              />
            </div>
          </div>

            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={newModelFeatured}
                onChange={(e) => setNewModelFeatured(e.target.checked)}
              />
              {t.adminInline.featured}
            </label>

            {createModelMessage && <p className="form-success">{createModelMessage}</p>}
            {createModelError && <p className="form-error">{createModelError}</p>}

            <div className="admin-actions-row">
              <button type="submit" className="btn btn-primary" disabled={creatingModel}>
                {creatingModel ? t.pages.loading : t.adminPanel.createModel}
              </button>
            </div>
            </form>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsHeaderSectionOpen((prev) => !prev)}
          aria-expanded={isHeaderSectionOpen}
          aria-controls="admin-header-settings-content"
        >
          <h2 className="admin-section-heading">{t.adminPanel.headerSettingsTitle}</h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isHeaderSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isHeaderSectionOpen && (
          <div id="admin-header-settings-content">
            <p className="admin-subtitle">{t.adminPanel.headerSettingsSubtitle}</p>

            <div className="admin-form-grid">
          <div>
            <label className="form-label" htmlFor="header-lang">{t.adminPanel.textLanguage}</label>
            <select
              id="header-lang"
              className="form-input"
              value={headerLang}
              onChange={(e) => setHeaderLang(e.target.value)}
            >
              <option value="en">English</option>
              <option value="pl">Polski</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="header-title">{t.adminPanel.headerTitle}</label>
            <input
              id="header-title"
              className="form-input"
              value={headerTitle}
              onChange={(e) => setHeaderTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="header-icon">{t.adminPanel.headerIcon}</label>
            <input
              id="header-icon"
              className="form-input"
              value={headerIcon}
              onChange={(e) => setHeaderIcon(e.target.value)}
              placeholder="🚗"
            />
          </div>

          <div className="admin-form-grid-full">
            <label className="form-label" htmlFor="header-logo-url">{t.adminPanel.headerLogoUrl}</label>
            <input
              id="header-logo-url"
              className="form-input"
              value={headerLogoUrl}
              onChange={(e) => setHeaderLogoUrl(e.target.value)}
              placeholder="/media/site-logo.png"
            />
            <p className="admin-field-note">{t.adminPanel.headerLogoHint}</p>
          </div>

          <div>
            <label className="form-label" htmlFor="header-logo-file">{t.adminPanel.headerLogoFile}</label>
            <input
              id="header-logo-file"
              type="file"
              accept="image/*"
              className="form-input"
              onChange={handleHeaderLogoFileChange}
            />
          </div>

          <div>
            <label className="form-label">{t.adminPanel.headerLogoActions}</label>
            <button
              type="button"
              className="btn btn-secondary admin-inline-action-btn"
              onClick={() => {
                setHeaderLogoUrl('')
                setHeaderLogoFile(null)
                setHeaderLogoFilePreview('')
              }}
            >
              {t.adminPanel.headerLogoClear}
            </button>
          </div>

          <div className="admin-form-grid-full">
            <p className="form-label">{t.adminPanel.headerPreview}</p>
            <div className="admin-header-preview">
              {headerLogoFilePreview || headerLogoPreview ? (
                <img src={headerLogoFilePreview || headerLogoPreview} alt={headerTitle || t.adminPanel.headerTitle} className="brand-logo-image" />
              ) : (
                <span className="brand-logo-mark" aria-hidden="true">{headerIcon || '🚗'}</span>
              )}
              <span>{headerTitle || t.adminPanel.headerTitle}</span>
            </div>
          </div>
            </div>

            {headerMessage && <p className="form-success">{headerMessage}</p>}
            {headerError && <p className="form-error">{headerError}</p>}

            <div className="admin-actions-row">
              <button type="button" className="btn btn-secondary" onClick={handleResetHeader}>
                {t.adminPanel.reset}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={headerSaving}
                onClick={handleSaveHeader}
              >
                {headerSaving ? t.pages.loading : t.adminPanel.headerSave}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsFooterSectionOpen((prev) => !prev)}
          aria-expanded={isFooterSectionOpen}
          aria-controls="admin-footer-settings-content"
        >
          <h2 className="admin-section-heading">{t.adminPanel.footerSettingsTitle}</h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isFooterSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isFooterSectionOpen && (
          <div id="admin-footer-settings-content">
            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="footer-email">Email Address</label>
              <input
                id="footer-email"
                className="form-input"
                value={footerEmail}
                onChange={(e) => setFooterEmail(e.target.value)}
                placeholder="Email: info@example.com"
              />
            </div>

            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="footer-phone">Phone Number</label>
              <input
                id="footer-phone"
                className="form-input"
                value={footerPhone}
                onChange={(e) => setFooterPhone(e.target.value)}
                placeholder="Phone: +1 (555) 123-4567"
              />
            </div>

            {footerMessage && <p className="form-success">{footerMessage}</p>}
            {footerError && <p className="form-error">{footerError}</p>}

            <div className="admin-form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={footerSaving}
                onClick={handleSaveFooter}
              >
                {footerSaving ? t.pages.loading : t.adminPanel.footerSave}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsTextManagerSectionOpen((prev) => !prev)}
          aria-expanded={isTextManagerSectionOpen}
          aria-controls="admin-text-manager-content"
        >
          <h2 className="admin-section-heading">{t.adminPanel.textManagerTitle}</h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isTextManagerSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isTextManagerSectionOpen && (
          <div id="admin-text-manager-content">
            <p className="admin-subtitle">{t.adminPanel.textManagerSubtitle}</p>

            <div className="admin-form-grid">
              <div>
                <label className="form-label" htmlFor="content-lang">{t.adminPanel.textLanguage}</label>
                <select
                  id="content-lang"
                  className="form-input"
                  value={contentLang}
                  onChange={(e) => setContentLang(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="pl">Polski</option>
                </select>
              </div>

              <div>
                <label className="form-label" htmlFor="content-key">{t.adminPanel.textKey}</label>
                <select
                  id="content-key"
                  className="form-input"
                  value={contentKey}
                  onChange={(e) => setContentKey(e.target.value)}
                >
                  {contentKeys.map((keyPath) => (
                    <option key={keyPath} value={keyPath}>{keyPath}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-grid-full">
                <label className="form-label" htmlFor="content-base">{t.adminPanel.textBaseValue}</label>
                <input id="content-base" className="form-input" value={String(baseContentValue)} readOnly />
              </div>

              <div className="admin-form-grid-full">
                <label className="form-label" htmlFor="content-value">{t.adminPanel.textValue}</label>
                <textarea
                  id="content-value"
                  className="form-input form-textarea"
                  rows={4}
                  value={contentValue}
                  onChange={(e) => setContentValue(e.target.value)}
                />
              </div>
            </div>

            {contentMessage && <p className="form-success">{contentMessage}</p>}
            {contentError && <p className="form-error">{contentError}</p>}

            <div className="admin-actions-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={contentSaving}
                onClick={handleSaveContent}
              >
                {contentSaving ? t.pages.loading : t.adminPanel.textSave}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
