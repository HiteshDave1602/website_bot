import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatInterface from '../components/ChatInterface';
import ChatInput from '../components/ChatInput';
import { useChat } from '../context/useChat';
import { normalizeWebsiteId } from '../utils/botRoute';

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { website_id } = useParams();
  const { error, clearError, submittedUrl, urlResult, websiteId, setWebsiteId } = useChat();

  const activeUrl = location.state?.url || submittedUrl || urlResult?.url || '';
  const activeWebsiteId = normalizeWebsiteId(website_id) || websiteId;

  useEffect(() => {
    if (website_id) {
      setWebsiteId(website_id);
    }
  }, [setWebsiteId, website_id]);

  function getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  return (
    <div className="chat-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="chat-main">
        <div className="chat-main-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="chat-main-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>{activeWebsiteId ? `Website ID: ${activeWebsiteId}` : activeUrl ? getHostname(activeUrl) : 'Chat'}</span>
          </div>
        </div>

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
