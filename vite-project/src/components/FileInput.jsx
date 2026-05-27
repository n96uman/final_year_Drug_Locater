import { useId, useRef } from "react"

const DEFAULT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024

export default function FileInput({
  id,
  label,
  accept = "image/*",
  required,
  onChange,
  hint,
  fileName,
  maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
}) {
  const autoId = useId()
  const inputId = id || autoId
  const ref = useRef(null)
  const displayName = fileName || "No file chosen"
  const maxMb = Math.round((maxFileSizeBytes / (1024 * 1024)) * 10) / 10

  const handleChange = (event) => {
    const selected = event.target.files?.[0] || null
    if (selected && selected.size > maxFileSizeBytes) {
      window.alert(`Image cannot be uploaded because it exceeds the ${maxMb}MB size limit.`)
      event.target.value = ""
      onChange?.(null)
      return
    }
    onChange?.(selected)
  }

  return (
    <div className="form-group file-input-field">
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <div className="file-input">
        <input ref={ref} id={inputId} className="file-input__native" type="file" accept={accept} required={required} onChange={handleChange} />
        <button type="button" className="btn btn--outline btn--sm file-input__btn" onClick={() => ref.current?.click()}>Choose file</button>
        <span className="file-input__name" title={displayName}>{displayName}</span>
      </div>
      {hint ? <p className="form-hint form-hint--field">{hint}</p> : null}
    </div>
  )
}
