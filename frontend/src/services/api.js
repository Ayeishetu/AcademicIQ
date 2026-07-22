import axios from 'axios'

// In production (Vercel), set VITE_API_URL to your Render backend URL,
// e.g. https://academiciq-api.onrender.com
// In local dev, the Vite proxy rewrites /api → localhost:8000, so baseURL stays '/api'.
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
}

// ── Documents ─────────────────────────────────────────────────────────────────

export const documentsApi = {
  upload: (file, course, courseCode) => {
    const form = new FormData()
    form.append('file', file)
    form.append('course', course)
    form.append('course_code', courseCode)
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: (courseCode) => {
    const params = {}
    const trimmed = courseCode?.trim()
    if (trimmed) params.course_code = trimmed
    return api.get('/documents/', { params })
  },
  courses: () => api.get('/documents/courses'),
  delete: (id) => api.delete(`/documents/${id}`),
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export const chatApi = {
  query: (question, course, conversationHistory, sessionId) =>
    api.post('/chat/query', {
      question,
      course_code: course || null,
      conversation_history: conversationHistory || null,
      session_id: sessionId || null,
    }),
  sessions: () => api.get('/chat/sessions'),
  getSession: (id) => api.get(`/chat/sessions/${id}`),
  deleteSession: (id) => api.delete(`/chat/sessions/${id}`),
}

// ── Share ─────────────────────────────────────────────────────────────────────

export const shareApi = {
  create: (title, messages) => api.post('/share/', { title, messages }),
  get: (token) => api.get(`/share/${token}`),
}

export default api
