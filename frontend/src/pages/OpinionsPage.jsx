import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import api from '../services/api'

export default function OpinionsPage() {
  const { t } = useTranslation()
  const [opinions, setOpinions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOpinions = async () => {
      try {
        setLoading(true)
        const response = await api.get('/opinions/?ordering=-created_at')
        setOpinions(response.data.results || response.data)
      } catch (error) {
        console.error('Error fetching opinions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOpinions()
  }, [])

  return (
    <div>
      <h1 className="page-title">{t.nav.opinions}</h1>

      {loading ? (
        <div className="page-loading">{t.pages.loading}</div>
      ) : (
        <div className="opinions-grid">
          {opinions.map((opinion) => (
            <article key={opinion.id} className="opinion-card-item">
              <h3 className="opinion-title">{opinion.title}</h3>
              <p className="opinion-meta">
                {opinion.car_name} • {opinion.author?.username || 'user'}
              </p>
              <div className="opinion-rating-row">
                <span className="rating">★ {opinion.rating}</span>
                <span className="opinion-counts">
                  👍 {opinion.helpful_count} | 👎 {opinion.unhelpful_count}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
