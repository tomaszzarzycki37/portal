import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link, useParams } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { normalizeMediaUrl } from '../utils/mediaUrl'
import { canEditByAuthorId, isAdminUser, isAuthenticatedUser } from '../utils/auth'
import DetailedOpinionCard from '../components/DetailedOpinionCard'
import DetailedOpinionForm from '../components/DetailedOpinionForm'
import {
  buildEmptyDetailedRatings,
  buildOpinionDraftFromApi,
  buildOpinionPayload,
  validateOpinionDraft,
} from '../constants/opinionRatings'
import { getSafeOverviewValue, parseReviewContent } from '../utils/reviewContent'

function createEmptyOpinionDraft() {
  return {
    title: '',
    content: '',
    detailed_ratings: buildEmptyDetailedRatings(),
    fuel_consumption_min: '',
    fuel_consumption_max: '',
  }
}

const WORD_LIKE_MODULES = {
  toolbar: [
    [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['blockquote', 'code-block'],
    ['link', 'clean'],
  ],
}

const WORD_LIKE_FORMATS = [
  'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'align', 'list', 'bullet', 'indent',
  'blockquote', 'code-block',
  'link',
]

function sanitizeRichHtml(value) {
  return DOMPurify.sanitize(decodeHtmlEntities(value))
}

function getReviewSummaryHtml(review) {
  const summary = String(review?.summary || '').trim()
  if (summary) {
    return sanitizeRichHtml(summary)
  }

  const rawContent = String(review?.content || '').trim()
  if (!rawContent) return ''

  const parsed = parseReviewContent(rawContent)
  const overview = getSafeOverviewValue(parsed.overview, '')
  if (overview) {
    return sanitizeRichHtml(overview)
  }

  if (/<\/?[a-z][\s\S]*>/i.test(rawContent)) {
    return sanitizeRichHtml(rawContent)
  }

  return sanitizeRichHtml(getMeaningfulRichText(rawContent))
}

function decodeHtmlEntities(value) {
  if (!value) return ''
  const textarea = document.createElement('textarea')
  textarea.innerHTML = String(value)
  return textarea.value
}

function getMeaningfulRichText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getReviewPreviewImage(review) {
  const rawContent = String(review?.content || '').trim()
  const normalizeExtractedUrl = (value) => {
    const cleaned = String(value || '')
      .trim()
      .replace(/^['"(<\[]+/, '')
      .replace(/[)'"\],.;!?]+$/, '')
    return cleaned ? normalizeMediaUrl(cleaned) : ''
  }

  if (rawContent.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawContent)
      const fromJson = [
        ...(Array.isArray(parsed?.images) ? parsed.images : []),
        ...(Array.isArray(parsed?.secondImages) ? parsed.secondImages : []),
        ...(Array.isArray(parsed?.imagesAfterTests) ? parsed.imagesAfterTests : []),
      ].find((url) => String(url || '').trim())
      if (fromJson) return normalizeExtractedUrl(fromJson)
    } catch {
      // Fall through to line-based extraction.
    }
  }

  const match = rawContent.match(/(?:https?:\/\/[^\s]+|\/media\/[^\s]+)/i)
  return match ? normalizeExtractedUrl(match[0]) : ''
}

function RichTextEditor({ id, label, value, onChange, placeholder }) {
  return (
    <div className="admin-rich-editor admin-rich-editor-compact">
      <label className="form-label" htmlFor={id}>{label}</label>
      <ReactQuill
        id={id}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={WORD_LIKE_MODULES}
        formats={WORD_LIKE_FORMATS}
        placeholder={placeholder}
      />
    </div>
  )
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

function formatRatingDisplay(value) {
  const numeric = Number(value)
  const normalized = Number.isFinite(numeric) ? Math.min(5, Math.max(1, numeric)) : 5
  const rounded = Math.round(normalized)
  const stars = `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`
  const numericLabel = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1)
  return `${stars} (${numericLabel})`
}

const VEHICLE_TYPE_OPTIONS = ['sedan', 'suv', 'crossover', 'hatchback', 'coupe', 'van', 'truck', 'other']
const PRODUCTION_STATUS_OPTIONS = ['active', 'discontinued', 'upcoming']
const CURRENCY_OPTIONS = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'PLN', 'INR']

function toIntOrNull(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function toDecimalOrNull(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

function getCarFieldDraftValue(car, field) {
  if (!car) return ''
  switch (field) {
    case 'description':
      return car.description || ''
    case 'year_introduced':
      return car.year_introduced !== null && car.year_introduced !== undefined ? String(car.year_introduced) : ''
    case 'vehicle_type':
      return car.vehicle_type || 'sedan'
    case 'engine_type':
      return car.engine_type || ''
    case 'horsepower':
      return car.horsepower !== null && car.horsepower !== undefined ? String(car.horsepower) : ''
    case 'acceleration':
      return car.acceleration || ''
    case 'top_speed':
      return car.top_speed !== null && car.top_speed !== undefined ? String(car.top_speed) : ''
    case 'length_mm':
      return car.length_mm !== null && car.length_mm !== undefined ? String(car.length_mm) : ''
    case 'width_mm':
      return car.width_mm !== null && car.width_mm !== undefined ? String(car.width_mm) : ''
    case 'height_mm':
      return car.height_mm !== null && car.height_mm !== undefined ? String(car.height_mm) : ''
    case 'fuel_consumption':
      return car.fuel_consumption || ''
    case 'price_min':
      return car.price_min ? String(car.price_min) : ''
    case 'price_max':
      return car.price_max ? String(car.price_max) : ''
    case 'currency':
      return car.currency || 'CNY'
    case 'production_status':
      return car.production_status || 'active'
    case 'is_featured':
      return car.is_featured ? 'true' : 'false'
    default:
      return ''
  }
}

function EditableCarField({ isAdmin, field, label, display, quickEditLabel, onOpen }) {
  const content = display ?? '-'
  if (!isAdmin) return <strong>{content}</strong>

  return (
    <strong
      className="review-inline-editable-block"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(field, label)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(field, label)
        }
      }}
      aria-label={`${quickEditLabel}: ${label}`}
      title={`${quickEditLabel}: ${label}`}
    >
      {content}
    </strong>
  )
}

