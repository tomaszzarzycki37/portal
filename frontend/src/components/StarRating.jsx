import { RATING_MAX, RATING_MIN } from '../constants/opinionRatings'

export default function StarRating({
  value,
  onChange,
  max = RATING_MAX,
  readOnly = false,
  size = 'md',
  ariaLabel,
}) {
  const numeric = Number(value)
  const normalized = Number.isFinite(numeric)
    ? Math.min(max, Math.max(RATING_MIN, Math.round(numeric)))
    : RATING_MIN

  return (
    <div
      className={`star-rating star-rating-${size}${readOnly ? ' star-rating-readonly' : ''}`}
      role={readOnly ? 'img' : 'group'}
      aria-label={ariaLabel || `Rating ${normalized} of ${max}`}
    >
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1
        const isActive = starValue <= normalized
        if (readOnly) {
          return (
            <span
              key={starValue}
              className={`star-rating-star${isActive ? ' is-active' : ''}`}
              aria-hidden="true"
            >
              ★
            </span>
          )
        }
        return (
          <button
            key={starValue}
            type="button"
            className={`star-rating-star${isActive ? ' is-active' : ''}`}
            onClick={() => onChange?.(starValue)}
            aria-label={`${starValue} / ${max}`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
