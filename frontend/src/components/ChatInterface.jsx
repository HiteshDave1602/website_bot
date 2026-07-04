import { useEffect, useRef } from 'react';
import { useChat } from '../context/useChat';
import MessageBubble from './MessageBubble';

export default function ChatInterface() {
  const { messages, isLoading } = useChat();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="chat-interface chat-interface--empty">
        <div className="chat-empty-state">
          <div className="chat-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          </div>
          <h3 className="chat-empty-title">Start a conversation</h3>
          <p className="chat-empty-desc">
            Ask questions about the website content. The AI assistant is trained on the website's data.
          </p>
          <div className="chat-empty-suggestions">
            <button
              className="suggestion-chip"
              onClick={() => {}}
              disabled
            >
              What does this website do?
            </button>
            <button
              className="suggestion-chip"
              onClick={() => {}}
              disabled
            >
              Summarize the main features
            </button>
            <button
              className="suggestion-chip"
              onClick={() => {}}
              disabled
            >
              Key topics covered
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="message-row message-row--assistant">
            <div className="message-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z" />
                <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
              </svg>
            </div>
            <div className="message-bubble message-bubble--loading">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
