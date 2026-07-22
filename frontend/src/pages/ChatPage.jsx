import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send, Loader2, BookOpen, Sparkles, Share2, Check, X } from 'lucide-react'
import { chatApi, documentsApi, shareApi } from '../services/api'
import ChatMessage from '../components/ChatMessage'
import CourseFilter from '../components/CourseFilter'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    "Hi! I'm your AI study assistant. Upload your lecture notes or past exam questions in **My Documents**, then ask me anything about your course materials.\n\nI'll search through your documents and give you accurate, cited answers.",
  sources: [],
}

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [courses, setCourses] = useState([])
  const [selectedCourseCode, setSelectedCourseCode] = useState(null)
  const [shareState, setShareState] = useState('idle')
  const [shareLink, setShareLink] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState(null)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const shareLinkRef = useRef(null)

  useEffect(() => {
    documentsApi.courses().then(({ data }) => setCourses(data)).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const sessionParam = searchParams.get('session')
    if (!sessionParam) {
      setMessages([WELCOME_MESSAGE])
      setCurrentSessionId(null)
      setShareState('idle')
      setShareLink('')
      return
    }

    const sessionId = parseInt(sessionParam, 10)
    if (isNaN(sessionId)) return

    setLoadingSession(true)
    chatApi
      .getSession(sessionId)
      .then(({ data }) => {
        if (data.length === 0) {
          setMessages([WELCOME_MESSAGE])
        } else {
          const restored = data.map((msg) => ({
            role: msg.role,
            content: msg.content,
            sources: msg.sources || [],
          }))
          setMessages([WELCOME_MESSAGE, ...restored])
        }
        setCurrentSessionId(sessionId)
      })
      .catch(() => {
        setMessages([WELCOME_MESSAGE])
        setCurrentSessionId(null)
        setSearchParams({})
      })
      .finally(() => setLoadingSession(false))
  }, [searchParams])

  const buildHistory = useCallback(() => {
    return messages
      .slice(1)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }))
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    // reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const history = buildHistory()
      const { data } = await chatApi.query(question, selectedCourseCode, history, currentSessionId)

      if (!currentSessionId) {
        setCurrentSessionId(data.session_id)
        setSearchParams({ session: data.session_id }, { replace: true })
        window.dispatchEvent(new CustomEvent('session-created', { detail: { id: data.session_id } }))
      } else {
        window.dispatchEvent(new CustomEvent('session-updated', { detail: { id: data.session_id } }))
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
          chunksUsed: data.chunks_used,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err.response?.data?.detail || 'Sorry, something went wrong. Please try again.',
          sources: [],
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    // On mobile, Enter should NOT submit (soft keyboard Enter = newline)
    // Only submit on desktop with Enter (no Shift)
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const startNewChat = () => {
    setMessages([WELCOME_MESSAGE])
    setCurrentSessionId(null)
    setShareState('idle')
    setShareLink('')
    setSearchParams({})
    inputRef.current?.focus()
  }

  const deriveTitle = () => {
    const firstUser = messages.find((m) => m.role === 'user')
    if (!firstUser) return 'Shared Chat'
    return firstUser.content.length > 80
      ? firstUser.content.slice(0, 80) + '…'
      : firstUser.content
  }

  const handleShare = async () => {
    const shareable = messages.filter((m) => m !== WELCOME_MESSAGE)
    if (shareable.length === 0) return
    setShareState('loading')
    try {
      const { data } = await shareApi.create(deriveTitle(), shareable)
      const url = `${window.location.origin}/share/${data.token}`
      setShareLink(url)
      setShareState('done')
      setTimeout(() => shareLinkRef.current?.select(), 50)
    } catch {
      setShareState('error')
      setTimeout(() => setShareState('idle'), 3000)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink).catch(() => {
      shareLinkRef.current?.select()
      document.execCommand('copy')
    })
  }

  if (loadingSession) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-sm">Loading conversation…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-primary-600 flex-shrink-0" />
            <h1 className="font-semibold text-gray-900 text-sm md:text-base truncate">
              Ask a Question
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {messages.length > 1 && (
              <button
                onClick={handleShare}
                disabled={shareState === 'loading'}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors disabled:opacity-50"
              >
                {shareState === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : shareState === 'error' ? (
                  <X className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {shareState === 'error' ? 'Failed' : 'Share'}
                </span>
              </button>
            )}
            <button
              onClick={startNewChat}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
            >
              New chat
            </button>
          </div>
        </div>

        {/* Share link banner */}
        {shareState === 'done' && shareLink && (
          <div className="mb-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <input
              ref={shareLinkRef}
              readOnly
              value={shareLink}
              className="flex-1 bg-transparent text-xs text-green-800 outline-none cursor-text truncate min-w-0"
              onClick={(e) => e.target.select()}
            />
            <button
              onClick={copyLink}
              className="text-xs font-medium text-green-700 hover:text-green-900 whitespace-nowrap flex-shrink-0"
            >
              Copy
            </button>
            <button onClick={() => setShareState('idle')} className="text-green-400 hover:text-green-600 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {courses.length > 0 && (
          <CourseFilter
            courses={courses}
            selected={selectedCourseCode}
            onChange={setSelectedCourseCode}
          />
        )}

        {courses.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              No documents yet.{' '}
              <a href="/documents" className="underline font-medium">
                Upload materials
              </a>{' '}
              to get started.
            </span>
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="bg-white border-t border-gray-200 px-3 md:px-6 py-3">
        {selectedCourseCode && (
          <div className="text-xs text-primary-600 mb-1.5 font-medium">
            Searching in: {selectedCourseCode}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your materials…"
            rows={1}
            className="flex-1 input resize-none py-2.5 min-h-[44px] max-h-32 overflow-y-auto text-base md:text-sm"
            style={{ height: 'auto' }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="btn-primary px-3 md:px-4 py-2.5 flex items-center gap-2 self-end flex-shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline text-sm">Send</span>
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-1.5 hidden md:block">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
