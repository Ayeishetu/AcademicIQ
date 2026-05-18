import { useState, useEffect, useCallback } from 'react'
import {
  Upload,
  FileText,
  Trash2,
  BookOpen,
  Loader2,
  RefreshCw,
  ChevronDown,
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
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[type] || colors.txt}`}>
      <FileText className="w-4 h-4" />
    </div>
  )
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState([])
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [docsRes, coursesRes] = await Promise.all([
        documentsApi.list(selectedCourse),
        documentsApi.courses(),
      ])
      setDocuments(docsRes.data)
      setCourses(coursesRes.data)
    } catch (err) {
      console.error('Failed to load documents', err)
    } finally {
      setLoading(false)
    }
  }, [selectedCourse])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.original_filename}"? This cannot be undone.`)) return
    setDeletingId(doc.id)
    try {
      await documentsApi.delete(doc.id)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      // Refresh courses in case this was the last doc for a course
      const { data } = await documentsApi.courses()
      setCourses(data)
      if (selectedCourse && !data.includes(selectedCourse)) {
        setSelectedCourse(null)
      }
    } catch (err) {
      alert('Failed to delete document. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleUploadSuccess = (newDoc) => {
    setDocuments((prev) => [newDoc, ...prev])
    fetchData() // refresh to get updated courses
  }

  // Group documents by course
  const grouped = documents.reduce((acc, doc) => {
    if (!acc[doc.course]) acc[doc.course] = []
    acc[doc.course].push(doc)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-600" />
            <h1 className="font-semibold text-gray-900">My Documents</h1>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {documents.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>
        </div>

        {courses.length > 0 && (
          <CourseFilter
            courses={courses}
            selected={selectedCourse}
            onChange={setSelectedCourse}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
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
          <div className="space-y-6">
            {Object.entries(grouped).map(([course, docs]) => (
              <CourseGroup
                key={course}
                course={course}
                docs={docs}
                onDelete={handleDelete}
                deletingId={deletingId}
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
    </div>
  )
}

function CourseGroup({ course, docs, onDelete, deletingId }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary-600" />
          <span className="font-medium text-gray-900 text-sm">{course}</span>
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
            {docs.length} file{docs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50">
              <FileTypeIcon type={doc.file_type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.original_filename}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                  {doc.chunk_count > 0 ? (
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      {doc.chunk_count} chunks indexed
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Processing…
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDelete(doc)}
                disabled={deletingId === doc.id}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                title="Delete document"
              >
                {deletingId === doc.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
