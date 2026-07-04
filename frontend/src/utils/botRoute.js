export function normalizeWebsiteId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function extractWebsiteIdFromResult(data) {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const directId =
    data.website_id ||
    data.websiteId ||
    data.conversationId ||
    data.sessionId ||
    data.id;

  if (directId) {
    return normalizeWebsiteId(String(directId));
  }

  const chatbotUrl = data.chatbot_url || data.chatbotUrl;
  if (typeof chatbotUrl !== 'string' || !chatbotUrl.trim()) {
    return '';
  }

  try {
    const parsed = new URL(chatbotUrl, window.location.origin);
    const match = parsed.pathname.match(/\/bot\/([^/]+)\/?$/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    const match = chatbotUrl.match(/\/bot\/([^/?#]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return '';
}

export function buildBotPath(websiteId) {
  const normalized = normalizeWebsiteId(websiteId);
  return normalized ? `/bot/${encodeURIComponent(normalized)}` : '/chat';
}

export function buildBotUrl(websiteId, origin = window.location.origin) {
  const normalized = normalizeWebsiteId(websiteId);
  const base = origin.replace(/\/+$/, '');
  return normalized ? `${base}/bot/${encodeURIComponent(normalized)}` : `${base}/chat`;
}
