import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, GraduationCap, User, Download } from 'lucide-react'
import clsx from 'clsx'

// Keywords that indicate a summary or question-generation response worth downloading
const DOWNLOAD_PATTERN =
  /\b(summar\w+|overview|outline|recap|review|lecture[s]?|generate\s+question|past\s+question|exam\s+question|practice\s+question|study\s+guide|notes)\b/i

function isDownloadable(message) {
  if (message.role !== 'assistant') return false
  if (message.isError) return false
  // Check the question that triggered this response
  const q = message.question || ''
  return DOWNLOAD_PATTERN.test(q) || message.content.length > 800
}

function downloadAsText(message) {
  const question = message.question || 'response'
  // Strip markdown to plain text for the file
  const plain = message.content
    .replace(/#{1,6}\s+/g, '')          // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/`(.+?)`/g, '$1')          // inline code
    .replace(/^[-*+]\s+/gm, '• ')       // bullets
    .replace(/^\d+\.\s+/gm, (m) => m)  // numbered lists — keep as-is
    .trim()

  // Build file content
  const lines = [
    `Question: ${question}`,
    `${'─'.repeat(60)}`,
    '',
    plain,
  ]

  if (message.sources?.length) {
    lines.push('', `${'─'.repeat(60)}`, 'Sources:')
    message.sources.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.filename} · ${s.course_code || s.course} · p.${s.page}`)
    })
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // Sanitise question for use as filename
  a.download = question.replace(/[^a-z0-9\s-]/gi, '').trim().slice(0, 60) + '.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  const showDownload = isDownloadable(message)

  return (
    <div className={clsx('flex gap-2 md:gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={clsx(
          'flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary-600' : 'bg-gray-200'
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
        ) : (
          <GraduationCap className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600" />
        )}
      </div>

      {/* Bubble + sources + download */}
      <div
        className={clsx(
          'flex flex-col gap-1.5 min-w-0',
          'max-w-[85%] md:max-w-[75%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={clsx(
            'px-3 md:px-4 py-2.5 md:py-3 rounded-2xl text-sm leading-relaxed w-full',
            isUser
              ? 'bg-primary-600 text-white rounded-tr-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose-chat break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Download button for summaries / generated questions */}
        {showDownload && (
          <button
            onClick={() => downloadAsText(message)}
            className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg px-3 py-1.5 transition-colors"
            title="Download as text file"
          >
            <Download className="w-3.5 h-3.5" />
            Download as .txt
          </button>
        )}

        {/* Source citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="space-y-1 w-full">
            <p className="text-xs text-gray-400 font-medium px-1">Sources</p>
            {message.sources.map((src, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 text-xs text-blue-700 overflow-hidden"
              >
                <FileText className="w-3 h-3 flex-shrink-0" />
                <span className="font-medium truncate flex-1 min-w-0">{src.filename}</span>
                <span className="text-blue-400 flex-shrink-0">·</span>
                <span className="text-blue-500 truncate max-w-[60px] flex-shrink-0">{src.course_code || src.course}</span>
                <span className="text-blue-400 flex-shrink-0">·</span>
                <span className="flex-shrink-0">p.{src.page}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
