const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/+$/, '')

async function parseResponse(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { message: text }
  }
}

async function requestWithBase(baseUrl, path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const data = await parseResponse(response)
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
  return data
}

async function runRequest(path, init) { return requestWithBase(API_BASE_URL, path, init) }

async function apiFetch(path, { method = 'GET', body, token } = {}) {
  return runRequest(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function apiFetchMultipart(path, { method = 'POST', formData, token } = {}) {
  return runRequest(path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
}

export const authApi = {
  register: (formData) => apiFetchMultipart('/auth/register', { method: 'POST', formData }),
  login: (payload) => apiFetch('/auth/login', { method: 'POST', body: payload }),
  me: (token) => apiFetch('/auth/me', { token }),
  updateProfile: (formData, token) => apiFetchMultipart('/auth/profile', { method: 'PUT', formData, token }),
  updatePharmacyLicense: (formData, token) => apiFetchMultipart('/auth/pharmacy-license', { method: 'PUT', formData, token }),
  abandonPendingPharmacy: (token) => apiFetch('/auth/pending-pharmacy-account', { method: 'DELETE', token }),
}

export const medicineApi = {
  list: () => apiFetch('/medicines'),
  listMine: (token) => apiFetch('/medicines/mine', { token }),
  create: (payload, token) => apiFetch('/medicines', { method: 'POST', body: payload, token }),
  update: (id, payload, token) => apiFetch(`/medicines/${id}`, { method: 'PUT', body: payload, token }),
  remove: (id, token) => apiFetch(`/medicines/${id}`, { method: 'DELETE', token }),
}

export const orderApi = {
    listPharmacyTransactions: (token, period = '') => apiFetch(`/orders/pharmacy/transactions${period ? `?period=${period}` : ''}`, { token }),
  checkout: (payload, token) => {
    if (payload?.receiptFile || payload?.prescriptionFile) {
      const formData = new FormData()
      formData.append('items', JSON.stringify(payload.items || []))
      formData.append('subtotal', String(payload.subtotal || 0))
      formData.append('delivery', String(payload.delivery || 0))
      formData.append('total', String(payload.total || 0))
      formData.append('paymentMethod', payload.paymentMethod || 'none')
      formData.append('wantsDelivery', payload.wantsDelivery ? 'true' : 'false')
      formData.append('chapaAccount', payload.chapaAccount || '')
      formData.append('chapaDemoPassword', payload.chapaDemoPassword || '')
      if (payload.receiptFile) formData.append('receiptImage', payload.receiptFile)
      if (payload.prescriptionFile) formData.append('prescriptionImage', payload.prescriptionFile)
      return apiFetchMultipart('/orders', { method: 'POST', formData, token })
    }
    return apiFetch('/orders', { method: 'POST', body: payload, token })
  },
  verifyChapaPayment: (payload, token) => apiFetch('/orders/payment/chapa/verify', { method: 'POST', body: payload, token }),
  listMine: (token) => apiFetch('/orders/mine', { token }),
  listPharmacy: (token) => apiFetch('/orders/pharmacy', { token }),
  cancelMine: (id, token) => apiFetch(`/orders/${id}`, { method: 'DELETE', token }),
  updateDeliveryLocation: (id, payload, token) => apiFetch(`/orders/${id}/delivery-location`, { method: 'PUT', body: payload, token }),
  approveForPharmacy: (id, token) => apiFetch(`/orders/${id}/approve`, { method: 'PUT', token }),
  rejectForPharmacy: async (id, token, payload = {}) => {
    try {
      return await apiFetch(`/orders/${id}/reject`, { method: 'PUT', token, body: payload })
    } catch (e) {
      return apiFetch(`/orders/${id}/decline`, { method: 'PUT', token, body: payload })
    }
  },
  listTransactions: (token, period = '') => apiFetch(`/orders/transactions${period ? `?period=${period}` : ''}`, { token }),
}

export const adminApi = {
  stats: (token) => apiFetch('/admin/stats', { token }),
  listPharmacies: (status, token) => apiFetch(`/admin/pharmacies?status=${encodeURIComponent(status)}`, { token }),
  listPendingPharmacies: (token) => apiFetch('/admin/pharmacies/pending', { token }),
  approvePharmacy: (id, token) => apiFetch(`/admin/pharmacies/${id}/approve`, { method: 'PUT', token }),
  rejectPharmacy: (id, token) => apiFetch(`/admin/pharmacies/${id}/reject`, { method: 'PUT', token }),
  listPharmaciesWithAccounts: (token) => apiFetch('/admin/pharmacies-with-accounts', { token }),
  listAllTransactions: (token) => apiFetch('/admin/transactions', { token }),
  listExpiredAlerts: (token) => apiFetch('/admin/expired-alerts', { token }),
  dismissExpiredAlert: (id, token) => apiFetch(`/admin/expired-alerts/${id}/dismiss`, { method: 'PUT', token }),
  listExpiredMedicines: (token) => apiFetch('/admin/expired-medicines', { token }),
}

/** Fetches licence bytes with admin JWT; caller must revoke the object URL when done. */
export async function fetchAdminLicenseObjectUrl(userId, token) {
  const response = await fetch(`${API_BASE_URL}/admin/pharmacies/${userId}/license-image`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const text = await response.text()
    let message = text
    try {
      const j = JSON.parse(text)
      if (j && j.message) message = j.message
    } catch {
      /* use text */
    }
    throw new Error(message || `Request failed (${response.status})`)
  }
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  return { objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) }
}
