import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
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
  upload: (file, course) => {
    const form = new FormData()
    form.append('file', file)
    form.append('course', course)
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: (course) => api.get('/documents/', { params: course ? { course } : {} }),
  courses: () => api.get('/documents/courses'),
  delete: (id) => api.delete(`/documents/${id}`),
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export const chatApi = {
  query: (question, course, conversationHistory) =>
    api.post('/chat/query', {
      question,
      course: course || null,
      conversation_history: conversationHistory || null,
    }),
}

export default api
