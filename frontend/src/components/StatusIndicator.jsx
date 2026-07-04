export default function StatusIndicator({ status, message }) {
  if (!status) return null;

  const config = {
    processing: {
      icon: <span className="spinner" />,
      text: message || 'Processing your website...',
      className: 'status--processing',
    },
    success: {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      text: message || 'Website processed successfully!',
      className: 'status--success',
    },
    error: {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      text: message || 'Something went wrong',
      className: 'status--error',
    },
  };

  const current = config[status];
  if (!current) return null;

  return (
    <div className={`status-indicator ${current.className}`}>
      <div className="status-icon">{current.icon}</div>
      <span className="status-text">{current.text}</span>
    </div>
  );
}
