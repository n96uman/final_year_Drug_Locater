import { TERMS_SECTIONS, TERMS_TITLE } from "../content/termsText"

export default function TermsAgreement({ checked, onChange, id = "accept-terms" }) {
  return (
    <div className="terms-block">
      <div className="terms-block__scroll" tabIndex={0} role="document" aria-label={TERMS_TITLE}>
        <h3 className="terms-block__title">{TERMS_TITLE}</h3>
        {TERMS_SECTIONS.map((s) => (
          <section key={s.heading}>
            <h4>{s.heading}</h4>
            <p>{s.body}</p>
          </section>
        ))}
      </div>
      <label className="terms-block__check" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required />
        <span>I have read and agree to the terms and conditions</span>
      </label>
    </div>
  )
}
