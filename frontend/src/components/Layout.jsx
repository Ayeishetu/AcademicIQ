import { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import {
  MessageSquare,
  BookOpen,
  LogOut,
  GraduationCap,
  Plus,
  Trash2,
  Clock,
  Loader2,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../store/authStore'
import { chatApi } from '../services/api'
import clsx from 'clsx'

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Extracted as a proper top-level component so React doesn't unmount/remount
// it on every Layout re-render (which happened when it was an inline function).
function SidebarContent({
  user,
  sessions,
  loadingSessions,
  deletingId,
  activeSessionId,
  onLogout,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onClose,
}) {
  return (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">AcademicIQ</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">AI Study Assistant</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="p-4 space-y-1 border-b border-gray-200">
        <NavLink
          to="/chat"
          end
          onClick={onClose}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive && !activeSessionId
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )
          }
        >
          <MessageSquare className="w-4 h-4 flex-shrink-0" />
          Ask a Question
        </NavLink>
        <NavLink
          to="/documents"
          onClick={onClose}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )
          }
        >
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          My Documents
        </NavLink>
      </nav>

      {/* Chat History */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <Clock className="w-3 h-3" />
            Chat History
          </div>
          <button
            onClick={onNewChat}
            title="New chat"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center px-3 py-4">
              No conversations yet. Ask a question to get started.
            </p>
          ) : (
            sessions.map((session) => {
              const isActive = activeSessionId === session.id
              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={clsx(
                    'group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <MessageSquare
                    className={clsx(
                      'w-3.5 h-3.5 mt-0.5 flex-shrink-0',
                      isActive ? 'text-primary-500' : 'text-gray-400'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate leading-snug">
                      {session.title}
                    </p>
                    <p className={clsx('text-xs mt-0.5', isActive ? 'text-primary-400' : 'text-gray-400')}>
                      {formatRelativeDate(session.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => onDeleteSession(e, session.id)}
                    disabled={deletingId === session.id}
                    title="Delete session"
                    className={clsx(
                      'flex-shrink-0 p-1 rounded transition-colors',
                      'opacity-100 md:opacity-0 md:group-hover:opacity-100',
                      isActive
                        ? 'text-primary-400 hover:text-red-500 hover:bg-red-50'
                        : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                    )}
                  >
                    {deletingId === session.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* User */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-semibold text-sm">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeSessionId = searchParams.get('session')
    ? parseInt(searchParams.get('session'), 10)
    : null

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [searchParams])

  const fetchSessions = useCallback(() => {
    setLoadingSessions(true)
    chatApi
      .sessions()
      .then(({ data }) => setSessions(data))
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    const onCreated = () => fetchSessions()
    const onUpdated = () => fetchSessions()
    window.addEventListener('session-created', onCreated)
    window.addEventListener('session-updated', onUpdated)
    return () => {
      window.removeEventListener('session-created', onCreated)
      window.removeEventListener('session-updated', onUpdated)
    }
  }, [fetchSessions])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNewChat = () => {
    navigate('/chat')
    setSidebarOpen(false)
  }

  const handleSelectSession = (id) => {
    navigate(`/chat?session=${id}`)
    setSidebarOpen(false)
  }

  const handleDeleteSession = async (e, id) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await chatApi.deleteSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeSessionId === id) {
        navigate('/chat')
      }
    } catch {
      // silent fail
    } finally {
      setDeletingId(null)
    }
  }

  const sidebarProps = {
    user,
    sessions,
    loadingSessions,
    deletingId,
    activeSessionId,
    onLogout: handleLogout,
    onNewChat: handleNewChat,
    onSelectSession: handleSelectSession,
    onDeleteSession: handleDeleteSession,
    onClose: () => setSidebarOpen(false),
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Desktop sidebar (always visible ≥ md) ── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ── Mobile sidebar backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-72 bg-white flex flex-col transition-transform duration-300 ease-in-out md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded-md flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">AcademicIQ</span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
