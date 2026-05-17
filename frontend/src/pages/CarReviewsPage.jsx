import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getCarImage } from '../utils/carImages'

function decodeHtmlEntities(value) {
  if (!value) return ''
  const textarea = document.createElement('textarea')
  textarea.innerHTML = String(value)
  return textarea.value
}

function sanitizeRichHtml(value) {
  return DOMPurify.sanitize(decodeHtmlEntities(value))
}

export default function CarReviewsPage() {
  const { t, lang } = useTranslation()
  const { id } = useParams()
  const [car, setCar] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const getReviewCountLabel = (count) => {
    if (lang !== 'pl') return count === 1 ? t.pages.reviewSingle : t.pages.reviewPlural
    if (count === 1) return t.pages.reviewSingle

    const mod10 = count % 10
    const mod100 = count % 100
    const isFew = mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
    return isFew ? t.pages.reviewFew : t.pages.reviewPlural
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [carResponse, reviewsResponse] = await Promise.all([
          api.get(`/cars/${id}/`),
          api.get(`/reviews/?car_model=${id}&ordering=-published_at&page_size=200`),
        ])
        setCar(carResponse.data)
        setReviews(reviewsResponse.data.results || reviewsResponse.data || [])
      } catch (error) {
        console.error('Error fetching reviews:', error)
        setCar(null)
        setReviews([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  if (loading) {
    return <div className="page-loading">{t.pages.loading}</div>
  }

  if (!car) {
    return <div className="page-card">{t.pages.carNotFound}</div>
  }

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
        <Link to={`/cars/${car.id}`} className="breadcrumbs-link">{car.name}</Link>
        <span className="breadcrumbs-separator">/</span>
        <span className="breadcrumbs-current">{t.pages.reviewsSectionTitle}</span>
      </nav>

      <section className="detail-hero">
        <div className="detail-copy">
          <p className="detail-kicker">{car.brand?.name || ''}</p>
          <h1 className="page-title detail-title">{car.name} - {t.pages.reviewsSectionTitle}</h1>
          <p className="detail-description">{t.pages.reviewsSectionIntro}</p>

          <div className="detail-badges">
            <span className="detail-badge">{reviews.length} {getReviewCountLabel(reviews.length)}</span>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <Link to={`/cars/${car.id}`} className="btn btn-secondary btn-sm">{t.pages.backToCar}</Link>
          </div>
        </div>

        <img src={getCarImage(car)} alt={car.name} className="detail-image" />
      </section>

      {reviews.length === 0 ? (
        <div className="page-card">{t.pages.noReviewsYet}</div>
      ) : (
        <section className="detail-opinions">
          <div className="opinions-grid">
            {reviews.map((review) => (
              <article key={review.id} className="opinion-card-item">
                <h3 className="opinion-title">{review.title}</h3>
                <p className="opinion-meta">
                  {review.publication_name}
                  {review.author_name ? ` - ${review.author_name}` : ''}
                </p>
                <div className="opinion-text" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(review.content) }} />
                <div className="opinion-rating-row">
                  <span className="opinion-counts">{review.published_at}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
