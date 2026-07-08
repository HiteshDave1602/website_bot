const N8N_WEBHOOK_BASE_URL = import.meta.env.VITE_N8N_WEBHOOK_BASE_URL || '';
const LEGACY_N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || '';

function isWebhookBaseUrl(url) {
  return /\/webhook(?:-test)?\/?$/i.test(url);
}

function appendWebhookPath(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, '')}/${path}`;
}

function resolveWebhookUrl(path, explicitUrl) {
  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = N8N_WEBHOOK_BASE_URL || (
    isWebhookBaseUrl(LEGACY_N8N_WEBHOOK_URL) ? LEGACY_N8N_WEBHOOK_URL : ''
  );

  return baseUrl ? appendWebhookPath(baseUrl, path) : `/webhook/${path}`;
}

function unwrapN8nResponse(data) {
  if (!Array.isArray(data) || data.length !== 1) {
    return data;
  }

  const [item] = data;
  if (item && typeof item === 'object' && 'json' in item) {
    return item.json;
  }

  return item;
}

const CHAT_WEBHOOK_URL = resolveWebhookUrl(
  'chatbot',
  import.meta.env.VITE_N8N_CHAT_WEBHOOK_URL || (
    isWebhookBaseUrl(LEGACY_N8N_WEBHOOK_URL) ? '' : LEGACY_N8N_WEBHOOK_URL
  ),
);
const HOME_WEBHOOK_URL = resolveWebhookUrl('home', import.meta.env.VITE_N8N_HOME_WEBHOOK_URL);

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

  const body = unwrapN8nResponse(parseBody());

  if (!res.ok) {
    if (typeof body === 'string' && body.trim()) {
      throw new Error(body);
    }

    throw new Error(body?.message || body?.error || 'Request failed');
  }

  return body;
}

export async function submitUrl(url) {
  return post(HOME_WEBHOOK_URL, { url });
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
