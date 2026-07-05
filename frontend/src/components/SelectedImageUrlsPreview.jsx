import { normalizeMediaUrl } from '../utils/mediaUrl'

export default function SelectedImageUrlsPreview({
  urls = [],
  countLabel = '',
  onRemoveUrl,
  removeLabel = 'Remove image',
}) {
  if (!urls.length) {
    return null
  }

  return (
    <div className="review-selected-files-preview">
      {countLabel ? <p className="review-slider-limit-note">{countLabel}</p> : null}
      <div className="review-selected-files-grid">
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className="review-selected-files-item">
            <img src={normalizeMediaUrl(url)} alt={`Image ${index + 1}`} />
            {onRemoveUrl ? (
              <button
                type="button"
                className="review-image-remove-btn-thumb"
                onClick={() => onRemoveUrl(index)}
                title={removeLabel}
                aria-label={removeLabel}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
