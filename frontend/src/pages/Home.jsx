import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UrlInput from '../components/UrlInput';
import { useChat } from '../context/useChat';
import { buildBotPath, buildBotUrl, extractWebsiteIdFromResult } from '../utils/botRoute';

export default function Home() {
  const navigate = useNavigate();
  const { isProcessingUrl, urlResult } = useChat();
  const websiteId = extractWebsiteIdFromResult(urlResult);
  const chatbotUrl = buildBotUrl(websiteId);

  useEffect(() => {
    if (!urlResult || isProcessingUrl) return;

    navigate(buildBotPath(websiteId), {
      replace: true,
    });
  }, [isProcessingUrl, navigate, urlResult, websiteId]);

  return (
    <main className="home">
      <div className="home-bg">
        <div className="home-bg-glow home-bg-glow--1" />
        <div className="home-bg-glow home-bg-glow--2" />
      </div>

      <div className="home-content">
        <div className="home-hero">
          <div className="home-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            AI-Powered Website Assistant
          </div>

          <h1 className="home-title">
            Chat with any
            <span className="home-title-accent"> website</span>
          </h1>

          <p className="home-subtitle">
            Enter a website URL and instantly get an AI assistant trained on its content.
            Ask questions, get summaries, and discover insights.
          </p>
        </div>

        <div className="home-form-section">
          <UrlInput />

          {isProcessingUrl && (
            <div className="home-processing">
              <div className="processing-bar">
                <div className="processing-bar-fill" />
              </div>
              <p>Analyzing website content...</p>
            </div>
          )}

          {urlResult && !isProcessingUrl && (
            <div className="home-success">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <div>Website processed! Redirecting to chat...</div>
                {websiteId && (
                  <div className="home-chatbot-url">
                    <a href={chatbotUrl} target="_blank" rel="noreferrer">
                      Open chatbot
                    </a>
                    <input type="text" value={chatbotUrl} readOnly aria-label="Chatbot URL" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="home-features">
          <div className="feature-card">
            <div className="feature-icon feature-icon--1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h3>Smart Search</h3>
            <p>Ask natural language questions and get precise answers from your website content.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon--2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3>Instant Training</h3>
            <p>Submit any URL and our AI processes the content in seconds, ready for conversation.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon--3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3>Conversational AI</h3>
            <p>Engage in natural, contextual conversations with an AI that understands your site.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
