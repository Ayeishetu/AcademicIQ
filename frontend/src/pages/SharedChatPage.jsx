import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { GraduationCap, FileText, Loader2, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { shareApi } from '../services/api'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function SharedChatPage() {
  const { token } = useParams()
  const [chat, setChat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    shareApi
      .get(token)
      .then(({ data }) => setChat(data))
      .catch((err) => {
        setError(
          err.response?.status === 404
            ? 'This shared link doesn\'t exist or has been removed.'
            : 'Failed to load shared chat. Please try again.'
        )
      })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading shared chat…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Link not found</h1>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Go to AcademicIQ →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 group">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
              AcademicIQ
            </span>
          </Link>
          <Link
            to="/register"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Try it free →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Chat metadata */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{chat.title}</h1>
          <p className="text-sm text-gray-500">
            Shared by <span className="font-medium text-gray-700">{chat.shared_by}</span>
            {' · '}
            {formatDate(chat.created_at)}
          </p>
        </div>

        {/* Messages */}
        <div className="space-y-6">
          {chat.messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isUser ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  {isUser ? (
                    <span className="text-white text-xs font-bold">Q</span>
                  ) : (
                    <GraduationCap className="w-4 h-4 text-gray-600" />
                  )}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-primary-600 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                    }`}
                  >
                    {isUser ? (
                      <p>{msg.content}</p>
                    ) : (
                      <div className="prose-chat">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 font-medium px-1">Sources</p>
                      {msg.sources.map((src, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 text-xs text-blue-700"
                        >
                          <FileText className="w-3 h-3 flex-shrink-0" />
                          <span className="font-medium truncate max-w-[200px]">{src.filename}</span>
                          <span className="text-blue-400">·</span>
                          <span className="text-blue-500">{src.course}</span>
                          <span className="text-blue-400">·</span>
                          <span>p.{src.page}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA footer */}
        <div className="mt-12 bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-5 h-5 text-primary-600" />
          </div>
          <h2 className="font-semibold text-gray-900 mb-1">Study smarter with AcademicIQ</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload your lecture notes and get AI-powered answers with citations.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </div>
      </main>
    </div>
  )
}
