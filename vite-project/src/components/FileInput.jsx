import { useId, useRef } from "react"

export default function FileInput({ id, label, accept = "image/*", required, onChange, hint, fileName }) {
  const autoId = useId()
  const inputId = id || autoId
  const ref = useRef(null)
  const displayName = fileName || "No file chosen"
  return (
    <div className="form-group file-input-field">
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <div className="file-input">
        <input ref={ref} id={inputId} className="file-input__native" type="file" accept={accept} required={required} onChange={(e) => onChange?.(e.target.files?.[0] || null)} />
        <button type="button" className="btn btn--outline btn--sm file-input__btn" onClick={() => ref.current?.click()}>Choose file</button>
        <span className="file-input__name" title={displayName}>{displayName}</span>
      </div>
      {hint ? <p className="form-hint form-hint--field">{hint}</p> : null}
    </div>
  )
}
