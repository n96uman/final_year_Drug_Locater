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
}

export const medicineApi = {
  list: () => apiFetch('/medicines'),
  listMine: (token) => apiFetch('/medicines/mine', { token }),
  create: (payload, token) => apiFetch('/medicines', { method: 'POST', body: payload, token }),
  update: (id, payload, token) => apiFetch(`/medicines/${id}`, { method: 'PUT', body: payload, token }),
  remove: (id, token) => apiFetch(`/medicines/${id}`, { method: 'DELETE', token }),
}

export const orderApi = {
  checkout: (payload, token) => apiFetch('/orders', { method: 'POST', body: payload, token }),
  listMine: (token) => apiFetch('/orders/mine', { token }),
  listPharmacy: (token) => apiFetch('/orders/pharmacy', { token }),
  approveForPharmacy: (id, token) => apiFetch(`/orders/${id}/approve`, { method: 'PUT', token }),
  rejectForPharmacy: async (id, token) => {
    try {
      return await apiFetch(`/orders/${id}/reject`, { method: 'PUT', token })
    } catch (e) {
      return apiFetch(`/orders/${id}/decline`, { method: 'PUT', token })
    }
  },
}

export const adminApi = {
  listPendingPharmacies: (token) => apiFetch('/admin/pharmacies/pending', { token }),
  approvePharmacy: (id, token) => apiFetch(`/admin/pharmacies/${id}/approve`, { method: 'PUT', token }),
  rejectPharmacy: (id, token) => apiFetch(`/admin/pharmacies/${id}/reject`, { method: 'PUT', token }),
}
