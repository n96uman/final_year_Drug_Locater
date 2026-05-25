import { Link } from "react-router-dom"

export default function TermsAgreement({ checked, onChange, id = "accept-terms" }) {
  return (
    <div className="terms-block">
      <label className="terms-block__check" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required />
        <span>I have read and agree to the <Link to="/terms" target="_blank" rel="noreferrer">terms and conditions</Link></span>
      </label>
    </div>
  )
}