export default function CarDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [car, setCar] = useState(null)
  const [opinions, setOpinions] = useState([])
  const [reviewArticles, setReviewArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [adminDescription, setAdminDescription] = useState('')
  const [adminYearIntroduced, setAdminYearIntroduced] = useState('')
  const [adminVehicleType, setAdminVehicleType] = useState('sedan')
  const [adminEngineType, setAdminEngineType] = useState('')
  const [adminHorsepower, setAdminHorsepower] = useState('')
  const [adminAcceleration, setAdminAcceleration] = useState('')
  const [adminTopSpeed, setAdminTopSpeed] = useState('')
  const [adminLengthMm, setAdminLengthMm] = useState('')
  const [adminWidthMm, setAdminWidthMm] = useState('')
  const [adminHeightMm, setAdminHeightMm] = useState('')
  const [adminFuelConsumption, setAdminFuelConsumption] = useState('')
  const [adminPriceMin, setAdminPriceMin] = useState('')
  const [adminPriceMax, setAdminPriceMax] = useState('')
  const [adminCurrency, setAdminCurrency] = useState('CNY')
  const [adminProductionStatus, setAdminProductionStatus] = useState('active')
  const [adminFeatured, setAdminFeatured] = useState(false)
  const [adminImage, setAdminImage] = useState(null)
  const [heroImagePreviewUrl, setHeroImagePreviewUrl] = useState('')
  const [isHeroImageEditorOpen, setIsHeroImageEditorOpen] = useState(false)
  const [heroImageSaving, setHeroImageSaving] = useState(false)
  const [heroImageMessage, setHeroImageMessage] = useState('')
  const [heroImageError, setHeroImageError] = useState('')
  const [adminOpinionDraft, setAdminOpinionDraft] = useState(createEmptyOpinionDraft)
  const [adminOpinionSaving, setAdminOpinionSaving] = useState(false)
  const [adminOpinionMessage, setAdminOpinionMessage] = useState('')
  const [adminOpinionError, setAdminOpinionError] = useState('')
  const [editingOpinionId, setEditingOpinionId] = useState(null)
  const [editingOpinionDraft, setEditingOpinionDraft] = useState(null)
  const [opinionActionLoading, setOpinionActionLoading] = useState(false)
  const [expandedOpinions, setExpandedOpinions] = useState(new Set())
  const [opinionComments, setOpinionComments] = useState({})
  const [commentTexts, setCommentTexts] = useState({})
  const [commentSaving, setCommentSaving] = useState({})
  const [voteSaving, setVoteSaving] = useState({})
  const [reviewSlideIndex, setReviewSlideIndex] = useState(0)
  const [isAddOpinionOpen, setIsAddOpinionOpen] = useState(false)
  const [isAdminDetailEditorOpen, setIsAdminDetailEditorOpen] = useState(false)
  const [carFieldEditor, setCarFieldEditor] = useState(null)
  const [carFieldDraft, setCarFieldDraft] = useState('')
  const [carFieldDraftSecondary, setCarFieldDraftSecondary] = useState('')
  const [carFieldDraftTertiary, setCarFieldDraftTertiary] = useState('')
  const [carFieldSaving, setCarFieldSaving] = useState(false)
  const [carFieldError, setCarFieldError] = useState('')
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  const [adminError, setAdminError] = useState('')
  const isAdmin = isAdminUser()
  const isLoggedIn = isAuthenticatedUser()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        const [carResponse, opinionsResponse, reviewsResponse] = await Promise.all([
          api.get(`/cars/${id}/`),
          api.get(`/opinions/?car_model=${id}&ordering=-created_at`),
          api.get(`/reviews/?car_model=${id}&ordering=-published_at&page_size=3`),
        ])

        setCar(carResponse.data)
        setOpinions(opinionsResponse.data.results || opinionsResponse.data)
        setReviewArticles(reviewsResponse.data.results || reviewsResponse.data || [])

        if (isAdmin) {
          setAdminDescription(carResponse.data.description || '')
          setAdminYearIntroduced(carResponse.data.year_introduced ? String(carResponse.data.year_introduced) : '')
          setAdminVehicleType(carResponse.data.vehicle_type || 'sedan')
          setAdminEngineType(carResponse.data.engine_type || '')
          setAdminHorsepower(
            carResponse.data.horsepower !== null && carResponse.data.horsepower !== undefined
              ? String(carResponse.data.horsepower)
              : '',
          )
          setAdminAcceleration(carResponse.data.acceleration || '')
          setAdminTopSpeed(
            carResponse.data.top_speed !== null && carResponse.data.top_speed !== undefined
              ? String(carResponse.data.top_speed)
              : '',
          )
          setAdminLengthMm(
            carResponse.data.length_mm !== null && carResponse.data.length_mm !== undefined
              ? String(carResponse.data.length_mm)
              : '',
          )
          setAdminWidthMm(
            carResponse.data.width_mm !== null && carResponse.data.width_mm !== undefined
              ? String(carResponse.data.width_mm)
              : '',
          )
          setAdminHeightMm(
            carResponse.data.height_mm !== null && carResponse.data.height_mm !== undefined
              ? String(carResponse.data.height_mm)
              : '',
          )
          setAdminFuelConsumption(carResponse.data.fuel_consumption || '')
          setAdminPriceMin(carResponse.data.price_min ? String(carResponse.data.price_min) : '')
          setAdminPriceMax(carResponse.data.price_max ? String(carResponse.data.price_max) : '')
          setAdminCurrency(carResponse.data.currency || 'CNY')
          setAdminProductionStatus(carResponse.data.production_status || 'active')
          setAdminFeatured(!!carResponse.data.is_featured)
        }
      } catch (error) {
        console.error('Error fetching car details:', error)
        setCar(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, isAdmin])

  useEffect(() => {
    if (reviewArticles.length === 0) {
      setReviewSlideIndex(0)
      return
    }
    if (reviewSlideIndex >= reviewArticles.length) {
      setReviewSlideIndex(0)
    }
  }, [reviewArticles, reviewSlideIndex])

  useEffect(() => {
    if (!adminImage) {
      setHeroImagePreviewUrl('')
      return undefined
    }

    const previewUrl = URL.createObjectURL(adminImage)
    setHeroImagePreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [adminImage])

  const handleToggleComments = async (opinionId) => {
    setExpandedOpinions((prev) => {
      const next = new Set(prev)
      if (next.has(opinionId)) {
        next.delete(opinionId)
      } else {
        next.add(opinionId)
      }
      return next
    })
    if (!opinionComments[opinionId]) {
      try {
        const res = await api.get(`/opinions/${opinionId}/`)
        setOpinionComments((prev) => ({ ...prev, [opinionId]: res.data.comments || [] }))
      } catch {
        setOpinionComments((prev) => ({ ...prev, [opinionId]: [] }))
      }
    }
  }

  const handleAddComment = async (opinionId) => {
    const text = (commentTexts[opinionId] || '').trim()
    if (!text) return
    setCommentSaving((prev) => ({ ...prev, [opinionId]: true }))
    try {
      await api.post(`/opinions/${opinionId}/add_comment/`, { content: text })
      const res = await api.get(`/opinions/${opinionId}/`)
      setOpinionComments((prev) => ({ ...prev, [opinionId]: res.data.comments || [] }))
      setCommentTexts((prev) => ({ ...prev, [opinionId]: '' }))
    } catch {
      // comment error silently ignored — form stays open
    } finally {
      setCommentSaving((prev) => ({ ...prev, [opinionId]: false }))
    }
  }

  const handleAdminSave = async (e) => {
    e.preventDefault()
    if (!isAdmin) return

    try {
      setAdminSaving(true)
      setAdminMessage('')
      setAdminError('')

      const toIntOrNull = (value) => {
        const trimmed = String(value || '').trim()
        if (!trimmed) return null
        const parsed = Number.parseInt(trimmed, 10)
        return Number.isNaN(parsed) ? null : parsed
      }

      const formData = new FormData()
      formData.append('description', adminDescription)
      formData.append('year_introduced', adminYearIntroduced)
      formData.append('vehicle_type', adminVehicleType)
      formData.append('engine_type', adminEngineType)
      formData.append('horsepower', String(toIntOrNull(adminHorsepower) ?? ''))
      formData.append('acceleration', adminAcceleration)
      formData.append('top_speed', String(toIntOrNull(adminTopSpeed) ?? ''))
      formData.append('length_mm', String(toIntOrNull(adminLengthMm) ?? ''))
      formData.append('width_mm', String(toIntOrNull(adminWidthMm) ?? ''))
      formData.append('height_mm', String(toIntOrNull(adminHeightMm) ?? ''))
      formData.append('fuel_consumption', adminFuelConsumption)
      formData.append('price_min', adminPriceMin ? parseFloat(adminPriceMin) : '')
      formData.append('price_max', adminPriceMax ? parseFloat(adminPriceMax) : '')
      formData.append('currency', adminCurrency)
      formData.append('production_status', adminProductionStatus)
      formData.append('is_featured', String(adminFeatured))
      if (adminImage) {
        formData.append('image', adminImage)
      }

      const response = await api.patch(`/cars/${id}/`, formData)

      setCar(response.data)
      setAdminImage(null)
      setAdminMessage(t.adminInline.saved)
    } catch (error) {
      setAdminError(extractApiErrorMessage(error, t.adminInline.saveError))
    } finally {
      setAdminSaving(false)
    }
  }

  const handleHeroImageSave = async () => {
    if (!isAdmin || !adminImage) return

    try {
      setHeroImageSaving(true)
      setHeroImageMessage('')
      setHeroImageError('')

      const formData = new FormData()
      formData.append('image', adminImage)

      const response = await api.patch(`/cars/${id}/`, formData)
      setCar(response.data)
      setAdminImage(null)
      setHeroImageMessage(t.adminInline.saved)
      setIsHeroImageEditorOpen(false)
    } catch (error) {
      setHeroImageError(extractApiErrorMessage(error, t.adminInline.saveError))
    } finally {
      setHeroImageSaving(false)
    }
  }

  const handleOpenHeroImageEditor = () => {
    if (!isAdmin) return
    setAdminImage(null)
    setHeroImageMessage('')
    setHeroImageError('')
    setIsHeroImageEditorOpen(true)
  }

  const handleCloseHeroImageEditor = () => {
    setIsHeroImageEditorOpen(false)
    setAdminImage(null)
    setHeroImageMessage('')
    setHeroImageError('')
  }

  const syncAdminFieldsFromCar = (carData) => {
    setAdminDescription(carData.description || '')
    setAdminYearIntroduced(carData.year_introduced ? String(carData.year_introduced) : '')
    setAdminVehicleType(carData.vehicle_type || 'sedan')
    setAdminEngineType(carData.engine_type || '')
    setAdminHorsepower(
      carData.horsepower !== null && carData.horsepower !== undefined ? String(carData.horsepower) : '',
    )
    setAdminAcceleration(carData.acceleration || '')
    setAdminTopSpeed(
      carData.top_speed !== null && carData.top_speed !== undefined ? String(carData.top_speed) : '',
    )
    setAdminLengthMm(
      carData.length_mm !== null && carData.length_mm !== undefined ? String(carData.length_mm) : '',
    )
    setAdminWidthMm(
      carData.width_mm !== null && carData.width_mm !== undefined ? String(carData.width_mm) : '',
    )
    setAdminHeightMm(
      carData.height_mm !== null && carData.height_mm !== undefined ? String(carData.height_mm) : '',
    )
    setAdminFuelConsumption(carData.fuel_consumption || '')
    setAdminPriceMin(carData.price_min ? String(carData.price_min) : '')
    setAdminPriceMax(carData.price_max ? String(carData.price_max) : '')
    setAdminCurrency(carData.currency || 'CNY')
    setAdminProductionStatus(carData.production_status || 'active')
    setAdminFeatured(!!carData.is_featured)
  }

  const handleOpenCarFieldEditor = (field, label) => {
    if (!isAdmin || !car) return

    if (field === 'price_range') {
      setCarFieldDraft(car.price_min ? String(car.price_min) : '')
      setCarFieldDraftSecondary(car.price_max ? String(car.price_max) : '')
      setCarFieldDraftTertiary(car.currency || 'CNY')
    } else {
      setCarFieldDraft(getCarFieldDraftValue(car, field))
      setCarFieldDraftSecondary('')
      setCarFieldDraftTertiary('')
    }

    setCarFieldEditor({ field, label })
    setCarFieldError('')
  }

  const handleCloseCarFieldEditor = () => {
    setCarFieldEditor(null)
    setCarFieldDraft('')
    setCarFieldDraftSecondary('')
    setCarFieldDraftTertiary('')
    setCarFieldError('')
  }

  const handleSaveCarField = async () => {
    if (!isAdmin || !car || !carFieldEditor) return

    const { field } = carFieldEditor
    const payload = {}

    try {
      setCarFieldSaving(true)
      setCarFieldError('')

      if (field === 'description') {
        payload.description = carFieldDraft
      } else if (field === 'year_introduced') {
        const parsedYear = toIntOrNull(carFieldDraft)
        if (parsedYear === null) {
          setCarFieldError(t.adminInline.saveError)
          return
        }
        payload.year_introduced = parsedYear
      } else if (field === 'vehicle_type') {
        payload.vehicle_type = carFieldDraft
      } else if (field === 'engine_type') {
        payload.engine_type = carFieldDraft
      } else if (field === 'horsepower') {
        payload.horsepower = toIntOrNull(carFieldDraft)
      } else if (field === 'acceleration') {
        payload.acceleration = carFieldDraft
      } else if (field === 'top_speed') {
        payload.top_speed = toIntOrNull(carFieldDraft)
      } else if (field === 'length_mm') {
        payload.length_mm = toIntOrNull(carFieldDraft)
      } else if (field === 'width_mm') {
        payload.width_mm = toIntOrNull(carFieldDraft)
      } else if (field === 'height_mm') {
        payload.height_mm = toIntOrNull(carFieldDraft)
      } else if (field === 'fuel_consumption') {
        payload.fuel_consumption = carFieldDraft
      } else if (field === 'production_status') {
        payload.production_status = carFieldDraft
      } else if (field === 'is_featured') {
        payload.is_featured = carFieldDraft === 'true'
      } else if (field === 'price_range') {
        payload.price_min = toDecimalOrNull(carFieldDraft)
        payload.price_max = toDecimalOrNull(carFieldDraftSecondary)
        payload.currency = carFieldDraftTertiary || 'CNY'
      }

      const response = await api.patch(`/cars/${id}/`, payload)
      setCar(response.data)
      syncAdminFieldsFromCar(response.data)
      handleCloseCarFieldEditor()
    } catch (error) {
      setCarFieldError(extractApiErrorMessage(error, t.adminInline.saveError))
    } finally {
      setCarFieldSaving(false)
    }
  }

  const handleAdminOpinionCreate = async (e) => {
    e.preventDefault()
    if (!isLoggedIn || !car) return

    if (!validateOpinionDraft(adminOpinionDraft)) {
      setAdminOpinionMessage('')
      setAdminOpinionError(t.pages.opinionCreateValidation)
      return
    }

    try {
      setAdminOpinionSaving(true)
      setAdminOpinionMessage('')
      setAdminOpinionError('')

      await api.post('/opinions/', {
        ...buildOpinionPayload(adminOpinionDraft),
        car_model: car.id,
      })

      const [carResponse, opinionsResponse] = await Promise.all([
        api.get(`/cars/${id}/`),
        api.get(`/opinions/?car_model=${id}&ordering=-created_at`),
      ])
      setCar(carResponse.data)
      setOpinions(opinionsResponse.data.results || opinionsResponse.data)
      setAdminOpinionDraft(createEmptyOpinionDraft())
      setAdminOpinionMessage(t.pages.opinionCreated)
    } catch {
      setAdminOpinionError(t.pages.opinionCreateError)
    } finally {
      setAdminOpinionSaving(false)
    }
  }

  const handleStartOpinionEdit = (opinion) => {
    setEditingOpinionId(opinion.id)
    setEditingOpinionDraft(buildOpinionDraftFromApi(opinion))
    setAdminOpinionMessage('')
    setAdminOpinionError('')
  }

  const handleSaveOpinionEdit = async (opinionId) => {
    if (!editingOpinionDraft || !car) return

    if (!validateOpinionDraft(editingOpinionDraft)) {
      setAdminOpinionError(t.pages.opinionCreateValidation)
      return
    }

    try {
      setOpinionActionLoading(true)
      setAdminOpinionMessage('')
      setAdminOpinionError('')
      await api.patch(`/opinions/${opinionId}/`, {
        ...buildOpinionPayload(editingOpinionDraft),
        car_model: car.id,
      })

      const opinionsResponse = await api.get(`/opinions/?car_model=${id}&ordering=-created_at`)
      setOpinions(opinionsResponse.data.results || opinionsResponse.data)
      setEditingOpinionId(null)
      setEditingOpinionDraft(null)
      setAdminOpinionMessage(t.pages.opinionUpdated)
    } catch {
      setAdminOpinionError(t.pages.opinionUpdateError)
    } finally {
      setOpinionActionLoading(false)
    }
  }

  const handleDeleteOpinion = async (opinionId) => {
    if (!window.confirm(t.pages.opinionDeleteConfirm)) return
    try {
      setOpinionActionLoading(true)
      setAdminOpinionMessage('')
      setAdminOpinionError('')
      await api.delete(`/opinions/${opinionId}/`)
      const opinionsResponse = await api.get(`/opinions/?car_model=${id}&ordering=-created_at`)
      setOpinions(opinionsResponse.data.results || opinionsResponse.data)
      if (editingOpinionId === opinionId) {
        setEditingOpinionId(null)
        setEditingOpinionDraft(null)
      }
      setAdminOpinionMessage(t.pages.opinionDeleted)
    } catch {
      setAdminOpinionError(t.pages.opinionDeleteError)
    } finally {
      setOpinionActionLoading(false)
    }
  }

  const handleVoteOpinion = async (opinionId, voteType) => {
    if (!['helpful', 'unhelpful'].includes(voteType)) return
    if (!isLoggedIn) {
      setAdminOpinionError(t.pages.loginToContribute)
      return
    }

    try {
      setVoteSaving((prev) => ({ ...prev, [opinionId]: true }))
      setAdminOpinionError('')
      setAdminOpinionMessage('')
      await api.post(`/opinions/${opinionId}/vote/`, { vote_type: voteType })
      const opinionsResponse = await api.get(`/opinions/?car_model=${id}&ordering=-created_at`)
      setOpinions(opinionsResponse.data.results || opinionsResponse.data)
    } catch {
      setAdminOpinionError(t.pages.opinionUpdateError)
    } finally {
      setVoteSaving((prev) => ({ ...prev, [opinionId]: false }))
    }
  }

  if (loading) {
    return <div className="page-loading">{t.pages.loading}</div>
  }

  if (!car) {
    return <div className="page-card">{t.pages.carNotFound}</div>
  }

  const currentYear = new Date().getFullYear()
  const modelAge = car.year_introduced ? Math.max(currentYear - car.year_introduced, 0) : null
  const brandLogo = getBrandLogoOrPlaceholder(car.brand?.logo || '', car.brand?.name)
  const openCarFieldEditor = handleOpenCarFieldEditor

  return (
    <div className="detail-wrap">
      <nav className="breadcrumbs" aria-label={t.pages.breadcrumbsLabel}>
        <Link to="/" className="breadcrumbs-link">{t.footer.home}</Link>
        <span className="breadcrumbs-separator">/</span>
        <Link to="/cars" className="breadcrumbs-link">{t.nav.cars}</Link>
        {car.brand?.slug && (
          <>
            <span className="breadcrumbs-separator">/</span>
            <Link to={`/cars/brands/${car.brand.slug}`} className="breadcrumbs-link">{car.brand.name}</Link>
          </>
        )}
        <span className="breadcrumbs-separator">/</span>
        <span className="breadcrumbs-current">{car.name}</span>
      </nav>

      <section className="detail-hero">
        <div className="detail-copy">
          <div className="detail-brand-row">
            <img src={brandLogo} alt={car.brand?.name || ''} className="detail-brand-logo" />
            <div>
              <p className="detail-kicker">{car.brand?.name || ''}</p>
              <h1 className="page-title detail-title">{car.name}</h1>
            </div>
          </div>
          {isAdmin ? (
            <p
              className="detail-description review-inline-editable-block"
              role="button"
              tabIndex={0}
              onClick={() => openCarFieldEditor('description', t.adminPanel.description)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openCarFieldEditor('description', t.adminPanel.description)
                }
              }}
              aria-label={`${t.adminInline.quickEdit}: ${t.adminPanel.description}`}
              title={`${t.adminInline.quickEdit}: ${t.adminPanel.description}`}
            >
              {car.description}
            </p>
          ) : (
            <p className="detail-description">{car.description}</p>
          )}

          <div className="detail-badges">
            <span className="detail-badge">{car.vehicle_type}</span>
            <span className="detail-badge">{car.year_introduced}</span>
            <span className="detail-badge">{car.production_status}</span>
          </div>
        </div>

        {isAdmin ? (
          <div
            className="detail-image-wrap review-inline-editable-block"
            role="button"
            tabIndex={0}
            onClick={handleOpenHeroImageEditor}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleOpenHeroImageEditor()
              }
            }}
            aria-label={t.adminPanel.editImage}
            title={t.adminPanel.editImage}
          >
            <img src={getCarImage(car)} alt={car.name} className="detail-image" onError={handleCarImageError} />
          </div>
        ) : (
          <img src={getCarImage(car)} alt={car.name} className="detail-image" onError={handleCarImageError} />
        )}
      </section>

      <section className="detail-specs-card">
        <h2 className="detail-section-title">{t.pages.specs}</h2>
        <div className="detail-specs-grid">
          <div className="spec-item"><span>{t.pages.year}</span><EditableCarField isAdmin={isAdmin} field="year_introduced" label={t.pages.year} display={car.year_introduced || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.type}</span><EditableCarField isAdmin={isAdmin} field="vehicle_type" label={t.pages.type} display={car.vehicle_type || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.engine}</span><EditableCarField isAdmin={isAdmin} field="engine_type" label={t.pages.engine} display={car.engine_type || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.horsepower}</span><EditableCarField isAdmin={isAdmin} field="horsepower" label={t.pages.horsepower} display={car.horsepower ? `${car.horsepower} hp` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.acceleration}</span><EditableCarField isAdmin={isAdmin} field="acceleration" label={t.pages.acceleration} display={car.acceleration || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.topSpeed}</span><EditableCarField isAdmin={isAdmin} field="top_speed" label={t.pages.topSpeed} display={car.top_speed ? `${car.top_speed} km/h` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.length}</span><EditableCarField isAdmin={isAdmin} field="length_mm" label={t.pages.length} display={car.length_mm ? `${car.length_mm} mm` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.width}</span><EditableCarField isAdmin={isAdmin} field="width_mm" label={t.pages.width} display={car.width_mm ? `${car.width_mm} mm` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.height}</span><EditableCarField isAdmin={isAdmin} field="height_mm" label={t.pages.height} display={car.height_mm ? `${car.height_mm} mm` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.fuelConsumption}</span><EditableCarField isAdmin={isAdmin} field="fuel_consumption" label={t.pages.fuelConsumption} display={car.fuel_consumption || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
          <div className="spec-item"><span>{t.pages.price}</span><EditableCarField isAdmin={isAdmin} field="price_range" label={t.pages.price} display={car.price_range_display || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} /></div>
        </div>
      </section>

      <section className="detail-extra-grid">
        <article className="detail-extra-card">
          <h3 className="detail-extra-title">{t.pages.sectionPerformance}</h3>
          <div className="detail-kv-list">
            <div className="detail-kv-row">
              <span>{t.pages.horsepower}</span>
              <EditableCarField isAdmin={isAdmin} field="horsepower" label={t.pages.horsepower} display={car.horsepower ? `${car.horsepower} hp` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.acceleration}</span>
              <EditableCarField isAdmin={isAdmin} field="acceleration" label={t.pages.acceleration} display={car.acceleration || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.topSpeed}</span>
              <EditableCarField isAdmin={isAdmin} field="top_speed" label={t.pages.topSpeed} display={car.top_speed ? `${car.top_speed} km/h` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.fuelConsumption}</span>
              <EditableCarField isAdmin={isAdmin} field="fuel_consumption" label={t.pages.fuelConsumption} display={car.fuel_consumption || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
          </div>
        </article>

        <article className="detail-extra-card">
          <h3 className="detail-extra-title">{t.pages.sectionDimensions}</h3>
          <div className="detail-kv-list">
            <div className="detail-kv-row">
              <span>{t.pages.length}</span>
              <EditableCarField isAdmin={isAdmin} field="length_mm" label={t.pages.length} display={car.length_mm ? `${car.length_mm} mm` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.width}</span>
              <EditableCarField isAdmin={isAdmin} field="width_mm" label={t.pages.width} display={car.width_mm ? `${car.width_mm} mm` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.height}</span>
              <EditableCarField isAdmin={isAdmin} field="height_mm" label={t.pages.height} display={car.height_mm ? `${car.height_mm} mm` : '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.dimensionsSummary}</span>
              <strong>
                {car.length_mm && car.width_mm && car.height_mm
                  ? `${car.length_mm} × ${car.width_mm} × ${car.height_mm} mm`
                  : '-'}
              </strong>
            </div>
          </div>
        </article>

        <article className="detail-extra-card">
          <h3 className="detail-extra-title">{t.pages.sectionMarket}</h3>
          <div className="detail-kv-list">
            <div className="detail-kv-row">
              <span>{t.pages.price}</span>
              <EditableCarField isAdmin={isAdmin} field="price_range" label={t.pages.price} display={car.price_range_display || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.productionStatus}</span>
              <EditableCarField isAdmin={isAdmin} field="production_status" label={t.pages.productionStatus} display={car.production_status || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.modelAge}</span>
              <strong>{modelAge !== null ? `${modelAge} ${t.pages.years}` : '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.featuredModel}</span>
              <EditableCarField isAdmin={isAdmin} field="is_featured" label={t.pages.featuredModel} display={car.is_featured ? t.pages.yes : t.pages.no} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
          </div>
        </article>

        <article className="detail-extra-card">
          <h3 className="detail-extra-title">{t.pages.sectionCommunity}</h3>
          <div className="detail-kv-list">
            <div className="detail-kv-row">
              <span>{t.pages.brandLabel}</span>
              <strong>{car.brand?.name || '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.type}</span>
              <EditableCarField isAdmin={isAdmin} field="vehicle_type" label={t.pages.type} display={car.vehicle_type || '-'} quickEditLabel={t.adminInline.quickEdit} onOpen={openCarFieldEditor} />
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.averageRating}</span>
              <strong>{car.avg_rating || 0}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.totalOpinions}</span>
              <strong>{car.opinions_count || 0}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="detail-reviews-card">
        <div className="detail-section-header">
          <div>
            <h2 className="detail-section-title">{t.pages.reviewsSectionTitle}</h2>
            <p className="detail-section-subtitle">{t.pages.reviewsSectionIntro}</p>
          </div>
        </div>

        {reviewArticles.length === 0 ? (
          <div className="page-card">{t.pages.noReviewsYet}</div>
        ) : (
          <div className="home-featured-reviews-slider" aria-live="polite">
            <div
              className="home-featured-reviews-track"
              style={{ transform: `translateX(-${reviewSlideIndex * 100}%)` }}
            >
              {reviewArticles.map((review) => (
                <article key={review.id} className="home-featured-review-card" style={{ borderColor: '#e2e8f0' }}>
                  <div className="home-featured-review-main" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="home-featured-review-content">
                      {isAdmin && (
                        <Link
                          to={`/admin?section=manage-reviews&editReview=${review.id}`}
                          className="review-admin-quick-edit"
                          aria-label={t.adminPanel.editReview || 'Edit review'}
                          title={t.adminPanel.editReview || 'Edit review'}
                        >
                          <svg className="review-admin-quick-edit-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                          </svg>
                        </Link>
                      )}
                      <Link
                        to={`/reviews?model=${car.id}&review=${review.id}`}
                        className="detail-review-shortcut"
                        aria-label={review.title}
                      >
                        <div className="detail-review-shortcut-media">
                          <img
                            src={getReviewPreviewImage(review) || getCarImage(car)}
                            alt={review.title}
                            className="detail-review-shortcut-thumb"
                            loading="lazy"
                            onError={handleCarImageError}
                          />
                        </div>
                        <div className="detail-review-shortcut-content">
                          <div className="home-featured-review-heading">
                            <h3>{review.title}</h3>
                          </div>
                          <p className="home-featured-review-meta">
                            {review.publication_name}
                            {review.author_name ? ` - ${review.author_name}` : ''}
                          </p>
                          <div
                            className="home-featured-review-summary"
                            dangerouslySetInnerHTML={{ __html: getReviewSummaryHtml(review) }}
                          />
                        </div>
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {reviewArticles.length > 1 && (
              <div className="home-featured-reviews-dots" role="tablist" aria-label="Reviews slider">
                {reviewArticles.map((review, index) => (
                  <button
                    key={review.id}
                    type="button"
                    className={`home-featured-reviews-dot${index === reviewSlideIndex ? ' active' : ''}`}
                    aria-label={`Go to slide ${index + 1}`}
                    aria-selected={index === reviewSlideIndex}
                    onClick={() => setReviewSlideIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="detail-opinions">
        <div className="detail-section-header" style={{ marginBottom: '0.9rem' }}>
          <h2 className="detail-section-title">{t.pages.carOpinions}</h2>
        </div>

        {isLoggedIn ? (
          <div className="admin-form-card" style={{ marginBottom: '1.1rem' }}>
            <div className="detail-section-header detail-collapsible-header" style={{ marginBottom: isAddOpinionOpen ? '0.9rem' : 0 }}>
              <span style={{ fontWeight: 700 }}>{t.pages.addOpinionTitle}</span>
              <button
                type="button"
                className={`admin-inline-toggle admin-inline-gear ${isAddOpinionOpen ? 'is-open' : ''}`}
                onClick={() => setIsAddOpinionOpen((prev) => !prev)}
                aria-expanded={isAddOpinionOpen}
                aria-label={t.pages.addOpinionTitle}
                title={t.pages.addOpinionTitle}
              >
                <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                </svg>
              </button>
            </div>

            {isAddOpinionOpen && (
              <form onSubmit={handleAdminOpinionCreate}>
                <DetailedOpinionForm
                  draft={adminOpinionDraft}
                  onChange={setAdminOpinionDraft}
                  t={t}
                  RichTextEditorComponent={RichTextEditor}
                />
                <button type="submit" className="btn btn-primary" disabled={adminOpinionSaving}>
                  {adminOpinionSaving ? t.pages.loading : t.pages.addOpinionSubmit}
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="admin-subtitle">{t.pages.loginToContribute}</p>
        )}

        {adminOpinionMessage && <p className="form-success">{adminOpinionMessage}</p>}
        {adminOpinionError && <p className="form-error">{adminOpinionError}</p>}

        {opinions.length === 0 ? (
          <div className="page-card">{t.pages.noOpinions}</div>
        ) : (
          <div className="opinions-grid">
            {opinions.map((opinion) => (
              <article key={opinion.id} className="opinion-card-item">
                {editingOpinionId === opinion.id && editingOpinionDraft ? (
                  <div className="admin-form-card" style={{ marginBottom: '0.5rem' }}>
                    <DetailedOpinionForm
                      draft={editingOpinionDraft}
                      onChange={setEditingOpinionDraft}
                      t={t}
                      RichTextEditorComponent={RichTextEditor}
                    />
                    <div className="admin-actions-row">
                      <button type="button" className="btn btn-secondary" onClick={() => { setEditingOpinionId(null); setEditingOpinionDraft(null) }}>
                        {t.pages.cancelLabel}
                      </button>
                      <button type="button" className="btn btn-primary" disabled={opinionActionLoading} onClick={() => handleSaveOpinionEdit(opinion.id)}>
                        {opinionActionLoading ? t.pages.loading : t.pages.saveLabel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="opinion-title">
                      <Link to={`/opinions/${opinion.id}`}>{opinion.title}</Link>
                    </h3>
                    <DetailedOpinionCard
                      opinion={{
                        ...opinion,
                        car_year: car?.year_introduced,
                        content: sanitizeRichHtml(opinion.content),
                      }}
                      t={t}
                    />
                    <div className="opinion-rating-row">
                      <div className="opinion-votes" role="group" aria-label="Opinion votes">
                        <button
                          type="button"
                          className="opinion-vote-btn"
                          disabled={!!voteSaving[opinion.id]}
                          onClick={() => handleVoteOpinion(opinion.id, 'helpful')}
                          title="Helpful"
                        >
                          👍 {opinion.helpful_count}
                        </button>
                        <span className="opinion-vote-separator">|</span>
                        <button
                          type="button"
                          className="opinion-vote-btn"
                          disabled={!!voteSaving[opinion.id]}
                          onClick={() => handleVoteOpinion(opinion.id, 'unhelpful')}
                          title="Unhelpful"
                        >
                          👎 {opinion.unhelpful_count}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn-comment-toggle"
                        onClick={() => handleToggleComments(opinion.id)}
                      >
                        {expandedOpinions.has(opinion.id) ? '−' : '+'} {opinion.comments_count || 0} {t.pages.showComments}
                      </button>
                    </div>
                  </>
                )}
                {canEditByAuthorId(opinion.author?.id) && editingOpinionId !== opinion.id && (
                  <div className="admin-actions-row" style={{ marginTop: '0.4rem' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleStartOpinionEdit(opinion)}>
                      {t.pages.editLabel}
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteOpinion(opinion.id)}>
                      {t.pages.deleteLabel}
                    </button>
                  </div>
                )}
                {expandedOpinions.has(opinion.id) && (
                  <div className="opinion-comments">
                    {(opinionComments[opinion.id] || []).length === 0 ? (
                      <p className="opinion-no-comments">{t.pages.noComments}</p>
                    ) : (
                      (opinionComments[opinion.id] || []).map((c) => (
                        <div key={c.id} className="comment-item">
                          <span className="comment-author">{c.author?.username}</span>
                          <span className="comment-text">{c.content}</span>
                        </div>
                      ))
                    )}
                    <div className="comment-add-row">
                      {isLoggedIn ? (
                        <>
                          <input
                            className="form-input comment-input"
                            placeholder={t.pages.commentPlaceholder}
                            value={commentTexts[opinion.id] || ''}
                            onChange={(e) =>
                              setCommentTexts((prev) => ({ ...prev, [opinion.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddComment(opinion.id)
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={commentSaving[opinion.id]}
                            onClick={() => handleAddComment(opinion.id)}
                          >
                            {t.pages.commentSubmit}
                          </button>
                        </>
                      ) : (
                        <p className="admin-meta">{t.pages.loginToContribute}</p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="detail-admin-card">
          <div className="detail-section-header detail-collapsible-header" style={{ marginBottom: isAdminDetailEditorOpen ? '0.75rem' : 0 }}>
            <h2 className="detail-section-title">{t.adminInline.detailEditor}</h2>
            <button
              type="button"
              className={`admin-inline-toggle admin-inline-gear ${isAdminDetailEditorOpen ? 'is-open' : ''}`}
              onClick={() => setIsAdminDetailEditorOpen((prev) => !prev)}
              aria-expanded={isAdminDetailEditorOpen}
              aria-label={t.adminInline.detailEditor}
              title={t.adminInline.detailEditor}
            >
              <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
              </svg>
            </button>
          </div>
          {isAdminDetailEditorOpen && (
          <form className="admin-form-card" onSubmit={handleAdminSave}>
            <div className="admin-fields-grid">
              <div>
                <label className="form-label" htmlFor="admin-year">{t.pages.year}</label>
                <input
                  id="admin-year"
                  type="number"
                  className="form-input"
                  value={adminYearIntroduced}
                  onChange={(e) => setAdminYearIntroduced(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-type">{t.pages.type}</label>
                <select
                  id="admin-type"
                  className="form-input"
                  value={adminVehicleType}
                  onChange={(e) => setAdminVehicleType(e.target.value)}
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
            </div>

            <label className="form-label" htmlFor="admin-description">{t.adminPanel.description}</label>
            <textarea
              id="admin-description"
              className="form-input form-textarea"
              value={adminDescription}
              onChange={(e) => setAdminDescription(e.target.value)}
              rows={4}
            />

            <div className="admin-fields-grid">
              <div>
                <label className="form-label" htmlFor="admin-engine">{t.pages.engine}</label>
                <input
                  id="admin-engine"
                  className="form-input"
                  value={adminEngineType}
                  onChange={(e) => setAdminEngineType(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-hp">{t.pages.horsepower}</label>
                <input
                  id="admin-hp"
                  type="number"
                  className="form-input"
                  value={adminHorsepower}
                  onChange={(e) => setAdminHorsepower(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-acc">{t.pages.acceleration}</label>
                <input
                  id="admin-acc"
                  className="form-input"
                  value={adminAcceleration}
                  onChange={(e) => setAdminAcceleration(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-top">{t.pages.topSpeed}</label>
                <input
                  id="admin-top"
                  type="number"
                  className="form-input"
                  value={adminTopSpeed}
                  onChange={(e) => setAdminTopSpeed(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-length">{t.pages.length}</label>
                <input
                  id="admin-length"
                  type="number"
                  className="form-input"
                  value={adminLengthMm}
                  onChange={(e) => setAdminLengthMm(e.target.value)}
                  placeholder="mm"
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-width">{t.pages.width}</label>
                <input
                  id="admin-width"
                  type="number"
                  className="form-input"
                  value={adminWidthMm}
                  onChange={(e) => setAdminWidthMm(e.target.value)}
                  placeholder="mm"
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-height">{t.pages.height}</label>
                <input
                  id="admin-height"
                  type="number"
                  className="form-input"
                  value={adminHeightMm}
                  onChange={(e) => setAdminHeightMm(e.target.value)}
                  placeholder="mm"
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-consumption">{t.pages.fuelConsumption}</label>
                <input
                  id="admin-consumption"
                  className="form-input"
                  value={adminFuelConsumption}
                  onChange={(e) => setAdminFuelConsumption(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-status">{t.pages.productionStatus}</label>
                <select
                  id="admin-status"
                  className="form-input"
                  value={adminProductionStatus}
                  onChange={(e) => setAdminProductionStatus(e.target.value)}
                >
                  <option value="active">{t.pages.statusActive}</option>
                  <option value="discontinued">{t.pages.statusDiscontinued}</option>
                  <option value="upcoming">{t.pages.statusUpcoming}</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label" htmlFor="admin-price-min">{t.adminPanel.priceMinK}</label>
                <input
                  id="admin-price-min"
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={adminPriceMin}
                  onChange={(e) => setAdminPriceMin(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="admin-price-max">{t.adminPanel.priceMaxK}</label>
                <input
                  id="admin-price-max"
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={adminPriceMax}
                  onChange={(e) => setAdminPriceMax(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="admin-currency">{t.adminPanel.baseCurrency}</label>
                <select
                  id="admin-currency"
                  className="form-input"
                  value={adminCurrency}
                  onChange={(e) => setAdminCurrency(e.target.value)}
                >
                  <option value="CNY">¥ CNY</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                  <option value="GBP">£ GBP</option>
                  <option value="JPY">¥ JPY</option>
                  <option value="PLN">zł PLN</option>
                  <option value="INR">₹ INR</option>
                </select>
              </div>
            </div>

            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={adminFeatured}
                onChange={(e) => setAdminFeatured(e.target.checked)}
              />
              {t.adminPanel.featured}
            </label>

            <label className="form-label" htmlFor="admin-image">{t.adminPanel.image}</label>
            <div className="admin-file-picker-row">
              <input
                id="admin-image"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => setAdminImage(e.target.files?.[0] || null)}
              />
              <label htmlFor="admin-image" className="btn btn-secondary btn-sm">{t.adminInline.chooseFile}</label>
              <span className="admin-file-picker-name">{adminImage ? adminImage.name : t.adminInline.noFileSelected}</span>
            </div>

            {adminMessage && <p className="form-success">{adminMessage}</p>}
            {adminError && <p className="form-error">{adminError}</p>}

            <button type="submit" className="btn btn-primary" disabled={adminSaving}>
              {adminSaving ? t.pages.loading : t.adminInline.save}
            </button>
          </form>
          )}
        </section>
      )}

      {isAdmin && carFieldEditor && (
        <div className="review-inline-editor-backdrop" onClick={handleCloseCarFieldEditor}>
          <div className="review-inline-editor-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="review-inline-editor-title">
              {t.adminInline.quickEdit}: {carFieldEditor.label}
            </h3>

            {carFieldEditor.field === 'description' && (
              <textarea
                className="form-input form-textarea"
                value={carFieldDraft}
                onChange={(event) => setCarFieldDraft(event.target.value)}
                rows={5}
                aria-label={carFieldEditor.label}
              />
            )}

            {carFieldEditor.field === 'vehicle_type' && (
              <select className="form-input" value={carFieldDraft} onChange={(event) => setCarFieldDraft(event.target.value)}>
                {VEHICLE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}

            {carFieldEditor.field === 'production_status' && (
              <select className="form-input" value={carFieldDraft} onChange={(event) => setCarFieldDraft(event.target.value)}>
                {PRODUCTION_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}

            {carFieldEditor.field === 'is_featured' && (
              <select className="form-input" value={carFieldDraft} onChange={(event) => setCarFieldDraft(event.target.value)}>
                <option value="true">{t.pages.yes}</option>
                <option value="false">{t.pages.no}</option>
              </select>
            )}

            {carFieldEditor.field === 'price_range' && (
              <div className="admin-fields-grid">
                <div>
                  <label className="form-label" htmlFor="car-field-price-min">{t.adminPanel.priceMinK}</label>
                  <input
                    id="car-field-price-min"
                    type="number"
                    className="form-input"
                    value={carFieldDraft}
                    onChange={(event) => setCarFieldDraft(event.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="car-field-price-max">{t.adminPanel.priceMaxK}</label>
                  <input
                    id="car-field-price-max"
                    type="number"
                    className="form-input"
                    value={carFieldDraftSecondary}
                    onChange={(event) => setCarFieldDraftSecondary(event.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="car-field-currency">{t.adminPanel.baseCurrency}</label>
                  <select
                    id="car-field-currency"
                    className="form-input"
                    value={carFieldDraftTertiary}
                    onChange={(event) => setCarFieldDraftTertiary(event.target.value)}
                  >
                    {CURRENCY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {![
              'description',
              'vehicle_type',
              'production_status',
              'is_featured',
              'price_range',
            ].includes(carFieldEditor.field) && (
              <input
                className="form-input"
                type={['year_introduced', 'horsepower', 'top_speed', 'length_mm', 'width_mm', 'height_mm'].includes(carFieldEditor.field) ? 'number' : 'text'}
                value={carFieldDraft}
                onChange={(event) => setCarFieldDraft(event.target.value)}
                aria-label={carFieldEditor.label}
              />
            )}

            {carFieldError && <p className="form-error">{carFieldError}</p>}
            <div className="admin-actions-row">
              <button type="button" className="btn btn-secondary" onClick={handleCloseCarFieldEditor}>
                {t.pages.cancelLabel}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={carFieldSaving}
                onClick={handleSaveCarField}
              >
                {carFieldSaving ? t.pages.loading : t.pages.saveLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && isHeroImageEditorOpen && (
        <div className="review-inline-editor-backdrop" onClick={handleCloseHeroImageEditor}>
          <div className="review-inline-editor-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="review-inline-editor-title">
              {t.pages.editLabel}: {t.adminPanel.image}
            </h3>
            <div className="review-image-editor">
              <div className="review-gallery-main-container">
                <div className="review-gallery-main-wrapper">
                  <img
                    src={heroImagePreviewUrl || getCarImage(car)}
                    alt={car.name}
                    className="review-gallery-main"
                  />
                </div>
              </div>
              <div className="review-image-upload-area">
                <input
                  id="hero-image-modal-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    setAdminImage(event.target.files?.[0] || null)
                    setHeroImageMessage('')
                    setHeroImageError('')
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => document.getElementById('hero-image-modal-input')?.click()}
                  disabled={heroImageSaving}
                >
                  {t.adminInline.chooseFile}
                </button>
                <span className="admin-file-picker-name">
                  {adminImage ? adminImage.name : t.adminInline.noFileSelected}
                </span>
              </div>
              {heroImageMessage && <p className="form-success">{heroImageMessage}</p>}
              {heroImageError && <p className="form-error">{heroImageError}</p>}
              <div className="admin-actions-row">
                <button type="button" className="btn btn-secondary" onClick={handleCloseHeroImageEditor}>
                  {t.pages.cancelLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!adminImage || heroImageSaving}
                  onClick={handleHeroImageSave}
                >
                  {heroImageSaving ? t.pages.loading : t.pages.saveLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
