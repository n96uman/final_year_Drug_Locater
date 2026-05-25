import React from 'react'
export default function TransactionList({ transactions }) {
  if (!transactions || !transactions.length) return <p className="form-hint">No transactions found.</p>
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Order</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((t) => (
          <tr key={t._id}>
            <td>{new Date(t.createdAt).toLocaleString()}</td>
            <td>{t.amount} ETB</td>
            <td>{t.status}</td>
            <td>{t.order?._id ? String(t.order._id).slice(-6) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}