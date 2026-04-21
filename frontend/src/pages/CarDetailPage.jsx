import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getCarImage } from '../utils/carImages'
import { isAdminUser } from '../utils/auth'

export default function CarDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [car, setCar] = useState(null)
  const [opinions, setOpinions] = useState([])
  const [loading, setLoading] = useState(true)
  const [adminDescription, setAdminDescription] = useState('')
  const [adminYearIntroduced, setAdminYearIntroduced] = useState('')
  const [adminVehicleType, setAdminVehicleType] = useState('sedan')
  const [adminEngineType, setAdminEngineType] = useState('')
  const [adminHorsepower, setAdminHorsepower] = useState('')
  const [adminAcceleration, setAdminAcceleration] = useState('')
  const [adminTopSpeed, setAdminTopSpeed] = useState('')
  const [adminFuelConsumption, setAdminFuelConsumption] = useState('')
  const [adminPriceRange, setAdminPriceRange] = useState('')
  const [adminProductionStatus, setAdminProductionStatus] = useState('active')
  const [adminFeatured, setAdminFeatured] = useState(false)
  const [adminImage, setAdminImage] = useState(null)
  const [adminOpinionTitle, setAdminOpinionTitle] = useState('')
  const [adminOpinionContent, setAdminOpinionContent] = useState('')
  const [adminOpinionRating, setAdminOpinionRating] = useState(5)
  const [adminOpinionSaving, setAdminOpinionSaving] = useState(false)
  const [adminOpinionMessage, setAdminOpinionMessage] = useState('')
  const [adminOpinionError, setAdminOpinionError] = useState('')
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  const [adminError, setAdminError] = useState('')
  const isAdmin = isAdminUser()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        const [carResponse, opinionsResponse] = await Promise.all([
          api.get(`/cars/${id}/`),
          api.get(`/opinions/?car_model=${id}&ordering=-created_at`),
        ])

        setCar(carResponse.data)
        setOpinions(opinionsResponse.data.results || opinionsResponse.data)

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
          setAdminFuelConsumption(carResponse.data.fuel_consumption || '')
          setAdminPriceRange(carResponse.data.price_range || '')
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
      formData.append('fuel_consumption', adminFuelConsumption)
      formData.append('price_range', adminPriceRange)
      formData.append('production_status', adminProductionStatus)
      formData.append('is_featured', String(adminFeatured))
      if (adminImage) {
        formData.append('image', adminImage)
      }

      const response = await api.patch(`/cars/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setCar(response.data)
      setAdminImage(null)
      setAdminMessage(t.adminInline.saved)
    } catch {
      setAdminError(t.adminInline.saveError)
    } finally {
      setAdminSaving(false)
    }
  }

  const handleAdminOpinionCreate = async (e) => {
    e.preventDefault()
    if (!isAdmin || !car) return

    const trimmedTitle = String(adminOpinionTitle || '').trim()
    const trimmedContent = String(adminOpinionContent || '').trim()
    const ratingValue = Number.parseInt(String(adminOpinionRating || '').trim(), 10)

    if (!trimmedTitle || !trimmedContent || Number.isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      setAdminOpinionMessage('')
      setAdminOpinionError(t.pages.opinionCreateValidation)
      return
    }

    try {
      setAdminOpinionSaving(true)
      setAdminOpinionMessage('')
      setAdminOpinionError('')

      await api.post('/opinions/', {
        car_model: car.id,
        title: trimmedTitle,
        content: trimmedContent,
        rating: ratingValue,
      })

      const [carResponse, opinionsResponse] = await Promise.all([
        api.get(`/cars/${id}/`),
        api.get(`/opinions/?car_model=${id}&ordering=-created_at`),
      ])
      setCar(carResponse.data)
      setOpinions(opinionsResponse.data.results || opinionsResponse.data)

      setAdminOpinionTitle('')
      setAdminOpinionContent('')
      setAdminOpinionRating(5)
      setAdminOpinionMessage(t.pages.opinionCreated)
    } catch {
      setAdminOpinionError(t.pages.opinionCreateError)
    } finally {
      setAdminOpinionSaving(false)
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
          <p className="detail-kicker">{car.brand?.name || ''}</p>
          <h1 className="page-title detail-title">{car.name}</h1>
          <p className="detail-description">{car.description}</p>

          <div className="detail-badges">
            <span className="detail-badge">{car.vehicle_type}</span>
            <span className="detail-badge">{car.year_introduced}</span>
            <span className="detail-badge">{car.production_status}</span>
          </div>
        </div>

        <img src={getCarImage(car)} alt={car.name} className="detail-image" />
      </section>

      <section className="detail-specs-card">
        <h2 className="detail-section-title">{t.pages.specs}</h2>
        <div className="detail-specs-grid">
          <div className="spec-item"><span>{t.pages.year}</span><strong>{car.year_introduced || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.type}</span><strong>{car.vehicle_type || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.engine}</span><strong>{car.engine_type || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.horsepower}</span><strong>{car.horsepower || '-'} hp</strong></div>
          <div className="spec-item"><span>{t.pages.acceleration}</span><strong>{car.acceleration || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.topSpeed}</span><strong>{car.top_speed || '-'} km/h</strong></div>
          <div className="spec-item"><span>{t.pages.fuelConsumption}</span><strong>{car.fuel_consumption || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.price}</span><strong>{car.price_range || '-'}</strong></div>
        </div>
      </section>

      <section className="detail-extra-grid">
        <article className="detail-extra-card">
          <h3 className="detail-extra-title">{t.pages.sectionPerformance}</h3>
          <div className="detail-kv-list">
            <div className="detail-kv-row">
              <span>{t.pages.horsepower}</span>
              <strong>{car.horsepower || '-'} hp</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.acceleration}</span>
              <strong>{car.acceleration || '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.topSpeed}</span>
              <strong>{car.top_speed || '-'} km/h</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.fuelConsumption}</span>
              <strong>{car.fuel_consumption || '-'}</strong>
            </div>
          </div>
        </article>

        <article className="detail-extra-card">
          <h3 className="detail-extra-title">{t.pages.sectionMarket}</h3>
          <div className="detail-kv-list">
            <div className="detail-kv-row">
              <span>{t.pages.price}</span>
              <strong>{car.price_range || '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.productionStatus}</span>
              <strong>{car.production_status || '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.modelAge}</span>
              <strong>{modelAge !== null ? `${modelAge} ${t.pages.years}` : '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.featuredModel}</span>
              <strong>{car.is_featured ? t.pages.yes : t.pages.no}</strong>
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
              <strong>{car.vehicle_type || '-'}</strong>
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

      <section className="detail-opinions">
        <h2 className="detail-section-title">{t.pages.carOpinions}</h2>

        {isAdmin && (
          <form className="admin-form-card" onSubmit={handleAdminOpinionCreate}>
            <h3 className="detail-section-title">{t.pages.addOpinionTitle}</h3>

            <label className="form-label" htmlFor="admin-opinion-title">{t.pages.opinionTitle}</label>
            <input
              id="admin-opinion-title"
              className="form-input"
              value={adminOpinionTitle}
              onChange={(e) => setAdminOpinionTitle(e.target.value)}
            />

            <label className="form-label" htmlFor="admin-opinion-content">{t.adminPanel.description}</label>
            <textarea
              id="admin-opinion-content"
              className="form-input form-textarea"
              rows={4}
              value={adminOpinionContent}
              onChange={(e) => setAdminOpinionContent(e.target.value)}
            />

            <label className="form-label" htmlFor="admin-opinion-rating">{t.pages.averageRating}</label>
            <select
              id="admin-opinion-rating"
              className="form-input"
              value={adminOpinionRating}
              onChange={(e) => setAdminOpinionRating(e.target.value)}
            >
              <option value={5}>5</option>
              <option value={4}>4</option>
              <option value={3}>3</option>
              <option value={2}>2</option>
              <option value={1}>1</option>
            </select>

            {adminOpinionMessage && <p className="form-success">{adminOpinionMessage}</p>}
            {adminOpinionError && <p className="form-error">{adminOpinionError}</p>}

            <button type="submit" className="btn btn-primary" disabled={adminOpinionSaving}>
              {adminOpinionSaving ? t.pages.loading : t.pages.addOpinionSubmit}
            </button>
          </form>
        )}

        {opinions.length === 0 ? (
          <div className="page-card">{t.pages.noOpinions}</div>
        ) : (
          <div className="opinions-grid">
            {opinions.map((opinion) => (
              <article key={opinion.id} className="opinion-card-item">
                <h3 className="opinion-title">{opinion.title}</h3>
                <p className="opinion-meta">{opinion.author?.username || 'user'}</p>
                <p className="opinion-text">{opinion.content}</p>
                <div className="opinion-rating-row">
                  <span className="rating">★ {opinion.rating}</span>
                  <span className="opinion-counts">👍 {opinion.helpful_count} | 👎 {opinion.unhelpful_count}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="detail-admin-card">
          <h2 className="detail-section-title">{t.adminInline.detailEditor}</h2>
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

            <label className="form-label" htmlFor="admin-price">{t.adminPanel.priceRange}</label>
            <input
              id="admin-price"
              className="form-input"
              value={adminPriceRange}
              onChange={(e) => setAdminPriceRange(e.target.value)}
            />

            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={adminFeatured}
                onChange={(e) => setAdminFeatured(e.target.checked)}
              />
              {t.adminPanel.featured}
            </label>

            <label className="form-label" htmlFor="admin-image">{t.adminPanel.image}</label>
            <input
              id="admin-image"
              type="file"
              accept="image/*"
              className="form-input"
              onChange={(e) => setAdminImage(e.target.files?.[0] || null)}
            />

            {adminMessage && <p className="form-success">{adminMessage}</p>}
            {adminError && <p className="form-error">{adminError}</p>}

            <button type="submit" className="btn btn-primary" disabled={adminSaving}>
              {adminSaving ? t.pages.loading : t.adminInline.save}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
