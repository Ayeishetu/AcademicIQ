import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, GraduationCap, User } from 'lucide-react'
import clsx from 'clsx'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

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

      {/* Bubble + sources */}
      <div
        className={clsx(
          'flex flex-col gap-1.5 min-w-0',
          // on mobile use more width, leave just enough for avatar
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
