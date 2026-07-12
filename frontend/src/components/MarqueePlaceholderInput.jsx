import { useEffect, useRef, useState } from 'react'

export default function MarqueePlaceholderInput({
  value = '',
  onChange,
  placeholder = '',
  className = 'form-input',
  wrapperClassName = '',
  style,
  id,
  type = 'text',
  ...props
}) {
  const hintRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [overflows, setOverflows] = useState(false)

  const showHint = !String(value || '').length && !isFocused

  useEffect(() => {
    if (!showHint || !hintRef.current) {
      setOverflows(false)
      return undefined
    }

    const measure = () => {
      const hint = hintRef.current
      if (!hint) return
      const text = hint.querySelector('.marquee-placeholder-input-text')
      if (!text) return
      setOverflows(text.scrollWidth > hint.clientWidth)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [placeholder, showHint])

  return (
    <div
      className={['marquee-placeholder-input', wrapperClassName].filter(Boolean).join(' ')}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input
        {...props}
        id={id}
        type={type}
        className={className}
        value={value}
        onChange={onChange}
        onFocus={(event) => {
          setIsFocused(true)
          props.onFocus?.(event)
        }}
        onBlur={(event) => {
          setIsFocused(false)
          props.onBlur?.(event)
        }}
        placeholder={showHint ? '' : placeholder}
        aria-label={props['aria-label'] || placeholder || undefined}
      />
      {showHint ? (
        <span
          ref={hintRef}
          className={[
            'marquee-placeholder-input-hint',
            isHovered && overflows ? 'is-scrolling' : '',
          ].filter(Boolean).join(' ')}
          aria-hidden="true"
        >
          <span className="marquee-placeholder-input-text">{placeholder}</span>
        </span>
      ) : null}
    </div>
  )
}
