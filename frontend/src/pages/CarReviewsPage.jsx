import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getCarImage } from '../utils/carImages'

export default function CarReviewsPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [car, setCar] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [carResponse, opinionsResponse] = await Promise.all([
          api.get(`/cars/${id}/`),
          api.get(`/opinions/?car_model=${id}&ordering=-created_at&page_size=200`),
        ])
        setCar(carResponse.data)
        setReviews(opinionsResponse.data.results || opinionsResponse.data || [])
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
            <span className="detail-badge">{reviews.length} {reviews.length === 1 ? t.pages.opinionSingle : t.pages.opinionPlural}</span>
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
                <p className="opinion-meta">{review.author?.username || t.pages.unknownAuthor}</p>
                <p className="opinion-text">{review.content}</p>
                <div className="opinion-rating-row">
                  <span className="rating">★ {review.rating}</span>
                  <span className="opinion-counts">👍 {review.helpful_count} | 👎 {review.unhelpful_count}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
