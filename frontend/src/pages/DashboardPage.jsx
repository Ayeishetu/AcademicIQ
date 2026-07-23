import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../store/authStore'
import {
  Upload,
  FileText,
  Trash2,
  BookOpen,
  Loader2,
  RefreshCw,
  ChevronDown,
  Users,
  User,
  Download,
  Eye,
} from 'lucide-react'
import { documentsApi } from '../services/api'
import UploadModal from '../components/UploadModal'
import CourseFilter from '../components/CourseFilter'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function FileTypeIcon({ type }) {
  const colors = {
    pdf: 'text-red-500 bg-red-50',
    docx: 'text-blue-500 bg-blue-50',
    txt: 'text-gray-500 bg-gray-100',
  }
  return (
    <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[type] || colors.txt}`}>
      <FileText className="w-4 h-4" />
    </div>
  )
}

// ── My Documents tab ──────────────────────────────────────────────────────────

function MyDocumentsTab({ user }) {
  const [documents, setDocuments] = useState([])
  const [courses, setCourses] = useState([])
  const [selectedCourseCode, setSelectedCourseCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [docsRes, coursesRes] = await Promise.all([
        documentsApi.list(selectedCourseCode),
        documentsApi.courses(),
      ])
      setDocuments(docsRes.data)
      setCourses(coursesRes.data)
    } catch (err) {
      console.error('Failed to load documents', err)
    } finally {
      setLoading(false)
    }
  }, [selectedCourseCode])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.original_filename}"? This cannot be undone.`)) return
    setDeletingId(doc.id)
    try {
      await documentsApi.delete(doc.id)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      const { data } = await documentsApi.courses()
      setCourses(data)
      if (selectedCourseCode && !data.includes(selectedCourseCode)) setSelectedCourseCode(null)
    } catch {
      alert('Failed to delete document. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleUploadSuccess = (newDoc) => {
    setDocuments((prev) => [newDoc, ...prev])
    fetchData()
  }

  const grouped = documents.reduce((acc, doc) => {
    const key = doc.course_code || doc.course
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {})

  return (
    <>
      {/* Sub-header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {documents.length} {documents.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={fetchData}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>
          </div>
        </div>
        {courses.length > 0 && (
          <CourseFilter
            courses={courses}
            selected={selectedCourseCode}
            onChange={setSelectedCourseCode}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7 md:w-8 md:h-8 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">No documents yet</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-xs">
              Upload your lecture notes, past exams, or study guides to start asking questions.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload your first document
            </button>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6">
            {Object.entries(grouped).map(([course, docs]) => (
              <CourseGroup
                key={course}
                course={course}
                docs={docs}
                onDelete={handleDelete}
                deletingId={deletingId}
                user={user}
              />
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </>
  )
}

// ── Browse tab ────────────────────────────────────────────────────────────────

function BrowseTab() {
  const [documents, setDocuments] = useState([])
  const [courses, setCourses] = useState([])
  const [selectedCourseCode, setSelectedCourseCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [docsRes, coursesRes] = await Promise.all([
        documentsApi.browse(selectedCourseCode),
        documentsApi.browseCourses(),
      ])
      setDocuments(docsRes.data)
      setCourses(coursesRes.data)
    } catch (err) {
      console.error('Failed to load shared documents', err)
      setError('Could not load shared documents. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [selectedCourseCode])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh when a new document is uploaded from My Documents tab
  useEffect(() => {
    const handler = () => fetchData()
    window.addEventListener('document-uploaded', handler)
    return () => window.removeEventListener('document-uploaded', handler)
  }, [fetchData])

  const grouped = documents.reduce((acc, doc) => {
    const key = doc.course_code || doc.course
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {})

  return (
    <>
      {/* Sub-header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {documents.length} {documents.length === 1 ? 'file' : 'files'}
            </span>
            <span className="text-xs text-gray-400">shared by all users</span>
          </div>
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {courses.length > 0 && (
          <CourseFilter
            courses={courses}
            selected={selectedCourseCode}
            onChange={setSelectedCourseCode}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
            <button onClick={fetchData} className="mt-3 text-sm text-primary-600 hover:underline">
              Try again
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-7 h-7 md:w-8 md:h-8 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">No shared documents yet</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Documents uploaded by any user will appear here once processed.
            </p>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6">
            {Object.entries(grouped).map(([course, docs]) => (
              <BrowseCourseGroup key={course} course={course} docs={docs} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('mine')

  const tabs = [
    { id: 'mine', label: 'My Documents', icon: User },
    { id: 'browse', label: 'Browse All', icon: Users },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Top header with tabs */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 pt-3 md:pt-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-primary-600" />
          <h1 className="font-semibold text-gray-900 text-sm md:text-base">Documents</h1>
        </div>
        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary-600 text-primary-700 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'mine' ? (
        <MyDocumentsTab user={user} />
      ) : (
        <BrowseTab />
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function CourseGroup({ course, docs, onDelete, deletingId, user }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 md:px-5 py-3 md:py-3.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <span className="font-medium text-gray-900 text-sm truncate">{course}</span>
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full flex-shrink-0">
            {docs.length}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 md:px-5 py-3 md:py-3.5 hover:bg-gray-50">
              <FileTypeIcon type={doc.file_type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.original_filename}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                  {doc.chunk_count > 0 ? (
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      {doc.chunk_count} chunks
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Processing…
                    </span>
                  )}
                </div>
              </div>
              {user?.id === doc.user_id && (
                <button
                  onClick={() => onDelete(doc)}
                  disabled={deletingId === doc.id}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 flex-shrink-0"
                  title="Delete document"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BrowseCourseGroup({ course, docs }) {
  const [collapsed, setCollapsed] = useState(false)
  const [actionId, setActionId] = useState(null) // tracks which doc is mid-action

  const MIME_TYPES = {
    pdf:  'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc:  'application/msword',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt:  'application/vnd.ms-powerpoint',
    txt:  'text/plain',
  }

  // File types the browser can render natively
  const BROWSER_VIEWABLE = ['pdf', 'txt']

  const handleOpen = async (doc) => {
    setActionId(doc.id)
    try {
      const { data } = await documentsApi.downloadBlob(doc.id)
      const mime = MIME_TYPES[doc.file_type?.toLowerCase()] || 'application/octet-stream'
      const blob = new Blob([data], { type: mime })
      const url = URL.createObjectURL(blob)

      if (BROWSER_VIEWABLE.includes(doc.file_type?.toLowerCase())) {
        // PDF and TXT open natively in the browser
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      } else {
        // Office files: trigger download and let the OS open them
        const a = document.createElement('a')
        a.href = url
        a.download = doc.original_filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } catch (err) {
      const status = err?.response?.status
      if (status === 404) {
        alert('This file is no longer available on the server. The uploader may need to re-upload it.')
      } else {
        alert('Could not open file. Please try again.')
      }
    } finally {
      setActionId(null)
    }
  }

  const handleDownload = async (doc) => {
    setActionId(doc.id)
    try {
      const { data } = await documentsApi.downloadBlob(doc.id)
      const url = URL.createObjectURL(new Blob([data], { type: data.type }))
      const a = document.createElement('a')
      a.href = url
      a.download = doc.original_filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (err) {
      const status = err?.response?.status
      if (status === 404) {
        alert('This file is no longer available on the server. The uploader may need to re-upload it.')
      } else {
        alert('Could not download file. Please try again.')
      }
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 md:px-5 py-3 md:py-3.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <span className="font-medium text-gray-900 text-sm truncate">{course}</span>
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full flex-shrink-0">
            {docs.length}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100">
          {docs.map((doc) => {
            const busy = actionId === doc.id
            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 md:px-5 py-3 md:py-3.5 hover:bg-gray-50">
                <FileTypeIcon type={doc.file_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.original_filename}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                    {doc.uploaded_by && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        {doc.uploaded_by}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                  ) : (
                    <>
                      <button
                        onClick={() => handleOpen(doc)}
                        title="Open file"
                        className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        title="Download file"
                        className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
