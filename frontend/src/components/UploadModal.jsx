import { useState, useRef } from 'react'
import { X, Upload, FileText, Loader2 } from 'lucide-react'
import { documentsApi } from '../services/api'

const ALLOWED_TYPES = ['.pdf', '.docx', '.txt']
const MAX_SIZE_MB = 500

export default function UploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [course, setCourse] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const validateFile = (f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ALLOWED_TYPES.includes(ext)) {
      return `Unsupported file type. Please upload PDF, DOCX, or TXT.`
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File exceeds ${MAX_SIZE_MB} MB limit.`
    }
    return null
  }

  const handleFileSelect = (f) => {
    const err = validateFile(f)
    if (err) {
      setError(err)
      return
    }
    setError('')
    setFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !course.trim()) return
    setUploading(true)
    setError('')
    try {
      const { data } = await documentsApi.upload(file, course.trim())
      onSuccess(data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary-400 bg-primary-50'
                : file
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-10 h-10 text-green-500" />
                <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  Drop your file here or click to browse
                </p>
                <p className="text-xs text-gray-400">PDF, DOCX, TXT · Max {MAX_SIZE_MB} MB</p>
              </div>
            )}
          </div>

          {/* Course name */}
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
              Used to filter questions by course
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || !course.trim() || uploading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
