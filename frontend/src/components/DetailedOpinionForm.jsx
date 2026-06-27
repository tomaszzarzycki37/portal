import { useMemo } from 'react'
import StarRating from './StarRating'
import {
  OPINION_RATING_SECTIONS,
  buildEmptyDetailedRatings,
  computeFuelAverage,
} from '../constants/opinionRatings'

function RichTextEditorField({ id, label, value, onChange, placeholder, RichTextEditorComponent }) {
  if (!RichTextEditorComponent) {
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={id}>{label}</label>
        <textarea
          id={id}
          className="form-input"
          rows={5}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    )
  }
  return (
    <RichTextEditorComponent
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  )
}

export default function DetailedOpinionForm({
  draft,
  onChange,
  t,
  RichTextEditorComponent,
  showCarSelect = false,
  cars = [],
}) {
  const detailedRatings = draft.detailed_ratings || buildEmptyDetailedRatings()
  const fuelAvg = useMemo(
    () => computeFuelAverage(draft.fuel_consumption_min, draft.fuel_consumption_max),
    [draft.fuel_consumption_min, draft.fuel_consumption_max],
  )

  const setRating = (section, key, value) => {
    onChange({
      ...draft,
      detailed_ratings: {
        ...detailedRatings,
        [section]: {
          ...detailedRatings[section],
          [key]: value,
        },
      },
    })
  }

  return (
    <div className="detailed-opinion-form">
      {showCarSelect && (
        <div className="form-group">
          <label className="form-label" htmlFor="opinion-car-model">{t.pages.opinionSelectModel}</label>
          <select
            id="opinion-car-model"
            className="form-input"
            value={draft.car_model || ''}
            onChange={(e) => onChange({ ...draft, car_model: e.target.value })}
          >
            <option value="">{t.pages.opinionSelectModelPlaceholder}</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {[car.brand_name, car.name, car.year_introduced].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="opinion-title">{t.pages.opinionTitle}</label>
        <input
          id="opinion-title"
          className="form-input"
          value={draft.title || ''}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </div>

      <section className="detailed-opinion-form-section">
        <h5 className="detailed-opinion-section-title">{t.pages.opinionSectionGeneral}</h5>
        <RichTextEditorField
          id="opinion-general-content"
          label={t.pages.opinionGeneralAssessmentLabel}
          value={draft.content}
          onChange={(nextValue) => onChange({ ...draft, content: nextValue })}
          placeholder={t.pages.opinionGeneralAssessmentPlaceholder}
          RichTextEditorComponent={RichTextEditorComponent}
        />
      </section>

      {Object.entries(OPINION_RATING_SECTIONS).map(([sectionKey, keys]) => (
        <section key={sectionKey} className="detailed-opinion-form-section">
          <h5 className="detailed-opinion-section-title">
            {t.pages.opinionRatingSections?.[sectionKey] || sectionKey}
          </h5>
          <div className="detailed-opinion-rating-grid">
            {keys.map((key) => (
              <div key={key} className="detailed-opinion-rating-row">
                <span className="detailed-opinion-rating-label">
                  {t.pages.opinionRatingCategories?.[key] || key}
                </span>
                <StarRating
                  value={detailedRatings[sectionKey]?.[key] ?? 5}
                  onChange={(value) => setRating(sectionKey, key, value)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="detailed-opinion-form-section">
        <h5 className="detailed-opinion-section-title">{t.pages.opinionSectionFuel}</h5>
        <p className="admin-meta">{t.pages.opinionFuelSectionHint}</p>
        <div className="detailed-opinion-fuel-inputs">
          <div className="form-group">
            <label className="form-label" htmlFor="opinion-fuel-min">{t.pages.opinionFuelMinLabel}</label>
            <input
              id="opinion-fuel-min"
              type="number"
              min="0"
              step="0.1"
              className="form-input"
              value={draft.fuel_consumption_min ?? ''}
              onChange={(e) => onChange({ ...draft, fuel_consumption_min: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="opinion-fuel-max">{t.pages.opinionFuelMaxLabel}</label>
            <input
              id="opinion-fuel-max"
              type="number"
              min="0"
              step="0.1"
              className="form-input"
              value={draft.fuel_consumption_max ?? ''}
              onChange={(e) => onChange({ ...draft, fuel_consumption_max: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t.pages.opinionFuelAvgLabel}</label>
            <div className="detailed-opinion-fuel-avg-preview">{fuelAvg ?? '—'}</div>
          </div>
        </div>
      </section>
    </div>
  )
}
