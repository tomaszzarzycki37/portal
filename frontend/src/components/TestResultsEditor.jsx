import { getTestLabel } from '../utils/reviewTestResults'

export default function TestResultsEditor({
  rows,
  onChange,
  lang,
  hint,
  valuePlaceholder,
}) {
  return (
    <div className="review-test-results-editor">
      {hint ? <p className="review-test-results-note">{hint}</p> : null}
      <div className="review-test-results-editor-grid">
        {rows.map((item, index) => (
          <div key={`${item.key}-${index}`} className="review-test-results-editor-row">
            <label className="review-test-results-editor-key">{getTestLabel(item.key, lang)}</label>
            <input
              className="form-input review-test-results-editor-value"
              value={item.value}
              onChange={(event) => {
                const next = [...rows]
                next[index] = { ...next[index], value: event.target.value }
                onChange(next)
              }}
              placeholder={valuePlaceholder}
            />
            <span className="review-test-results-editor-unit">{item.unit || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
