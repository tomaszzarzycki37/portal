import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getCurrentUser, isAuthenticatedUser } from '../utils/auth'

export default function MyContentPage() {
  const { t, lang } = useTranslation()
  const currentUser = useMemo(() => getCurrentUser(), [])
  const isLoggedIn = useMemo(() => isAuthenticatedUser(), [])
  const [reviews, setReviews] = useState([])
  const [opinions, setOpinions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      if (!isLoggedIn || !currentUser?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const [reviewsResponse, opinionsResponse] = await Promise.all([
          api.get(`/reviews/?author=${currentUser.id}&page_size=200&ordering=-published_at`),
          api.get(`/opinions/?author=${currentUser.id}&page_size=200&ordering=-created_at`),
        ])

        setReviews(reviewsResponse.data.results || reviewsResponse.data || [])
        setOpinions(opinionsResponse.data.results || opinionsResponse.data || [])
      } catch {
        setError(t.adminPanel.loadError)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentUser?.id, isLoggedIn, t.adminPanel.loadError])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (!isLoggedIn) {
    return (
      <div className="opinions-page-wrap">
        <h1 className="page-title">{t.pages.myContentTitle}</h1>
        <p className="admin-subtitle">{t.pages.loginToContribute}</p>
        <Link to="/login" className="btn btn-primary btn-sm">{t.nav.login}</Link>
      </div>
    )
  }

  return (
    <div className="opinions-page-wrap">
      <h1 className="page-title">{t.pages.myContentTitle}</h1>
      <p className="admin-subtitle">{t.pages.myContentIntro}</p>

      <div className="admin-actions-row" style={{ marginBottom: '1rem' }}>
        <Link to="/reviews" className="btn btn-secondary btn-sm">{t.pages.openReviewsManager}</Link>
        <Link to="/opinions" className="btn btn-secondary btn-sm">{t.pages.openOpinionsManager}</Link>
      </div>

      {loading ? <div className="page-loading">{t.pages.loading}</div> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loading && !error && (
        <>
          <section className="admin-form-card" style={{ marginBottom: '1rem' }}>
            <h2 className="admin-section-heading">{t.pages.myReviewsSection}</h2>
            {reviews.length === 0 ? (
              <p className="admin-meta">{t.pages.noMyReviews}</p>
            ) : (
              <div className="opinions-list">
                {reviews.map((review) => (
                  <article key={review.id} className="opinion-list-item">
                    <div className="opinion-list-header">
                      <h3 className="opinion-title">{review.title}</h3>
                      <span className="opinion-rating">{String(review.category || 'test').toUpperCase()}</span>
                    </div>
                    <div className="opinion-list-meta">
                      <span>{review.publication_name}</span>
                      <span>{formatDate(review.published_at)}</span>
                    </div>
                    <p className="opinion-content">{review.summary || review.content}</p>
                    <div className="opinion-list-footer">
                      <span className="opinion-votes">
                        {review.is_published ? t.adminPanel.reviewPublished : t.pages.yourDraftLabel}
                      </span>
                      <Link to="/reviews" className="opinion-view-car">{t.pages.editLabel}</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-form-card">
            <h2 className="admin-section-heading">{t.pages.myOpinionsSection}</h2>
            {opinions.length === 0 ? (
              <p className="admin-meta">{t.pages.noMyOpinions}</p>
            ) : (
              <div className="opinions-list">
                {opinions.map((opinion) => (
                  <article key={opinion.id} className="opinion-list-item">
                    <div className="opinion-list-header">
                      <h3 className="opinion-title">{opinion.title}</h3>
                      <span className="opinion-rating">★ {opinion.rating}/5</span>
                    </div>
                    <div className="opinion-list-meta">
                      <span>{opinion.car_brand_name} {opinion.car_name}</span>
                      <span>{formatDate(opinion.created_at)}</span>
                    </div>
                    <p className="opinion-content">{opinion.content}</p>
                    <div className="opinion-list-footer">
                      <span className="opinion-votes">👍 {opinion.helpful_count} | 👎 {opinion.unhelpful_count}</span>
                      <Link to="/opinions" className="opinion-view-car">{t.pages.editLabel}</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
