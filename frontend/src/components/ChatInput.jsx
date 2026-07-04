import { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/useChat';

export default function ChatInput({ websiteId }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const { sendMessage, isLoading } = useChat();

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    try {
      await sendMessage(trimmed, websiteId);
      setInput('');
    } catch {
      // Error state is handled by ChatContext.
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about the website..."
          rows={1}
          disabled={isLoading}
          className="chat-input-field"
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={isLoading || !input.trim()}
          title="Send message"
        >
          {isLoading ? (
            <span className="spinner spinner--small" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
