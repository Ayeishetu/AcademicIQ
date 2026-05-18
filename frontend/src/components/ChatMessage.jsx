import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, GraduationCap, User } from 'lucide-react'
import clsx from 'clsx'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={clsx('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary-600' : 'bg-gray-200'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <GraduationCap className="w-4 h-4 text-gray-600" />
        )}
      </div>

      {/* Bubble */}
      <div className={clsx('max-w-[75%] space-y-2', isUser ? 'items-end' : 'items-start')}>
        <div
          className={clsx(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-primary-600 text-white rounded-tr-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
          )}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Source citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-400 font-medium px-1">Sources</p>
            {message.sources.map((src, i) => (
              <div
                key={i}
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
}
