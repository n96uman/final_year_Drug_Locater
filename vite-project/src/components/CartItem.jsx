export default function CartItem({ item, onUpdateQuantity, onRemove }) {
  const id = item._id || item.id
  return (
    <tr>
      <td data-label="Medicine name">{item.name}</td>
      <td data-label="Pharmacy name">{item.pharmacyName}</td>
      <td data-label="Price">{item.price} ETB</td>
      <td data-label="Quantity">
        <input className="cart-qty-input" type="number" min="1" value={item.quantity} onChange={(e) => onUpdateQuantity(id, e.target.value)} />
      </td>
      <td data-label="Action">
        <button type="button" className="btn btn--danger btn--sm" onClick={() => onRemove(id)}>Remove</button>
      </td>
    </tr>
  )
}
