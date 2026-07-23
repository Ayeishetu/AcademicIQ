import { useState, useRef } from 'react'
import { X, Upload, FileText, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'
import { documentsApi } from '../services/api'

const ALLOWED_TYPES = ['.pdf', '.docx', '.txt', '.ppt', '.pptx']
const MAX_SIZE_MB = 500

function validateFile(f) {
  const ext = '.' + f.name.split('.').pop().toLowerCase()
  if (!ALLOWED_TYPES.includes(ext))
    return `Unsupported type — use PDF, DOCX, TXT, PPT or PPTX`
  if (f.size > MAX_SIZE_MB * 1024 * 1024)
    return `Exceeds ${MAX_SIZE_MB} MB limit`
  return null
}

// Per-file status: idle | uploading | done | error
function fileState(file) {
  return { file, status: 'idle', error: null }
}

export default function UploadModal({ onClose, onSuccess }) {
  const [files, setFiles] = useState([])   // array of { file, status, error }
  const [course, setCourse] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const fileInputRef = useRef(null)

  const addFiles = (incoming) => {
    const next = [...incoming].reduce((acc, f) => {
      const err = validateFile(f)
      // skip duplicates already queued
      if (files.some((e) => e.file.name === f.name && e.file.size === f.size)) return acc
      acc.push({ file: f, status: err ? 'error' : 'idle', error: err })
      return acc
    }, [])
    setFiles((prev) => [...prev, ...next])
    setGlobalError('')
  }

  const removeFile = (idx) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx))

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const isUploading = files.some((f) => f.status === 'uploading')
  const hasValid = files.some((f) => f.status === 'idle')
  const canSubmit = hasValid && course.trim() && courseCode.trim() && !isUploading

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setGlobalError('')

    const pending = files.filter((f) => f.status === 'idle')

    // Upload all pending files sequentially to avoid hammering the server
    for (const entry of pending) {
      setFiles((prev) =>
        prev.map((f) => (f.file === entry.file ? { ...f, status: 'uploading' } : f))
      )
      try {
        const { data } = await documentsApi.upload(entry.file, course.trim(), courseCode.trim())
        setFiles((prev) =>
          prev.map((f) => (f.file === entry.file ? { ...f, status: 'done' } : f))
        )
        onSuccess(data)
        // Signal the Browse tab to refresh
        window.dispatchEvent(new CustomEvent('document-uploaded'))
      } catch (err) {
        const msg = err.response?.data?.detail || 'Upload failed'
        setFiles((prev) =>
          prev.map((f) => (f.file === entry.file ? { ...f, status: 'error', error: msg } : f))
        )
      }
    }

    // Close only if every file succeeded
    const allDone = files.every((f) =>
      f.status === 'done' || pending.find((p) => p.file === f.file)
    )
    // Re-read latest state via functional update
    setFiles((prev) => {
      const anyFailed = prev.some((f) => f.status === 'error')
      if (!anyFailed) setTimeout(onClose, 400)
      return prev
    })
  }

  const statusIcon = (entry) => {
    if (entry.status === 'uploading') return <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
    if (entry.status === 'done') return <CheckCircle2 className="w-4 h-4 text-green-500" />
    if (entry.status === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="card w-full sm:max-w-md p-5 sm:p-6 rounded-t-2xl sm:rounded-xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Upload Documents</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {globalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {globalError}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary-400 bg-primary-50'
                : files.length > 0
                ? 'border-gray-300 bg-gray-50 hover:border-primary-400'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.ppt,.pptx"
              multiple
              className="hidden"
              onChange={(e) => e.target.files.length && addFiles(e.target.files)}
            />
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-gray-400">
                PDF, DOCX, TXT, PPT, PPTX · Max {MAX_SIZE_MB} MB each · Multiple files OK
              </p>
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${
                    entry.status === 'error'
                      ? 'border-red-200 bg-red-50'
                      : entry.status === 'done'
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-800">{entry.file.name}</p>
                    {entry.error && (
                      <p className="text-xs text-red-600 truncate">{entry.error}</p>
                    )}
                    {entry.status === 'uploading' && (
                      <p className="text-xs text-primary-600">Uploading…</p>
                    )}
                    {entry.status === 'done' && (
                      <p className="text-xs text-green-600">Uploaded</p>
                    )}
                    {entry.status === 'idle' && (
                      <p className="text-xs text-gray-400">
                        {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  {statusIcon(entry)}
                  {entry.status !== 'uploading' && entry.status !== 'done' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                      className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Course name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Introduction to Machine Learning"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Applied to all files in this upload.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Course code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. CSC 302"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload {files.filter((f) => f.status === 'idle').length > 1
                    ? `${files.filter((f) => f.status === 'idle').length} files`
                    : 'file'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
