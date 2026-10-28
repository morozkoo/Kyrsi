const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, { method = 'GET', token, body, signal } = {}) {
  const headers = new Headers()
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (response.status === 204) return null

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(result?.error || `Ошибка запроса: ${response.status}`)
    error.status = response.status
    throw error
  }

  return result
}

export const fetchCurrencies = ({ signal } = {}) => request('/currencies', { signal })
export const register = (credentials) => request('/auth/register', { method: 'POST', body: credentials })
export const login = (credentials) => request('/auth/login', { method: 'POST', body: credentials })
export const fetchProfile = (token, { signal } = {}) => request('/profile', { token, signal })
export const addCurrency = (currency, token) => request('/currencies', { method: 'POST', token, body: {
  id: currency.code,
  name: currency.name,
  symbol: currency.symbol,
  rateToRub: currency.rateToRub,
} })
export const updateCurrency = (id, currency, token) => request(`/currencies/${encodeURIComponent(id)}`, { method: 'PUT', token, body: {
  name: currency.name,
  symbol: currency.symbol,
  rateToRub: currency.rateToRub,
} })
export const deleteCurrency = (id, token) => request(`/currencies/${encodeURIComponent(id)}`, { method: 'DELETE', token })
export const refreshCurrencyRates = (token) => request('/currencies/refresh', { method: 'POST', token })