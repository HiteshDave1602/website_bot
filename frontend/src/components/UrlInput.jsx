import { useState } from 'react';
import { useChat } from '../context/useChat';

export default function UrlInput() {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');
  const { submitUrl, isProcessingUrl, error, clearError } = useChat();

  function isValidUrl(str) {
    try {
      const parsed = new URL(str);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    setValidationError('');

    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError('Please enter a website URL');
      return;
    }

    let normalizedUrl = trimmed;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    if (!isValidUrl(normalizedUrl)) {
      setValidationError('Please enter a valid URL (e.g., example.com)');
      return;
    }

    try {
      await submitUrl(normalizedUrl);
      setUrl('');
    } catch {
      // error handled in context
    }
  }

  return (
    <form className="url-input" onSubmit={handleSubmit}>
      <div className="url-input-wrapper">
        <svg className="url-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (validationError) setValidationError('');
            if (error) clearError();
          }}
          placeholder="Enter your website URL (e.g., example.com)"
          disabled={isProcessingUrl}
          className="url-input-field"
          autoFocus
        />
        <button
          type="submit"
          className="url-submit-btn"
          disabled={isProcessingUrl || !url.trim()}
        >
          {isProcessingUrl ? (
            <span className="spinner" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          )}
        </button>
      </div>
      {(validationError || error) && (
        <p className="url-input-error">
          {validationError || error}
        </p>
      )}
    </form>
  );
}
