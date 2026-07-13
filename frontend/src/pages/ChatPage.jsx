import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import ChatInput from '../components/ChatInput';
import { useChat } from '../context/useChat';
import { normalizeWebsiteId } from '../utils/botRoute';

export default function ChatPage() {
  const { website_id } = useParams();
  const { error, clearError, websiteId, setWebsiteId } = useChat();

  const activeWebsiteId = normalizeWebsiteId(website_id) || websiteId;

  useEffect(() => {
    if (website_id) {
      setWebsiteId(website_id);
    }
  }, [setWebsiteId, website_id]);

  return (
    <div className="chat-page">
      <div className="chat-main">
        <ChatInterface />
        <ChatInput websiteId={activeWebsiteId} />

        {error && (
          <div className="chat-error-toast">
            <span>{error}</span>
            <button onClick={clearError}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
