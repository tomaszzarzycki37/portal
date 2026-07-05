import { useEffect, useState } from 'react'

export default function SelectedImageFilesPreview({
  files = [],
  countLabel = '',
  onRemoveFile,
  removeLabel = 'Remove image',
}) {
  const [previewUrls, setPreviewUrls] = useState([])

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviewUrls(urls)

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [files])

  if (!files.length) {
    return null
  }

  return (
    <div className="review-selected-files-preview">
      {countLabel ? <p className="review-slider-limit-note">{countLabel}</p> : null}
      <div className="review-selected-files-grid">
        {files.map((file, index) => (
          <div key={`${file.name}-${file.lastModified}-${index}`} className="review-selected-files-item">
            <img src={previewUrls[index]} alt={file.name || `Image ${index + 1}`} />
            {onRemoveFile ? (
              <button
                type="button"
                className="review-image-remove-btn-thumb"
                onClick={() => onRemoveFile(index)}
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
