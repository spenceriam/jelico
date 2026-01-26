import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Bot } from 'lucide-react'

interface MessageProps {
  message: {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    createdAt: number
  }
  isStreaming?: boolean
}

export function Message({ message, isStreaming }: MessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-accent" />
        </div>
      )}

      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3
          ${isUser
            ? 'bg-bg-elevated text-text-primary'
            : 'bg-transparent'}
        `}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ node, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const isInline = !match

                  if (isInline) {
                    return (
                      <code
                        className="px-1.5 py-0.5 bg-bg-elevated rounded text-accent-bright font-mono text-sm"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  }

                  return (
                    <div className="relative group">
                      <div className="absolute top-2 right-2 text-xs text-text-muted">
                        {match[1]}
                      </div>
                      <pre className="bg-bg-elevated rounded-lg p-4 overflow-x-auto">
                        <code className="font-mono text-sm" {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  )
                },
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0 text-text-primary leading-relaxed">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside mb-3 space-y-1 text-text-primary">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside mb-3 space-y-1 text-text-primary">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-text-primary">{children}</li>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {children}
                  </a>
                ),
                h1: ({ children }) => (
                  <h1 className="text-xl font-semibold text-text-primary mb-3 mt-4 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-text-primary mb-2 mt-4 first:mt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-text-primary mb-2 mt-3 first:mt-0">
                    {children}
                  </h3>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-accent pl-4 italic text-text-secondary my-3">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content || (isStreaming ? '▊' : '')}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-text-secondary" />
        </div>
      )}
    </div>
  )
}
