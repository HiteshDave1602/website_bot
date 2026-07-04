import { useEffect } from 'react';
import { useChat } from '../context/useChat';

export default function Sidebar({ isOpen, onClose }) {
  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    loadConversations,
    resetChat,
    loadMessages,
  } = useChat();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  function handleSelectConversation(id) {
    setCurrentConversation(id);
    loadMessages(id);
    if (onClose) onClose();
  }

  function handleNewChat() {
    resetChat();
    if (onClose) onClose();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function truncateText(text, maxLen = 40) {
    if (!text) return 'New conversation';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={handleNewChat}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New conversation
          </button>
        </div>
        <div className="sidebar-conversations">
          {conversations.length === 0 ? (
            <div className="sidebar-empty">
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id || conv.conversationId}
                className={`conversation-item ${currentConversation === (conv.id || conv.conversationId) ? 'conversation-item--active' : ''}`}
                onClick={() => handleSelectConversation(conv.id || conv.conversationId)}
              >
                <svg className="conv-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <div className="conv-info">
                  <span className="conv-title">{truncateText(conv.title || conv.message || 'New conversation')}</span>
                  <span className="conv-date">{formatDate(conv.date || conv.timestamp || conv.createdAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
