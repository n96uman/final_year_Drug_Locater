import { useEffect, useState } from 'react'
import { orderApi } from './api/client'
import { useAuth } from './context/AuthContext'
import TransactionList from './components/TransactionList'

export default function PharmacyTransactionHistoryPage({ period }) {
  const { token } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError('')
    orderApi.listPharmacyTransactions(token, period)
      .then((data) => setTransactions(data.transactions || []))
      .catch((e) => setError(e.message || 'Could not load transactions.'))
      .finally(() => setLoading(false))
  }, [token, period])

  return (
    <div className="page-inner page-inner--narrow">
      <header className="page-header"><h1>{period === 'week' ? 'This Week' : 'All'} Transactions</h1></header>
      {loading ? <p className="form-hint">Loading...</p> : null}
      {error ? <p className="form-hint" role="alert">{error}</p> : null}
      {!loading && !error ? <TransactionList transactions={transactions} /> : null}
    </div>
  )
}
