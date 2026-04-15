export default function SearchBar({ value, onChange, id = 'medicine-search', placeholder = 'Search by medicine name...' }) {
  return (
    <>
      <label htmlFor={id}>Medicine name</label>
      <input type="search" id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
    </>
  )
}
