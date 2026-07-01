import axios from 'axios'

/**
 * Axios instance that automatically injects the stored JWT token.
 * All components should import this instead of raw axios for authenticated calls.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
})

api.interceptors.request.use(config => {
  try {
    const stored = localStorage.getItem('auth')
    if (stored) {
      const { token } = JSON.parse(stored)
      if (token) config.headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // ignore parse errors
  }
  return config
})

export default api
