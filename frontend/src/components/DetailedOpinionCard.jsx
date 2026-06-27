import StarRating from './StarRating'
import { OPINION_RATING_SECTIONS, computeFuelAverage, formatStarDisplay } from '../constants/opinionRatings'

function authorDisplayName(author, fallback) {
  const fullName = `${author?.first_name || ''} ${author?.last_name || ''}`.trim()
  return fullName || author?.username || fallback
}

export default function DetailedOpinionCard({
  opinion,
  t,
  showHeader = true,
}) {
  const modelLabel = [opinion.car_name, opinion.car_year].filter(Boolean).join(' ')
  const fuelAvg = computeFuelAverage(opinion.fuel_consumption_min, opinion.fuel_consumption_max)

  return (
    <div className="detailed-opinion-card">
      {showHeader && (
        <div className="detailed-opinion-card-header">
          <div>
            <p className="detailed-opinion-meta-line">
              <strong>{t.pages.opinionCardUserLabel}:</strong>{' '}
              {authorDisplayName(opinion.author, t.pages.unknownAuthor)}
            </p>
            <p className="detailed-opinion-meta-line">
              <strong>{t.pages.opinionCardModelLabel}:</strong> {modelLabel || '—'}
            </p>
          </div>
          <div className="detailed-opinion-overall-rating">
            <span className="detailed-opinion-overall-label">{t.pages.averageRating}</span>
            <span className="detailed-opinion-overall-stars">{formatStarDisplay(opinion.rating)}</span>
          </div>
        </div>
      )}

      <section className="detailed-opinion-section">
        <h5 className="detailed-opinion-section-title">{t.pages.opinionSectionGeneral}</h5>
        <div
          className="detailed-opinion-general-text opinion-content"
          dangerouslySetInnerHTML={{ __html: opinion.content }}
        />
      </section>

      {Object.entries(OPINION_RATING_SECTIONS).map(([sectionKey, keys]) => (
        <section key={sectionKey} className="detailed-opinion-section">
          <h5 className="detailed-opinion-section-title">
            {t.pages.opinionRatingSections?.[sectionKey] || sectionKey}
          </h5>
          <div className="detailed-opinion-rating-grid">
            {keys.map((key) => {
              const value = opinion.detailed_ratings?.[sectionKey]?.[key]
              return (
                <div key={key} className="detailed-opinion-rating-row">
                  <span className="detailed-opinion-rating-label">
                    {t.pages.opinionRatingCategories?.[key] || key}
                  </span>
                  <StarRating value={value} readOnly size="sm" />
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {(opinion.fuel_consumption_min != null || opinion.fuel_consumption_max != null) && (
        <section className="detailed-opinion-section">
          <h5 className="detailed-opinion-section-title">{t.pages.opinionSectionFuel}</h5>
          <div className="detailed-opinion-fuel-table">
            <div className="detailed-opinion-fuel-row">
              <span>{t.pages.opinionFuelMinLabel}</span>
              <strong>{opinion.fuel_consumption_min ?? '—'}</strong>
            </div>
            <div className="detailed-opinion-fuel-row">
              <span>{t.pages.opinionFuelMaxLabel}</span>
              <strong>{opinion.fuel_consumption_max ?? '—'}</strong>
            </div>
            <div className="detailed-opinion-fuel-row detailed-opinion-fuel-row-avg">
              <span>{t.pages.opinionFuelAvgLabel}</span>
              <strong>{fuelAvg ?? '—'}</strong>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
