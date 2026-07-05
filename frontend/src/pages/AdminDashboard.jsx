import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { getBaseTranslationValue, getTranslationKeys, useTranslation } from '../i18n'
import api from '../services/api'
import { getCurrentUser, isAdminUser } from '../utils/auth'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { normalizeMediaUrl } from '../utils/mediaUrl'
import { sortBrandsByName } from '../utils/brands'
import { getReviewCategoryLabel } from '../utils/reviewCategory'

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

function RichTextEditor({ id, label, value, onChange, compact = false }) {
  const { t } = useTranslation()

  return (
    <div className={`admin-rich-editor ${compact ? 'admin-rich-editor-compact' : ''}`}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <ReactQuill
        id={id}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={WORD_LIKE_MODULES}
        formats={WORD_LIKE_FORMATS}
        placeholder={t.adminPanel.reviewEditorPlaceholder}
      />
    </div>
  )
}
// ── End review content helpers ──────────────────────────────

function resolveMediaUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return normalizeMediaUrl(url)
  if (url.startsWith('/')) return normalizeMediaUrl(`${API_ORIGIN}${url}`)
  return normalizeMediaUrl(`${API_ORIGIN}/${url}`)
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('admin_theme_mode') || 'light')
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
  const [lengthMm, setLengthMm] = useState('')
  const [widthMm, setWidthMm] = useState('')
  const [heightMm, setHeightMm] = useState('')
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
    tagline: null,
  })
  const [headerOriginalValues, setHeaderOriginalValues] = useState({
    title: '',
    icon: '',
    logoUrl: '',
    tagline: '',
  })
  const [headerTagline, setHeaderTagline] = useState('')
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
  const [isUserModerationSectionOpen, setIsUserModerationSectionOpen] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandYear, setNewBrandYear] = useState('')
  const [newBrandWebsite, setNewBrandWebsite] = useState('')
  const [newBrandDescriptionEn, setNewBrandDescriptionEn] = useState('')
  const [newBrandDescriptionPl, setNewBrandDescriptionPl] = useState('')
  const [creatingBrand, setCreatingBrand] = useState(false)
  const [createBrandMessage, setCreateBrandMessage] = useState('')
  const [createBrandError, setCreateBrandError] = useState('')
  const [deleteBrandSlug, setDeleteBrandSlug] = useState('')
  const [deletingBrand, setDeletingBrand] = useState(false)
  const [newModelBrandId, setNewModelBrandId] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [newModelYear, setNewModelYear] = useState('')
  const [newModelType, setNewModelType] = useState('sedan')
  const [newModelEngine, setNewModelEngine] = useState('')
  const [newModelPriceMin, setNewModelPriceMin] = useState('')
  const [newModelPriceMax, setNewModelPriceMax] = useState('')
  const [newModelCurrency, setNewModelCurrency] = useState('CNY')
  const [newModelDescription, setNewModelDescription] = useState('')
  const [newModelStatus, setNewModelStatus] = useState('active')
  const [newModelFeatured, setNewModelFeatured] = useState(false)
  const [creatingModel, setCreatingModel] = useState(false)
  const [createModelMessage, setCreateModelMessage] = useState('')
  const [createModelError, setCreateModelError] = useState('')
  const [deleteModelId, setDeleteModelId] = useState('')
  const [deletingModel, setDeletingModel] = useState(false)
  const [isCreateReviewSectionOpen, setIsCreateReviewSectionOpen] = useState(false)
  const [newReviewCarId, setNewReviewCarId] = useState('')
  const [newReviewTitle, setNewReviewTitle] = useState('')
  const [newReviewSummary, setNewReviewSummary] = useState('')
  const [newReviewContent, setNewReviewContent] = useState('')
  const [newReviewPublication, setNewReviewPublication] = useState('')
  const [newReviewSlug, setNewReviewSlug] = useState('')
  const [newReviewCategory, setNewReviewCategory] = useState('test')
  const [newReviewTags, setNewReviewTags] = useState('')
  const [newReviewInternalNotes, setNewReviewInternalNotes] = useState('')
  const [newReviewVerdict, setNewReviewVerdict] = useState('')
  const [newReviewAuthor, setNewReviewAuthor] = useState('')
  const [newReviewPublishedAt, setNewReviewPublishedAt] = useState('')
  const [newReviewFeatured, setNewReviewFeatured] = useState(false)
  const [newReviewPinned, setNewReviewPinned] = useState(false)
  const [newReviewPublished, setNewReviewPublished] = useState(true)
  const [newReviewFirstSliderFiles, setNewReviewFirstSliderFiles] = useState([])
  const [newReviewSecondSliderFiles, setNewReviewSecondSliderFiles] = useState([])
  const [creatingReview, setCreatingReview] = useState(false)
  const [createReviewMessage, setCreateReviewMessage] = useState('')
  const [createReviewError, setCreateReviewError] = useState('')
  const [deleteReviewId, setDeleteReviewId] = useState('')
  const [deletingReview, setDeletingReview] = useState(false)
  const [isManageReviewsSectionOpen, setIsManageReviewsSectionOpen] = useState(false)
  const [pressReviews, setPressReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState('')
  const [reviewsMessage, setReviewsMessage] = useState('')
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [reviewEditDraft, setReviewEditDraft] = useState(null)
  const [usersList, setUsersList] = useState([])
  const [activeUsersList, setActiveUsersList] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [activeUsersLoading, setActiveUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [usersMessage, setUsersMessage] = useState('')
  const [usersSearch, setUsersSearch] = useState('')
  const [usersRoleFilter, setUsersRoleFilter] = useState('all')
  const [usersStatusFilter, setUsersStatusFilter] = useState('all')
  const [usersSort, setUsersSort] = useState('username_asc')
  const [expandedUserId, setExpandedUserId] = useState(null)
  const [userEditDraft, setUserEditDraft] = useState(null)
  const [savingUserDetails, setSavingUserDetails] = useState(false)
  const [usersAuditLogs, setUsersAuditLogs] = useState({})
  const [usersAuditLoading, setUsersAuditLoading] = useState(false)
  const [generatedTempPassword, setGeneratedTempPassword] = useState('')
  const [usersAuditFromDate, setUsersAuditFromDate] = useState('')
  const [usersAuditToDate, setUsersAuditToDate] = useState('')
  const [usersAuditExporting, setUsersAuditExporting] = useState(false)
  const [recentActions, setRecentActions] = useState([])
  const [recentActionsLoading, setRecentActionsLoading] = useState(false)

  const extractVerdictFromContent = (content) => {
    const lines = (content || '').split('\n')
    const verdictLines = []
    let inVerdictSection = false
    for (const line of lines) {
      if (line.trim() === 'Verdict') {
        inVerdictSection = true
        continue
      }
      if (inVerdictSection && line.trim()) {
        verdictLines.push(line.trim())
      }
    }
    return verdictLines.join(' ')
  }

  const removeVerdictFromContent = (content) => {
    const lines = (content || '').split('\n')
    const result = []
    let skipVerdictSection = false
    for (const line of lines) {
      if (line.trim() === 'Verdict') {
        skipVerdictSection = true
        continue
      }
      if (!skipVerdictSection) {
        result.push(line)
      }
    }
    return result.join('\n').trim()
  }

  const appendVerdictToContent = (content, verdict) => {
    if (!verdict || !verdict.trim()) return content
    const cleanContent = removeVerdictFromContent(content)
    return `${cleanContent}\n\nVerdict\n${verdict.trim()}`
  }

  const toSlug = (value) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  const loadInventoryData = async (preferredSelectedId = '') => {
    const [carsResponse, brandsResponse] = await Promise.all([
      api.get('/cars/?page_size=200'),
      api.get('/cars/brands/?ordering=name&page_size=200'),
    ])

    const carList = carsResponse.data.results || carsResponse.data || []
    const brandList = brandsResponse.data.results || brandsResponse.data || []
    setCars(carList)
    setBrands(sortBrandsByName(brandList))

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

  const loadUsers = async () => {
    setUsersError('')
    setUsersMessage('')
    setUsersLoading(true)

    try {
      const response = await api.get('/users/?page_size=300')
      const users = response.data.results || response.data || []
      setUsersList(users)
    } catch {
      setUsersError(t.adminPanel.usersLoadError)
      setUsersList([])
    } finally {
      setUsersLoading(false)
    }
  }

  const loadActiveUsers = async (options = {}) => {
    const { silent = false } = options
    if (!silent) {
      setActiveUsersLoading(true)
    }
    try {
      const response = await api.get('/users/active_now/?minutes=15')
      const users = response.data?.results || []
      setActiveUsersList(users)
    } catch {
      if (!silent) {
        setActiveUsersList([])
        setUsersError(t.adminPanel.usersActiveNowLoadError)
      }
    } finally {
      if (!silent) {
        setActiveUsersLoading(false)
      }
    }
  }

  const loadRecentActions = async () => {
    setRecentActionsLoading(true)
    try {
      const response = await api.get('/common/admin-actions/?page_size=30')
      const entries = response.data.results || response.data || []
      setRecentActions(entries)
    } catch {
      setRecentActions([])
      setUsersError(t.adminPanel.recentActionsLoadError)
    } finally {
      setRecentActionsLoading(false)
    }
  }

  const handleToggleUserRole = async (user) => {
    if (!user) return
    if (currentUser?.id === user.id) {
      setUsersError(t.adminPanel.usersSelfRoleError)
      return
    }
    if (user.is_superuser) {
      setUsersError(t.adminPanel.usersSuperuserProtectedError)
      return
    }

    setUsersError('')
    setUsersMessage('')
    try {
      await api.patch(`/users/${user.id}/`, {
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        is_active: !!user.is_active,
        is_staff: !user.is_staff,
      })
      await loadUsers()
      setUsersMessage(t.adminPanel.usersUpdated)
    } catch {
      setUsersError(t.adminPanel.usersUpdateError)
    }
  }

  const handleToggleUserActive = async (user) => {
    if (!user) return
    if (currentUser?.id === user.id) {
      setUsersError(t.adminPanel.usersSelfDisableError)
      return
    }
    if (user.is_superuser) {
      setUsersError(t.adminPanel.usersSuperuserProtectedError)
      return
    }

    setUsersError('')
    setUsersMessage('')
    try {
      await api.patch(`/users/${user.id}/`, {
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        is_active: !user.is_active,
        is_staff: !!user.is_staff,
      })
      await loadUsers()
      setUsersMessage(t.adminPanel.usersUpdated)
    } catch {
      setUsersError(t.adminPanel.usersUpdateError)
    }
  }

  const handleDeleteUser = async (user) => {
    if (!user) return
    if (currentUser?.id === user.id) {
      setUsersError(t.adminPanel.usersSelfDeleteError)
      return
    }
    if (user.is_superuser) {
      setUsersError(t.adminPanel.usersSuperuserProtectedError)
      return
    }
    if (!window.confirm(t.adminPanel.usersDeleteConfirm.replace('{username}', user.username || 'user'))) return

    setUsersError('')
    setUsersMessage('')
    try {
      await api.delete(`/users/${user.id}/`)
      await loadUsers()
      setUsersMessage(t.adminPanel.usersDeleted)
    } catch {
      setUsersError(t.adminPanel.usersDeleteError)
    }
  }

  const openUserDetails = (user) => {
    if (!user) return
    if (expandedUserId === user.id) {
      setExpandedUserId(null)
      setUserEditDraft(null)
      setGeneratedTempPassword('')
      return
    }

    setExpandedUserId(user.id)
    setGeneratedTempPassword('')
    setUserEditDraft({
      id: user.id,
      username: user.username || '',
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      profile_phone: user.profile?.phone || '',
      profile_location: user.profile?.location || '',
      profile_bio: user.profile?.bio || '',
      force_password_reset: !!user.profile?.force_password_reset,
      new_password: '',
      confirm_password: '',
    })

    loadUserPasswordAudit(user.id)
  }

  const loadUserPasswordAudit = async (userId) => {
    setUsersAuditLoading(true)
    try {
      const response = await api.get(`/users/${userId}/password_audit/`)
      const entries = response.data || []
      setUsersAuditLogs((prev) => ({ ...prev, [userId]: entries }))
    } catch {
      setUsersAuditLogs((prev) => ({ ...prev, [userId]: [] }))
    } finally {
      setUsersAuditLoading(false)
    }
  }

  const handleGenerateTemporaryPassword = async (user) => {
    if (!user) return
    if (currentUser?.id === user.id) {
      setUsersError(t.adminPanel.usersSelfPasswordGenerateError)
      return
    }
    if (user.is_superuser) {
      setUsersError(t.adminPanel.usersSuperuserProtectedError)
      return
    }

    setUsersError('')
    setUsersMessage('')
    setSavingUserDetails(true)
    try {
      const response = await api.post(`/users/${user.id}/generate_temporary_password/`)
      const temporaryPassword = String(response.data?.temporary_password || '')
      setGeneratedTempPassword(temporaryPassword)
      setUserEditDraft((prev) => {
        if (!prev || prev.id !== user.id) return prev
        return {
          ...prev,
          new_password: temporaryPassword,
          confirm_password: temporaryPassword,
          force_password_reset: true,
        }
      })
      setUsersMessage(t.adminPanel.usersTemporaryPasswordGenerated)
      await Promise.all([loadUsers(), loadUserPasswordAudit(user.id)])
    } catch (err) {
      setUsersError(extractApiErrorMessage(err, t.adminPanel.usersTemporaryPasswordError))
    } finally {
      setSavingUserDetails(false)
    }
  }

  const handleCopyTemporaryPassword = async () => {
    if (!generatedTempPassword) return
    try {
      await navigator.clipboard.writeText(generatedTempPassword)
      setUsersMessage(t.adminPanel.usersTemporaryPasswordCopied)
    } catch {
      setUsersError(t.adminPanel.usersTemporaryPasswordCopyError)
    }
  }

  const handleExportUserAuditCsv = async (user) => {
    if (!user) return
    try {
      const response = await api.get(`/users/${user.id}/password_audit_csv/`, {
        responseType: 'blob',
      })

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `password-audit-${user.username || 'user'}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setUsersMessage(t.adminPanel.usersAuditExported)
    } catch {
      setUsersError(t.adminPanel.usersAuditExportError)
    }
  }

  const handleExportAllAuditCsv = async () => {
    setUsersError('')
    setUsersMessage('')
    setUsersAuditExporting(true)
    try {
      const params = new URLSearchParams()
      if (usersAuditFromDate) params.set('from_date', usersAuditFromDate)
      if (usersAuditToDate) params.set('to_date', usersAuditToDate)

      const endpoint = `/users/password_audit_csv_all/${params.toString() ? `?${params.toString()}` : ''}`
      const response = await api.get(endpoint, { responseType: 'blob' })

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'password-audit-all-users.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setUsersMessage(t.adminPanel.usersAllAuditExported)
    } catch (err) {
      setUsersError(extractApiErrorMessage(err, t.adminPanel.usersAllAuditExportError))
    } finally {
      setUsersAuditExporting(false)
    }
  }

  const handleUserDraftChange = (field, value) => {
    setUserEditDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [field]: value,
      }
    })
  }

  const handleSaveUserDetails = async (user) => {
    if (!userEditDraft || !user) return
    if (userEditDraft.new_password && userEditDraft.new_password !== userEditDraft.confirm_password) {
      setUsersError(t.adminPanel.usersPasswordMismatch)
      return
    }
    if (userEditDraft.new_password && userEditDraft.new_password.length < 8) {
      setUsersError(t.adminPanel.usersPasswordTooShort)
      return
    }

    const payload = {
      email: userEditDraft.email.trim(),
      first_name: userEditDraft.first_name.trim(),
      last_name: userEditDraft.last_name.trim(),
      profile_phone: userEditDraft.profile_phone.trim(),
      profile_location: userEditDraft.profile_location.trim(),
      profile_bio: userEditDraft.profile_bio,
      force_password_reset: !!userEditDraft.force_password_reset,
      is_active: !!user.is_active,
      is_staff: !!user.is_staff,
    }

    if (userEditDraft.new_password) {
      payload.new_password = userEditDraft.new_password
    }

    setUsersError('')
    setUsersMessage('')
    setSavingUserDetails(true)
    try {
      await api.patch(`/users/${user.id}/`, payload)
      await Promise.all([loadUsers(), loadUserPasswordAudit(user.id)])
      setUsersMessage(t.adminPanel.usersDetailsSaved)
      setExpandedUserId(null)
      setUserEditDraft(null)
      setGeneratedTempPassword('')
    } catch (err) {
      setUsersError(extractApiErrorMessage(err, t.adminPanel.usersUpdateError))
    } finally {
      setSavingUserDetails(false)
    }
  }

  const currentUser = useMemo(() => getCurrentUser(), [])
  const isPasswordConfirmationValid = Boolean(
    userEditDraft?.new_password &&
    userEditDraft?.confirm_password &&
    userEditDraft.new_password === userEditDraft.confirm_password,
  )
  const dashboardOwner = useMemo(() => currentUser?.username || 'admin', [currentUser])
  const dashboardOwnerInitial = useMemo(() => dashboardOwner.slice(0, 1).toUpperCase(), [dashboardOwner])
  const contentKeys = useMemo(() => getTranslationKeys(contentLang), [contentLang])

  const baseContentValue = useMemo(
    () => getBaseTranslationValue(contentLang, contentKey) || '',
    [contentLang, contentKey],
  )

  useEffect(() => {
    localStorage.setItem('admin_theme_mode', themeMode)
    window.dispatchEvent(new CustomEvent('theme-mode-changed', { detail: themeMode }))
  }, [themeMode])

  useEffect(() => {
    const readTheme = () => localStorage.getItem('admin_theme_mode') || 'light'
    const syncTheme = (nextMode) => {
      const normalized = nextMode === 'dark' ? 'dark' : 'light'
      setThemeMode((prev) => (prev === normalized ? prev : normalized))
    }

    const handleStorage = (event) => {
      if (event.key === 'admin_theme_mode') syncTheme(event.newValue)
    }

    const handleThemeChange = (event) => syncTheme(event?.detail)

    window.addEventListener('storage', handleStorage)
    window.addEventListener('theme-mode-changed', handleThemeChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('theme-mode-changed', handleThemeChange)
    }
  }, [])

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
        const brandName = String(car.brand_name || '').trim() || t.adminPanel.unknownBrand
        if (!groups.has(brandName)) {
          groups.set(brandName, [])
        }
        groups.get(brandName).push(car)
      })

    return Array.from(groups.entries()).map(([brandName, items]) => ({ brandName, items }))
  }, [filteredCars, t.adminPanel.unknownBrand])

  const filteredUsers = useMemo(() => {
    const term = usersSearch.trim().toLowerCase()
    const bySearch = usersList.filter((user) => {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase()
      return (
        !term
        || String(user.username || '').toLowerCase().includes(term)
        || String(user.email || '').toLowerCase().includes(term)
        || fullName.includes(term)
      )
    })

    const byRole = bySearch.filter((user) => {
      if (usersRoleFilter === 'all') return true
      if (usersRoleFilter === 'admin') return !!user.is_staff
      return !user.is_staff
    })

    const byStatus = byRole.filter((user) => {
      if (usersStatusFilter === 'all') return true
      if (usersStatusFilter === 'active') return !!user.is_active
      return !user.is_active
    })

    const sorted = [...byStatus]
    sorted.sort((a, b) => {
      if (usersSort === 'username_desc') {
        return String(b.username || '').localeCompare(String(a.username || ''))
      }
      if (usersSort === 'newest') {
        return new Date(b.date_joined || 0).getTime() - new Date(a.date_joined || 0).getTime()
      }
      if (usersSort === 'last_login') {
        return new Date(b.last_login || 0).getTime() - new Date(a.last_login || 0).getTime()
      }
      return String(a.username || '').localeCompare(String(b.username || ''))
    })

    return sorted
  }, [usersList, usersSearch, usersRoleFilter, usersStatusFilter, usersSort])

  const usersStats = useMemo(() => {
    const total = usersList.length
    const admins = usersList.filter((user) => user.is_staff).length
    const active = usersList.filter((user) => user.is_active).length
    const blocked = total - active
    return { total, admins, active, blocked }
  }, [usersList])

  const formatUserDate = (value) => {
    if (!value) return t.adminPanel.usersNeverLabel
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return t.adminPanel.usersNeverLabel
    return parsed.toLocaleString()
  }

  const formatAdminActionMessage = (entry) => {
    const label = entry.object_label || t.adminPanel.recentActionsUnknownObject
    const template = t.adminPanel.adminActionMessages?.[entry.action_type]
      || t.adminPanel.recentActionsUnknownAction
    return template.replace('{label}', label)
  }

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
    setLengthMm(car.length_mm !== null && car.length_mm !== undefined ? String(car.length_mm) : '')
    setWidthMm(car.width_mm !== null && car.width_mm !== undefined ? String(car.width_mm) : '')
    setHeightMm(car.height_mm !== null && car.height_mm !== undefined ? String(car.height_mm) : '')
    setFuelConsumption(car.fuel_consumption || '')
    setPriceMinK(car.price_min ? String(car.price_min) : '')
    setPriceMaxK(car.price_max ? String(car.price_max) : '')
    setBaseCurrency(car.currency || 'CNY')
    setSelectedCurrencies([car.currency || 'CNY'])
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
      lengthMm: car.length_mm !== null && car.length_mm !== undefined ? String(car.length_mm) : '',
      widthMm: car.width_mm !== null && car.width_mm !== undefined ? String(car.width_mm) : '',
      heightMm: car.height_mm !== null && car.height_mm !== undefined ? String(car.height_mm) : '',
      fuelConsumption: car.fuel_consumption || '',
      priceMinK: car.price_min ? String(car.price_min) : '',
      priceMaxK: car.price_max ? String(car.price_max) : '',
      baseCurrency: car.currency || 'CNY',
      selectedCurrencies: [car.currency || 'CNY'],
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
    const editReviewParam = searchParams.get('editReview')
    if (!editReviewParam) return

    const reviewId = Number.parseInt(editReviewParam, 10)
    if (Number.isNaN(reviewId)) return

    const openReviewEditor = async () => {
      setIsManageReviewsSectionOpen(true)

      if (!pressReviews.some((review) => Number(review.id) === reviewId)) {
        await loadPressReviews()
      }

      await handleEditReview(reviewId)

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('editReview')
      nextParams.delete('section')
      setSearchParams(nextParams, { replace: true })

      setTimeout(() => {
        const el = document.querySelector('.admin-review-edit-grid')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
    }

    openReviewEditor()
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const sectionParam = searchParams.get('section')
    if (sectionParam !== 'create-model') return

    setIsCreateModelSectionOpen(true)

    const brandIdParam = searchParams.get('brandId')
    if (!brandIdParam) return

    const hasMatchingBrand = brands.some((brandOption) => String(brandOption.id) === brandIdParam)
    if (hasMatchingBrand || brands.length === 0) {
      setNewModelBrandId(brandIdParam)
    }
  }, [searchParams, brands])

  useEffect(() => {
    if (!isUserModerationSectionOpen) return
    if (usersList.length === 0) {
      loadUsers()
    }
    loadActiveUsers()
    loadRecentActions()
  }, [isUserModerationSectionOpen])

  useEffect(() => {
    if (!isUserModerationSectionOpen) return undefined

    const refreshIntervalMs = 60_000
    const intervalId = window.setInterval(() => {
      loadActiveUsers({ silent: true })
    }, refreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [isUserModerationSectionOpen])

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
    if (!name) {
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
        founded_year: parsedYear,
        website: newBrandWebsite.trim(),
        description_en: newBrandDescriptionEn,
        description_pl: newBrandDescriptionPl,
      })

      setNewBrandName('')
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
    const parsedYear = Number.parseInt(newModelYear.trim(), 10)
    const brandId = Number.parseInt(newModelBrandId, 10)
    if (!name || Number.isNaN(parsedYear) || Number.isNaN(brandId)) {
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
        year_introduced: parsedYear,
        vehicle_type: newModelType,
        description: newModelDescription,
        engine_type: newModelEngine,
        price_min: newModelPriceMin ? parseFloat(newModelPriceMin) : null,
        price_max: newModelPriceMax ? parseFloat(newModelPriceMax) : null,
        currency: newModelCurrency,
        production_status: newModelStatus,
        is_featured: newModelFeatured,
      })

      const createdCarId = String(response.data.id || '')
      setNewModelName('')
      setNewModelYear('')
      setNewModelType('sedan')
      setNewModelEngine('')
      setNewModelPriceMin('')
      setNewModelPriceMax('')
      setNewModelCurrency('CNY')
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

  const uploadImageFiles = async (files) => {
    if (!files || files.length === 0) return []
    const urls = await Promise.all(
      files.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        let response
        try {
          response = await api.post('/common/content/upload/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        } catch {
          // Backward compatibility
          response = await api.post('/common/upload/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        }
        return response.data.url
      })
    )
    return urls
  }

  const buildContentWithImages = (baseContent, firstSliderUrls, secondSliderUrls) => {
    let finalContent = baseContent || ''

    if (firstSliderUrls && firstSliderUrls.length > 0) {
      const galleryText = 'Example photo gallery\n' + firstSliderUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')
      if (finalContent.includes('Example photo gallery')) {
        finalContent = finalContent.replace(/Example photo gallery[\s\S]*?(?=\n[A-Z]|\n\n[A-Z]|$)/, galleryText)
      } else {
        finalContent = finalContent.replace(/^Overview\n/, `Overview\n\n${galleryText}\n\n`)
      }
    }

    if (secondSliderUrls && secondSliderUrls.length > 0) {
      const secondGalleryText = 'Second photo gallery\n' + secondSliderUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')
      if (finalContent.includes('Second photo gallery')) {
        finalContent = finalContent.replace(/Second photo gallery[\s\S]*?(?=\n[A-Z]|$)/, secondGalleryText)
      } else {
        finalContent = finalContent.replace(/Verdict\s*$/, `Second photo gallery\n${secondGalleryText}\n\nVerdict`)
      }
    }

    return finalContent
  }

  const handleCreateReview = async (e) => {
    e.preventDefault()
    setCreateReviewMessage('')
    setCreateReviewError('')

    const parsedCarId = Number.parseInt(newReviewCarId, 10)
    const normalizedContent = String(newReviewContent || '').trim()
    if (
      Number.isNaN(parsedCarId) ||
      !newReviewTitle.trim() ||
      !normalizedContent ||
      !newReviewPublication.trim() ||
      !newReviewPublishedAt
    ) {
      setCreateReviewError(t.adminPanel.createReviewValidation)
      return
    }

    try {
      setCreatingReview(true)

      // Upload images for both sliders
      const firstSliderUrls = await uploadImageFiles(newReviewFirstSliderFiles)
      const secondSliderUrls = await uploadImageFiles(newReviewSecondSliderFiles)

      // Build content with image URLs
      let finalContent = buildContentWithImages(normalizedContent, firstSliderUrls, secondSliderUrls)
      const contentWithVerdict = appendVerdictToContent(finalContent, newReviewVerdict)

      await api.post('/reviews/', {
        car_model: parsedCarId,
        title: newReviewTitle.trim(),
        slug: newReviewSlug.trim(),
        summary: newReviewSummary.trim(),
        content: contentWithVerdict,
        category: newReviewCategory,
        tags: newReviewTags.trim(),
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
      setNewReviewContent('')
      setNewReviewPublication('')
      setNewReviewSlug('')
      setNewReviewCategory('test')
      setNewReviewTags('')
      setNewReviewInternalNotes('')
      setNewReviewVerdict('')
      setNewReviewAuthor('')
      setNewReviewPublishedAt('')
      setNewReviewFeatured(false)
      setNewReviewPinned(false)
      setNewReviewPublished(true)
      setNewReviewFirstSliderFiles([])
      setNewReviewSecondSliderFiles([])
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
      const contentWithoutVerdict = removeVerdictFromContent(detail.content)
      const extractedVerdict = extractVerdictFromContent(detail.content)
      setEditingReviewId(reviewId)
      setReviewEditDraft({
        car_model: String(detail.car_id || ''),
        title: detail.title || '',
        summary: detail.summary || '',
        content: contentWithoutVerdict,
        verdict: extractedVerdict,
        category: detail.category || 'test',
        tags: detail.tags || '',
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
    if (
      !reviewEditDraft.car_model ||
      !reviewEditDraft.title.trim() ||
      !String(reviewEditDraft.content || '').trim() ||
      !reviewEditDraft.publication_name.trim() ||
      !reviewEditDraft.published_at
    ) {
      setReviewsError(t.adminPanel.createReviewValidation)
      return
    }

    setReviewsMessage('')
    setReviewsError('')
    try {
      const contentWithVerdict = appendVerdictToContent(String(reviewEditDraft.content || '').trim(), reviewEditDraft.verdict)
      await api.patch(`/reviews/${reviewId}/`, {
        car_model: Number.parseInt(reviewEditDraft.car_model, 10),
        title: reviewEditDraft.title.trim(),
        summary: reviewEditDraft.summary.trim(),
        content: contentWithVerdict,
        category: reviewEditDraft.category,
        tags: reviewEditDraft.tags.trim(),
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

  const handleDeleteCar = async () => {
    if (!selectedCar) return
    if (!window.confirm(`${t.adminPanel.deleteModelConfirm} "${selectedCar.brand_name} ${selectedCar.name}"?`)) return
    setMessage('')
    setError('')
    try {
      await api.delete(`/cars/${selectedCar.id}/`)
      setMessage(t.adminPanel.modelDeleted)
      await loadInventoryData('')
    } catch {
      setError(t.adminPanel.modelDeleteError)
    }
  }

  const handleDeleteBrandQuick = async () => {
    if (!deleteBrandSlug) return
    const brandToDelete = brands.find((brand) => String(brand.slug) === String(deleteBrandSlug))
    if (!brandToDelete) return
    if (!window.confirm(`${t.pages.brandDeleteConfirm} "${brandToDelete.name}"?`)) return

    setCreateBrandMessage('')
    setCreateBrandError('')
    try {
      setDeletingBrand(true)
      await api.delete(`/cars/brands/${brandToDelete.slug}/`)
      setCreateBrandMessage(t.pages.brandDeleted)
      setDeleteBrandSlug('')
      await loadInventoryData('')
    } catch {
      setCreateBrandError(t.pages.brandDeleteError)
    } finally {
      setDeletingBrand(false)
    }
  }

  const handleDeleteModelQuick = async () => {
    if (!deleteModelId) return
    const modelToDelete = cars.find((car) => String(car.id) === String(deleteModelId))
    if (!modelToDelete) return
    if (!window.confirm(`${t.adminPanel.deleteModelConfirm} "${modelToDelete.brand_name} ${modelToDelete.name}"?`)) return

    setCreateModelMessage('')
    setCreateModelError('')
    try {
      setDeletingModel(true)
      await api.delete(`/cars/${modelToDelete.id}/`)
      setCreateModelMessage(t.adminPanel.modelDeleted)
      setDeleteModelId('')
      if (selectedId === modelToDelete.id) {
        setSelectedId(null)
      }
      await loadInventoryData('')
    } catch {
      setCreateModelError(t.adminPanel.modelDeleteError)
    } finally {
      setDeletingModel(false)
    }
  }

  const handleDeleteReviewQuick = async () => {
    if (!deleteReviewId) return
    const reviewToDelete = pressReviews.find((review) => String(review.id) === String(deleteReviewId))
    if (!reviewToDelete) return
    if (!window.confirm(`${t.adminPanel.reviewDeleteConfirm} "${reviewToDelete.title}"?`)) return

    setCreateReviewMessage('')
    setCreateReviewError('')
    try {
      setDeletingReview(true)
      await api.delete(`/reviews/${reviewToDelete.id}/`)
      setCreateReviewMessage(t.adminPanel.reviewDeleted)
      setDeleteReviewId('')
      await loadPressReviews()
    } catch {
      setCreateReviewError(t.adminPanel.reviewDeleteError)
    } finally {
      setDeletingReview(false)
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
    setLengthMm(originalValues.lengthMm)
    setWidthMm(originalValues.widthMm)
    setHeightMm(originalValues.heightMm)
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
      formData.append('length_mm', String(toIntOrNull(lengthMm) ?? ''))
      formData.append('width_mm', String(toIntOrNull(widthMm) ?? ''))
      formData.append('height_mm', String(toIntOrNull(heightMm) ?? ''))
      formData.append('fuel_consumption', fuelConsumption)
      formData.append('price_min', priceMinK ? parseFloat(priceMinK) : '')
      formData.append('price_max', priceMaxK ? parseFloat(priceMaxK) : '')
      formData.append('currency', baseCurrency)
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
        const taglineRecord = list.find((item) => item.key === 'nav.brandTagline') || null
        const nextValues = {
          title: String(titleRecord?.value ?? getBaseTranslationValue(headerLang, 'nav.brandTitle') ?? ''),
          icon: String(iconRecord?.value ?? getBaseTranslationValue(headerLang, 'nav.brandIcon') ?? ''),
          logoUrl: String(logoRecord?.value ?? getBaseTranslationValue(headerLang, 'nav.brandLogoUrl') ?? ''),
          tagline: String(taglineRecord?.value ?? getBaseTranslationValue(headerLang, 'nav.brandTagline') ?? ''),
        }

        setHeaderTitle(nextValues.title)
        setHeaderIcon(nextValues.icon)
        setHeaderLogoUrl(nextValues.logoUrl)
        setHeaderTagline(nextValues.tagline)
        setHeaderOriginalValues(nextValues)
        setHeaderRecordIds({
          title: titleRecord?.id ?? null,
          icon: iconRecord?.id ?? null,
          logoUrl: logoRecord?.id ?? null,
          tagline: taglineRecord?.id ?? null,
        })
      } catch {
        const fallbackValues = {
          title: String(getBaseTranslationValue(headerLang, 'nav.brandTitle') ?? ''),
          icon: String(getBaseTranslationValue(headerLang, 'nav.brandIcon') ?? ''),
          logoUrl: String(getBaseTranslationValue(headerLang, 'nav.brandLogoUrl') ?? ''),
          tagline: String(getBaseTranslationValue(headerLang, 'nav.brandTagline') ?? ''),
        }
        setHeaderTitle(fallbackValues.title)
        setHeaderIcon(fallbackValues.icon)
        setHeaderLogoUrl(fallbackValues.logoUrl)
        setHeaderTagline(fallbackValues.tagline)
        setHeaderOriginalValues(fallbackValues)
        setHeaderRecordIds({ title: null, icon: null, logoUrl: null, tagline: null })
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
    setHeaderTagline(headerOriginalValues.tagline)
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

      const [titleId, iconId, logoId, taglineId] = await Promise.all([
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
        saveContentOverride({
          recordId: headerRecordIds.tagline,
          key: 'nav.brandTagline',
          value: headerTagline,
          language: headerLang,
        }),
      ])

      const nextValues = {
        title: headerTitle,
        icon: headerIcon,
        logoUrl: finalLogoUrl,
        tagline: headerTagline,
      }
      setHeaderLogoUrl(finalLogoUrl)
      setHeaderRecordIds({ title: titleId, icon: iconId, logoUrl: logoId, tagline: taglineId })
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
    <div className={`admin-wrap density-comfortable ${themeMode === 'dark' ? 'admin-theme-dark' : 'admin-theme-light'}`}>
      <div className="page-card admin-hero-card">
        <div>
          <h1 className="page-title">{t.adminPanel.title}</h1>
          <p className="admin-subtitle">{t.adminPanel.subtitle}</p>
        </div>
        <div className="admin-hero-right">
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
                <img src={imagePreview || getCarImage(selectedCar)} alt={selectedCar.name} className="admin-preview-image" onError={handleCarImageError} />
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

            {isImageEditorOpen && (
              <>
                <p className="admin-section-caption">{t.adminPanel.imageEditorTitle}</p>

                <label className="form-label" htmlFor="image">{t.adminPanel.image}</label>
                <div className="custom-file-input-wrapper">
                  <input
                    id="image"
                    type="file"
                    accept="image/*"
                    className="custom-file-input"
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
                  <label className="custom-file-input-label" htmlFor="image">
                    <span>{`${t.adminPanel.chooseFile}: ${imageFile?.name || t.adminPanel.noFileSelected}`}</span>
                  </label>
                </div>

                <label className="form-label" htmlFor="brand-logo">{t.adminPanel.brandLogo}</label>
                <div className="custom-file-input-wrapper">
                  <input
                    id="brand-logo"
                    type="file"
                    accept="image/*"
                    className="custom-file-input"
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
                  <label className="custom-file-input-label" htmlFor="brand-logo">
                    <span>{`${t.adminPanel.chooseFile}: ${brandLogoFile?.name || t.adminPanel.noFileSelected}`}</span>
                  </label>
                </div>
                {brandLogoPreview && (
                  <img
                    src={brandLogoPreview}
                    alt={t.adminPanel.brandLogo}
                    className="admin-brand-logo-preview"
                  />
                )}
              </>
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
                <label className="form-label" htmlFor="length">{t.pages.length}</label>
                <input id="length" type="number" className="form-input" value={lengthMm} onChange={(e) => setLengthMm(e.target.value)} placeholder="mm" />
              </div>
              <div>
                <label className="form-label" htmlFor="width">{t.pages.width}</label>
                <input id="width" type="number" className="form-input" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} placeholder="mm" />
              </div>
              <div>
                <label className="form-label" htmlFor="height">{t.pages.height}</label>
                <input id="height" type="number" className="form-input" value={heightMm} onChange={(e) => setHeightMm(e.target.value)} placeholder="mm" />
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
                <p className="form-label form-label-help admin-currency-grid-label">
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

            {message && <p className="form-success">{message}</p>}
            {error && <p className="form-error">{error}</p>}

            <div className="admin-actions-row">
              <button type="button" className="btn btn-secondary" onClick={handleReset}>
                {t.adminPanel.reset}
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t.pages.loading : t.adminPanel.save}
              </button>
              {selectedCar && (
                <button type="button" className="btn btn-danger" onClick={handleDeleteCar}>
                  {t.adminPanel.deleteModel}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="admin-sections-list">
      <section className="admin-form-card admin-collapsible-card admin-option-create-brand">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsCreateBrandSectionOpen((prev) => !prev)}
          aria-expanded={isCreateBrandSectionOpen}
          aria-controls="admin-create-brand-content"
        >
          <h2 className="admin-section-heading admin-section-heading-with-badge">
            <span>{t.adminPanel.createBrandTitle}</span>
            <span className="admin-site-badge">{t.adminPanel.siteSectionBadge}</span>
          </h2>
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
                onChange={(e) => setNewBrandName(e.target.value)}
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
              <select
                className="form-input"
                style={{ minWidth: '260px' }}
                value={deleteBrandSlug}
                onChange={(e) => setDeleteBrandSlug(e.target.value)}
              >
                <option value="">{t.adminPanel.chooseBrand}</option>
                {brands.map((brand) => (
                  <option key={brand.slug || brand.id} value={brand.slug}>{brand.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteBrandQuick}
                disabled={!deleteBrandSlug || deletingBrand}
              >
                {deletingBrand ? t.pages.loading : t.pages.brandDelete}
              </button>
            </div>
            </form>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card admin-option-user-supervision admin-collapsible-main">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsUserModerationSectionOpen((prev) => !prev)}
          aria-expanded={isUserModerationSectionOpen}
          aria-controls="admin-user-moderation-content"
        >
          <h2 className="admin-section-heading admin-section-heading-with-badge">
            <span>{t.adminPanel.usersModerationTitle}</span>
            <span className="admin-main-badge">{t.adminPanel.mainSectionBadge}</span>
          </h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isUserModerationSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isUserModerationSectionOpen && (
          <div id="admin-user-moderation-content">
            <p className="admin-subtitle">{t.adminPanel.usersModerationSubtitle}</p>

            <div className="admin-actions-row" style={{ justifyContent: 'flex-start', marginTop: '0.85rem' }}>
              <input
                className="form-input"
                style={{ minWidth: '280px' }}
                placeholder={t.adminPanel.usersSearchPlaceholder}
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
              />
              <select
                className="form-select"
                value={usersRoleFilter}
                onChange={(e) => setUsersRoleFilter(e.target.value)}
                aria-label={t.adminPanel.usersRoleFilterLabel}
              >
                <option value="all">{t.adminPanel.usersRoleAll}</option>
                <option value="admin">{t.adminPanel.usersRoleAdminOnly}</option>
                <option value="user">{t.adminPanel.usersRoleUserOnly}</option>
              </select>
              <select
                className="form-select"
                value={usersStatusFilter}
                onChange={(e) => setUsersStatusFilter(e.target.value)}
                aria-label={t.adminPanel.usersStatusFilterLabel}
              >
                <option value="all">{t.adminPanel.usersStatusAll}</option>
                <option value="active">{t.adminPanel.usersStatusActiveOnly}</option>
                <option value="blocked">{t.adminPanel.usersStatusBlockedOnly}</option>
              </select>
              <select
                className="form-select"
                value={usersSort}
                onChange={(e) => setUsersSort(e.target.value)}
                aria-label={t.adminPanel.usersSortLabel}
              >
                <option value="username_asc">{t.adminPanel.usersSortUsernameAsc}</option>
                <option value="username_desc">{t.adminPanel.usersSortUsernameDesc}</option>
                <option value="newest">{t.adminPanel.usersSortNewest}</option>
                <option value="last_login">{t.adminPanel.usersSortLastLogin}</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  await Promise.all([loadUsers(), loadActiveUsers()])
                }}
                disabled={usersLoading || activeUsersLoading}
              >
                {(usersLoading || activeUsersLoading) ? t.pages.loading : t.adminPanel.refreshUsers}
              </button>
            </div>

            <div className="admin-actions-row" style={{ justifyContent: 'flex-start', gap: '0.65rem', marginTop: '0.35rem' }}>
              <span className="admin-meta"><strong>{t.adminPanel.usersStatTotal}:</strong> {usersStats.total}</span>
              <span className="admin-meta"><strong>{t.adminPanel.usersStatAdmins}:</strong> {usersStats.admins}</span>
              <span className="admin-meta"><strong>{t.adminPanel.usersStatActive}:</strong> {usersStats.active}</span>
              <span className="admin-meta"><strong>{t.adminPanel.usersStatBlocked}:</strong> {usersStats.blocked}</span>
              <span className="admin-meta"><strong>{t.adminPanel.usersStatOnlineNow}:</strong> {activeUsersList.length}</span>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <p className="admin-section-caption" style={{ marginBottom: '0.35rem' }}>{t.adminPanel.recentActionsTitle}</p>
              <p className="admin-meta" style={{ marginBottom: '0.55rem' }}>{t.adminPanel.recentActionsSubtitle}</p>

              <div className="admin-actions-row" style={{ justifyContent: 'flex-start', marginBottom: '0.55rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={loadRecentActions}
                  disabled={recentActionsLoading}
                >
                  {recentActionsLoading ? t.pages.loading : t.adminPanel.refreshRecentActions}
                </button>
              </div>

              <div className="admin-review-list">
                {(recentActionsLoading && recentActions.length === 0) && (
                  <p className="admin-meta">{t.pages.loading}</p>
                )}

                {!recentActionsLoading && recentActions.length === 0 && (
                  <p className="admin-meta">{t.adminPanel.recentActionsEmpty}</p>
                )}

                {recentActions.length > 0 && (
                  <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.45rem 0.25rem' }}>{t.adminPanel.recentActionsWhenLabel}</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem 0.25rem' }}>{t.adminPanel.recentActionsWhoLabel}</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem 0.25rem' }}>{t.adminPanel.recentActionsWhatLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActions.map((entry) => (
                        <tr key={entry.id}>
                          <td style={{ padding: '0.45rem 0.25rem', whiteSpace: 'nowrap' }}>{formatUserDate(entry.created_at)}</td>
                          <td style={{ padding: '0.45rem 0.25rem' }}>{entry.actor_username || '—'}</td>
                          <td style={{ padding: '0.45rem 0.25rem' }}>{formatAdminActionMessage(entry)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <p className="admin-section-caption" style={{ marginBottom: '0.35rem' }}>{t.adminPanel.usersActiveNowTitle}</p>
              <p className="admin-meta" style={{ marginBottom: '0.55rem' }}>{t.adminPanel.usersActiveNowSubtitle}</p>

              <div className="admin-review-list">
                {(activeUsersLoading && activeUsersList.length === 0) && (
                  <p className="admin-meta">{t.pages.loading}</p>
                )}

                {!activeUsersLoading && activeUsersList.length === 0 && (
                  <p className="admin-meta">{t.adminPanel.usersNoActiveNow}</p>
                )}

                {activeUsersList.length > 0 && (
                  <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.45rem 0.25rem' }}>{t.adminPanel.usersFieldUsername}</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem 0.25rem' }}>{t.adminPanel.usersFieldEmail}</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem 0.25rem' }}>{t.adminPanel.usersRoleFilterLabel}</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem 0.25rem' }}>{t.adminPanel.usersLastSeenLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeUsersList.map((user) => (
                        <tr key={user.id}>
                          <td style={{ padding: '0.45rem 0.25rem' }}>{user.username}</td>
                          <td style={{ padding: '0.45rem 0.25rem' }}>{user.email || '—'}</td>
                          <td style={{ padding: '0.45rem 0.25rem' }}>{user.is_staff ? t.nav.roleAdmin : t.nav.roleUser}</td>
                          <td style={{ padding: '0.45rem 0.25rem' }}>{formatUserDate(user.profile?.last_seen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="admin-actions-row" style={{ justifyContent: 'flex-start', marginTop: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>{t.adminPanel.usersAuditDateFromLabel}</label>
              <input
                type="date"
                className="form-input"
                value={usersAuditFromDate}
                onChange={(e) => setUsersAuditFromDate(e.target.value)}
                style={{ maxWidth: '180px' }}
              />
              <label className="form-label" style={{ margin: 0 }}>{t.adminPanel.usersAuditDateToLabel}</label>
              <input
                type="date"
                className="form-input"
                value={usersAuditToDate}
                onChange={(e) => setUsersAuditToDate(e.target.value)}
                style={{ maxWidth: '180px' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportAllAuditCsv}
                disabled={usersAuditExporting}
              >
                {usersAuditExporting ? t.pages.loading : t.adminPanel.usersExportAllAuditCsv}
              </button>
            </div>

            {usersMessage && <p className="form-success">{usersMessage}</p>}
            {usersError && <p className="form-error">{usersError}</p>}

            <div className="admin-review-list">
              {!usersLoading && filteredUsers.length === 0 && (
                <p className="admin-meta">{t.adminPanel.noUsersToModerate}</p>
              )}

              {filteredUsers.map((user) => (
                <article key={user.id} className="admin-review-card">
                  <div className="admin-review-card-head">
                    <div>
                      <h3 className="admin-review-title">{user.username}</h3>
                      <p className="admin-meta">
                        {user.email || '—'}
                        {' • '}
                        {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '—'}
                        {' • '}
                        {user.is_staff ? t.nav.roleAdmin : t.nav.roleUser}
                        {' • '}
                        {user.is_active ? t.adminPanel.userStatusActive : t.adminPanel.userStatusBlocked}
                        {user.is_superuser ? ` • ${t.adminPanel.usersSuperuserLabel}` : ''}
                        {currentUser?.id === user.id ? ` • ${t.adminPanel.usersYouLabel}` : ''}
                      </p>
                      <p className="admin-meta">
                        {t.adminPanel.usersLastLoginLabel}: {formatUserDate(user.last_login)}
                        {' • '}
                        {t.adminPanel.usersLastSeenLabel}: {formatUserDate(user.profile?.last_seen)}
                        {' • '}
                        {t.adminPanel.usersJoinedLabel}: {formatUserDate(user.date_joined)}
                      </p>
                    </div>
                    <div className="admin-actions-row">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openUserDetails(user)}
                        disabled={usersLoading || savingUserDetails}
                      >
                        {expandedUserId === user.id ? t.adminPanel.usersHideDetails : t.adminPanel.usersEditDetails}
                      </button>
                      {!user.is_superuser && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleToggleUserRole(user)}
                          disabled={usersLoading || currentUser?.id === user.id}
                        >
                          {user.is_staff ? t.adminPanel.usersSetRoleUser : t.adminPanel.usersSetRoleAdmin}
                        </button>
                      )}
                      {!user.is_superuser && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleToggleUserActive(user)}
                          disabled={usersLoading || currentUser?.id === user.id}
                        >
                          {user.is_active ? t.adminPanel.usersBlock : t.adminPanel.usersUnblock}
                        </button>
                      )}
                      {!user.is_superuser && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDeleteUser(user)}
                          disabled={usersLoading || currentUser?.id === user.id}
                        >
                          {t.adminPanel.usersDelete}
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedUserId === user.id && userEditDraft?.id === user.id && (
                    <div className="admin-review-edit-grid" style={{ marginTop: '0.85rem' }}>
                      <div>
                        <label className="form-label">{t.adminPanel.usersFieldUsername}</label>
                        <input
                          className="form-input"
                          value={userEditDraft.username}
                          readOnly
                          disabled
                        />
                      </div>
                      <div>
                        <label className="form-label">{t.adminPanel.usersFieldEmail}</label>
                        <input
                          className="form-input"
                          type="email"
                          value={userEditDraft.email}
                          onChange={(e) => handleUserDraftChange('email', e.target.value)}
                          disabled={savingUserDetails}
                        />
                      </div>
                      <div>
                        <label className="form-label">{t.adminPanel.usersFieldFirstName}</label>
                        <input
                          className="form-input"
                          value={userEditDraft.first_name}
                          onChange={(e) => handleUserDraftChange('first_name', e.target.value)}
                          disabled={savingUserDetails}
                        />
                      </div>
                      <div>
                        <label className="form-label">{t.adminPanel.usersFieldLastName}</label>
                        <input
                          className="form-input"
                          value={userEditDraft.last_name}
                          onChange={(e) => handleUserDraftChange('last_name', e.target.value)}
                          disabled={savingUserDetails}
                        />
                      </div>
                      <div>
                        <label className="form-label">{t.adminPanel.usersFieldPhone}</label>
                        <input
                          className="form-input"
                          value={userEditDraft.profile_phone}
                          onChange={(e) => handleUserDraftChange('profile_phone', e.target.value)}
                          disabled={savingUserDetails}
                        />
                      </div>
                      <div>
                        <label className="form-label">{t.adminPanel.usersFieldLocation}</label>
                        <input
                          className="form-input"
                          value={userEditDraft.profile_location}
                          onChange={(e) => handleUserDraftChange('profile_location', e.target.value)}
                          disabled={savingUserDetails}
                        />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">{t.adminPanel.usersFieldBio}</label>
                        <textarea
                          className="form-input form-textarea"
                          rows={3}
                          value={userEditDraft.profile_bio}
                          onChange={(e) => handleUserDraftChange('profile_bio', e.target.value)}
                          disabled={savingUserDetails}
                        />
                      </div>
                      <div>
                        <label className="form-label">{t.adminPanel.usersFieldNewPassword}</label>
                        <input
                          className="form-input"
                          type="password"
                          value={userEditDraft.new_password}
                          onChange={(e) => handleUserDraftChange('new_password', e.target.value)}
                          disabled={savingUserDetails}
                          placeholder={t.adminPanel.usersPasswordPlaceholder}
                        />
                      </div>
                      <div>
                        <label className="form-label">{t.adminPanel.usersFieldConfirmPassword}</label>
                        <input
                          className="form-input"
                          type="password"
                          value={userEditDraft.confirm_password}
                          onChange={(e) => handleUserDraftChange('confirm_password', e.target.value)}
                          disabled={savingUserDetails}
                          placeholder={t.adminPanel.usersPasswordPlaceholder}
                        />
                        {isPasswordConfirmationValid && (
                          <p className="form-success" style={{ marginTop: '0.45rem' }}>
                            {t.adminPanel.usersPasswordMatch}
                          </p>
                        )}
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-checkbox-row">
                          <input
                            type="checkbox"
                            checked={!!userEditDraft.force_password_reset}
                            onChange={(e) => handleUserDraftChange('force_password_reset', e.target.checked)}
                            disabled={savingUserDetails}
                          />
                          {t.adminPanel.usersForcePasswordResetToggle}
                        </label>
                      </div>

                      <div className="admin-actions-row" style={{ gridColumn: '1 / -1', justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleGenerateTemporaryPassword(user)}
                          disabled={savingUserDetails || currentUser?.id === user.id || user.is_superuser}
                        >
                          {t.adminPanel.usersGenerateTemporaryPassword}
                        </button>
                        {generatedTempPassword && (
                          <>
                            <span className="admin-meta"><strong>{t.adminPanel.usersTemporaryPasswordLabel}:</strong> {generatedTempPassword}</span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={handleCopyTemporaryPassword}
                            >
                              {t.adminPanel.usersCopyTemporaryPassword}
                            </button>
                          </>
                        )}
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <p className="admin-section-caption" style={{ marginBottom: '0.5rem' }}>{t.adminPanel.usersPasswordAuditTitle}</p>
                        <div className="admin-actions-row" style={{ justifyContent: 'flex-start', marginBottom: '0.45rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleExportUserAuditCsv(user)}
                          >
                            {t.adminPanel.usersExportAuditCsv}
                          </button>
                        </div>
                        {usersAuditLoading ? (
                          <p className="admin-meta">{t.pages.loading}</p>
                        ) : (
                          <div className="admin-review-list">
                            {(usersAuditLogs[user.id] || []).length === 0 && (
                              <p className="admin-meta">{t.adminPanel.usersPasswordAuditEmpty}</p>
                            )}
                            {(usersAuditLogs[user.id] || []).map((entry) => (
                              <p key={entry.id} className="admin-meta">
                                {formatUserDate(entry.changed_at)}
                                {' • '}
                                {entry.changed_by_username || t.adminPanel.usersNeverLabel}
                                {' • '}
                                {entry.reason || 'password_change'}
                                {entry.is_temporary ? ` • ${t.adminPanel.usersTemporaryPasswordBadge}` : ''}
                                {entry.force_reset_required ? ` • ${t.adminPanel.usersForceResetBadge}` : ''}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="admin-actions-row" style={{ gridColumn: '1 / -1' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openUserDetails(user)}
                          disabled={savingUserDetails}
                        >
                          {t.adminPanel.cancelEdit}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleSaveUserDetails(user)}
                          disabled={savingUserDetails}
                        >
                          {savingUserDetails ? t.pages.loading : t.adminPanel.usersSaveDetails}
                        </button>
                      </div>

                      {usersMessage && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <p className="form-success" style={{ marginTop: '0.35rem' }}>{usersMessage}</p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card admin-option-manage-reviews">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsManageReviewsSectionOpen((prev) => !prev)}
          aria-expanded={isManageReviewsSectionOpen}
          aria-controls="admin-manage-reviews-content"
        >
          <h2 className="admin-section-heading admin-section-heading-with-badge">
            <span>{t.adminPanel.manageReviewsTitle}</span>
            <span className="admin-site-badge">{t.adminPanel.siteSectionBadge}</span>
          </h2>
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
                      <p className="admin-meta">{review.car_brand_name} {review.car_name} • {review.publication_name} • {getReviewCategoryLabel(review.category, t)} {review.is_pinned ? '• PINNED' : ''}</p>
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
                          <label className="form-label" htmlFor={`edit-review-category-${review.id}`}>{t.adminPanel.reviewCategory}</label>
                          <select
                            id={`edit-review-category-${review.id}`}
                            className="form-input"
                            value={reviewEditDraft.category}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, category: e.target.value }))}
                          >
                            <option value="test">{t.adminPanel.reviewCategoryTest}</option>
                            <option value="news">{t.adminPanel.reviewCategoryNews}</option>
                            <option value="guide">{t.adminPanel.reviewCategoryGuide}</option>
                            <option value="opinion">{t.adminPanel.reviewCategoryOpinion}</option>
                          </select>
                        </div>

                        <div className="admin-form-grid-full">
                          <label className="form-label" htmlFor={`edit-review-tags-${review.id}`}>{t.adminPanel.reviewTags}</label>
                          <input
                            id={`edit-review-tags-${review.id}`}
                            className="form-input"
                            value={reviewEditDraft.tags}
                            onChange={(e) => setReviewEditDraft((prev) => ({ ...prev, tags: e.target.value }))}
                          />
                        </div>

                        <div className="admin-form-grid-full">
                          <RichTextEditor
                            id={`edit-review-summary-${review.id}`}
                            label={t.adminPanel.reviewSummary}
                            value={reviewEditDraft.summary}
                            onChange={(nextValue) => setReviewEditDraft((prev) => ({ ...prev, summary: nextValue }))}
                            compact
                          />
                        </div>

                        <div className="admin-form-grid-full">
                          <RichTextEditor
                            id={`edit-review-content-${review.id}`}
                            label={t.adminPanel.reviewContent}
                            value={reviewEditDraft.content}
                            onChange={(nextValue) => setReviewEditDraft((prev) => ({ ...prev, content: nextValue }))}
                          />
                        </div>

                        <div className="admin-form-grid-full">
                          <RichTextEditor
                            id={`edit-review-notes-${review.id}`}
                            label={t.adminPanel.reviewInternalNotes}
                            rows={4}
                            value={reviewEditDraft.internal_notes}
                            onChange={(nextValue) => setReviewEditDraft((prev) => ({ ...prev, internal_notes: nextValue }))}
                          />
                        </div>

                        <div className="admin-form-grid-full">
                          <RichTextEditor
                            id={`edit-review-verdict-${review.id}`}
                            label={t.adminPanel.reviewVerdict}
                            rows={4}
                            value={reviewEditDraft.verdict}
                            onChange={(nextValue) => setReviewEditDraft((prev) => ({ ...prev, verdict: nextValue }))}
                            compact
                          />
                        </div>
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
                        {t.adminPanel.reviewPinTop}
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

      <section className="admin-form-card admin-collapsible-card admin-option-create-review">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsCreateReviewSectionOpen((prev) => !prev)}
          aria-expanded={isCreateReviewSectionOpen}
          aria-controls="admin-create-review-content"
        >
          <h2 className="admin-section-heading admin-section-heading-with-badge">
            <span>{t.adminPanel.createReviewTitle}</span>
            <span className="admin-site-badge">{t.adminPanel.siteSectionBadge}</span>
          </h2>
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
                  <label className="form-label" htmlFor="new-review-slug">{t.adminPanel.reviewSlug}</label>
                  <input
                    id="new-review-slug"
                    className="form-input"
                    value={newReviewSlug}
                    onChange={(e) => setNewReviewSlug(e.target.value)}
                    placeholder={t.adminPanel.reviewSlugPlaceholder}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="new-review-category">{t.adminPanel.reviewCategory}</label>
                  <select
                    id="new-review-category"
                    className="form-input"
                    value={newReviewCategory}
                    onChange={(e) => setNewReviewCategory(e.target.value)}
                  >
                    <option value="test">{t.adminPanel.reviewCategoryTest}</option>
                    <option value="news">{t.adminPanel.reviewCategoryNews}</option>
                    <option value="guide">{t.adminPanel.reviewCategoryGuide}</option>
                    <option value="opinion">{t.adminPanel.reviewCategoryOpinion}</option>
                  </select>
                </div>

                <div className="admin-form-grid-full">
                  <label className="form-label" htmlFor="new-review-tags">{t.adminPanel.reviewTags}</label>
                  <input
                    id="new-review-tags"
                    className="form-input"
                    value={newReviewTags}
                    onChange={(e) => setNewReviewTags(e.target.value)}
                    placeholder={t.adminPanel.reviewTagsPlaceholder}
                  />
                </div>

                <div className="admin-form-grid-full">
                  <RichTextEditor
                    id="new-review-summary"
                    label={t.adminPanel.reviewSummary}
                    value={newReviewSummary}
                    onChange={setNewReviewSummary}
                    compact
                  />
                </div>

                <div className="admin-form-grid-full">
                  <RichTextEditor
                    id="new-review-content"
                    label={t.adminPanel.reviewContent}
                    value={newReviewContent}
                    onChange={setNewReviewContent}
                  />
                </div>

                <div className="admin-form-grid-full">
                  <RichTextEditor
                    id="new-review-internal-notes"
                    label={t.adminPanel.reviewInternalNotes}
                    rows={4}
                    value={newReviewInternalNotes}
                    onChange={setNewReviewInternalNotes}
                  />
                </div>

                <div className="admin-form-grid-full">
                  <RichTextEditor
                    id="new-review-verdict"
                    label={t.adminPanel.reviewVerdict}
                    rows={4}
                    value={newReviewVerdict}
                    onChange={setNewReviewVerdict}
                    compact
                  />
                </div>

                <div className="admin-form-grid-full">
                  <label className="form-label" htmlFor="new-review-first-slider">{t.adminPanel.reviewFirstSlider || 'Example photo gallery (max 12 images)'}</label>
                  <input
                    id="new-review-first-slider"
                    type="file"
                    multiple
                    accept="image/*"
                    className="form-input"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length > 12) {
                        alert('Maximum 12 images allowed for main gallery')
                        return
                      }
                      setNewReviewFirstSliderFiles(files)
                    }}
                  />
                  {newReviewFirstSliderFiles.length > 0 && (
                    <p className="form-info">{newReviewFirstSliderFiles.length} image(s) selected</p>
                  )}
                </div>

                <div className="admin-form-grid-full">
                  <label className="form-label" htmlFor="new-review-second-slider">{t.adminPanel.reviewSecondSlider || 'Second photo gallery'}</label>
                  <input
                    id="new-review-second-slider"
                    type="file"
                    multiple
                    accept="image/*"
                    className="form-input"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      setNewReviewSecondSliderFiles(files)
                    }}
                  />
                  {newReviewSecondSliderFiles.length > 0 && (
                    <p className="form-info">{newReviewSecondSliderFiles.length} image(s) selected</p>
                  )}
                </div>
              </div>

              <div className="admin-actions-row admin-auto-tools-row" style={{ justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm admin-auto-tools-btn"
                  onClick={() => {
                    if (!newReviewSlug.trim()) setNewReviewSlug(toSlug(newReviewTitle))
                  }}
                >
                  {t.adminPanel.reviewAutoTools}
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
                {t.adminPanel.reviewPinTop}
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
                <select
                  className="form-input"
                  style={{ minWidth: '260px' }}
                  value={deleteReviewId}
                  onChange={(e) => setDeleteReviewId(e.target.value)}
                >
                  <option value="">{t.adminPanel.deleteReview}</option>
                  {pressReviews.map((review) => (
                    <option key={review.id} value={review.id}>{review.title}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteReviewQuick}
                  disabled={!deleteReviewId || deletingReview}
                >
                  {deletingReview ? t.pages.loading : t.adminPanel.deleteReview}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card admin-option-create-model">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsCreateModelSectionOpen((prev) => !prev)}
          aria-expanded={isCreateModelSectionOpen}
          aria-controls="admin-create-model-content"
        >
          <h2 className="admin-section-heading admin-section-heading-with-badge">
            <span>{t.adminPanel.createModelTitle}</span>
            <span className="admin-site-badge">{t.adminPanel.siteSectionBadge}</span>
          </h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isCreateModelSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isCreateModelSectionOpen && (
          <div id="admin-create-model-content">
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
                onChange={(e) => setNewModelName(e.target.value)}
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
              <label className="form-label" htmlFor="new-model-price-min">{t.adminPanel.priceMinK}</label>
              <input
                id="new-model-price-min"
                type="number"
                className="form-input"
                value={newModelPriceMin}
                onChange={(e) => setNewModelPriceMin(e.target.value)}
                placeholder="20000"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-model-price-max">{t.adminPanel.priceMaxK}</label>
              <input
                id="new-model-price-max"
                type="number"
                className="form-input"
                value={newModelPriceMax}
                onChange={(e) => setNewModelPriceMax(e.target.value)}
                placeholder="35000"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="new-model-currency">{t.adminPanel.baseCurrency}</label>
              <select
                id="new-model-currency"
                className="form-input"
                value={newModelCurrency}
                onChange={(e) => setNewModelCurrency(e.target.value)}
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
              <select
                className="form-input"
                style={{ minWidth: '260px' }}
                value={deleteModelId}
                onChange={(e) => setDeleteModelId(e.target.value)}
              >
                <option value="">{t.adminPanel.deleteModel}</option>
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>{car.brand_name} {car.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteModelQuick}
                disabled={!deleteModelId || deletingModel}
              >
                {deletingModel ? t.pages.loading : t.adminPanel.deleteModel}
              </button>
            </div>
            </form>
          </div>
        )}
      </section>

      <section className="admin-form-card admin-collapsible-card admin-option-header-settings admin-collapsible-main">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsHeaderSectionOpen((prev) => !prev)}
          aria-expanded={isHeaderSectionOpen}
          aria-controls="admin-header-settings-content"
        >
          <h2 className="admin-section-heading admin-section-heading-with-badge">
            <span>{t.adminPanel.headerSettingsTitle}</span>
            <span className="admin-main-badge">{t.adminPanel.mainSectionBadge}</span>
          </h2>
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
          <div className="admin-inline-field-row admin-inline-field-row-language">
            <label className="form-label" htmlFor="header-lang">{t.adminPanel.textLanguage}</label>
            <select
              id="header-lang"
              className="form-input admin-inline-field-select"
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
            <label className="form-label" htmlFor="header-tagline">{t.adminPanel.headerTagline}</label>
            <textarea
              id="header-tagline"
              className="form-input form-textarea"
              rows={3}
              value={headerTagline}
              onChange={(e) => setHeaderTagline(e.target.value)}
              placeholder={t.adminPanel.headerTaglinePlaceholder}
            />
            <p className="admin-field-note">{t.adminPanel.headerTaglineHint}</p>
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

      <section className="admin-form-card admin-collapsible-card admin-option-footer-settings admin-collapsible-main">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsFooterSectionOpen((prev) => !prev)}
          aria-expanded={isFooterSectionOpen}
          aria-controls="admin-footer-settings-content"
        >
          <h2 className="admin-section-heading admin-section-heading-with-badge">
            <span>{t.adminPanel.footerSettingsTitle}</span>
            <span className="admin-main-badge">{t.adminPanel.mainSectionBadge}</span>
          </h2>
          <span className={`admin-inline-toggle admin-inline-gear ${isFooterSectionOpen ? 'is-open' : ''}`} aria-hidden="true">
            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </span>
        </button>

        {isFooterSectionOpen && (
          <div id="admin-footer-settings-content">
            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="footer-email">{t.adminPanel.footerEmailLabel}</label>
              <input
                id="footer-email"
                className="form-input"
                value={footerEmail}
                onChange={(e) => setFooterEmail(e.target.value)}
                placeholder={t.adminPanel.footerEmailPlaceholder}
              />
            </div>

            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="footer-phone">{t.adminPanel.footerPhoneLabel}</label>
              <input
                id="footer-phone"
                className="form-input"
                value={footerPhone}
                onChange={(e) => setFooterPhone(e.target.value)}
                placeholder={t.adminPanel.footerPhonePlaceholder}
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

      <section className="admin-form-card admin-collapsible-card admin-option-text-manager admin-collapsible-main">
        <button
          type="button"
          className="admin-collapsible-toggle"
          onClick={() => setIsTextManagerSectionOpen((prev) => !prev)}
          aria-expanded={isTextManagerSectionOpen}
          aria-controls="admin-text-manager-content"
        >
          <h2 className="admin-section-heading admin-section-heading-with-badge">
            <span>{t.adminPanel.textManagerTitle}</span>
            <span className="admin-main-badge">{t.adminPanel.mainSectionBadge}</span>
          </h2>
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
              <div className="admin-inline-field-row admin-inline-field-row-language">
                <label className="form-label" htmlFor="content-lang">{t.adminPanel.textLanguage}</label>
                <select
                  id="content-lang"
                  className="form-input admin-inline-field-select"
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
    </div>
  )
}
