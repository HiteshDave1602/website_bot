const CHAT_WEBHOOK_URL = import.meta.env.DEV
  ? '/webhook/chatbot'
  : (import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/chatbot');
const HOME_WEBHOOK_URL = import.meta.env.VITE_N8N_HOME_WEBHOOK_URL || '/webhook/home';

async function post(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  const parseBody = () => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  if (!res.ok) {
    const err = parseBody();
    throw new Error(err.message || err.error || 'Request failed');
  }

  return parseBody();
}

export async function submitUrl(url) {
  return post(HOME_WEBHOOK_URL, { action: 'process-url', url });
}

export async function sendMessage(message, websiteId) {
  return post(CHAT_WEBHOOK_URL, {
    website_id: websiteId,
    question: message,
  });
}

export async function getConversations() {
  return post(CHAT_WEBHOOK_URL, { action: 'conversations' });
}

export async function getConversationMessages(conversationId) {
  return post(CHAT_WEBHOOK_URL, { action: 'messages', conversationId });
}
