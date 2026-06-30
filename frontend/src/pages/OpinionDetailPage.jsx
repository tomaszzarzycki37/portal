import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../services/api'
import { useTranslation } from '../i18n'
import DetailedOpinionCard from '../components/DetailedOpinionCard'
import { slugifyModelName } from '../utils/modelSlug'

export default function OpinionDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const [opinion, setOpinion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await api.get(`/opinions/${id}/`)
        setOpinion(response.data)
      } catch (loadError) {
        console.error(loadError)
        setError(t.pages.opinionNotFound)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, t.pages.opinionNotFound])

  if (loading) {
    return <div className="page-loading">{t.pages.loading}</div>
  }

  if (error || !opinion) {
    return (
      <div className="page-card">
        <p>{error || t.pages.opinionNotFound}</p>
        <Link to="/opinions" className="btn btn-secondary">{t.pages.backToOpinions}</Link>
      </div>
    )
  }

  const brandSlug = opinion.car_brand_slug || ''
  const modelSlug = slugifyModelName(opinion.car_name)
  const backHref = brandSlug && modelSlug
    ? `/cars/brands/${brandSlug}/${modelSlug}`
    : '/opinions'

  return (
    <div className="opinion-detail-page">
      <nav className="model-family-breadcrumbs">
        <Link to="/opinions">{t.nav.opinions}</Link>
        <span aria-hidden="true"> / </span>
        <span>{opinion.title}</span>
      </nav>

      <section className="page-card">
        <div className="opinion-detail-head">
          <div>
            <h1 className="page-title">{opinion.title}</h1>
            <p className="admin-subtitle">
              {[opinion.car_brand_name, opinion.car_name, opinion.car_year].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Link to={backHref} className="btn btn-secondary">
            {t.pages.modelFamilyBackToModel}
          </Link>
        </div>

        <DetailedOpinionCard opinion={opinion} t={t} />
      </section>
    </div>
  )
}
