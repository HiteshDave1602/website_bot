import { useReducer, useCallback, useEffect } from 'react';
import * as api from '../services/api';
import { ChatContext } from './chatContext';
import { extractWebsiteIdFromResult, normalizeWebsiteId } from '../utils/botRoute';

const CHAT_SESSION_KEY = 'sitebot-chat-session';

function readChatSession() {
  try {
    const raw = sessionStorage.getItem(CHAT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeChatSession(session) {
  try {
    if (!session) {
      sessionStorage.removeItem(CHAT_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors and keep the in-memory session working.
  }
}

function getWebsiteId(session) {
  return session?.websiteId || session?.website_id || session?.submittedUrl || '';
}

function extractAssistantText(data) {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return JSON.stringify(data);

  const candidates = [
    data.response,
    data.output,
    data.message,
    data.text,
    data?.body?.response,
    data?.body?.output,
    data?.data?.response,
    data?.data?.output,
  ];

  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return match || JSON.stringify(data);
}

function chatReducer(state, action) {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    case 'SET_CURRENT_CONVERSATION':
      return { ...state, currentConversation: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_PROCESSING_URL':
      return { ...state, isProcessingUrl: action.payload };
    case 'SET_SUBMITTED_URL':
      return { ...state, submittedUrl: action.payload };
    case 'SET_URL_RESULT':
      return { ...state, urlResult: action.payload };
    case 'SET_WEBSITE_ID':
      return { ...state, websiteId: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'RESET_CHAT':
      return {
        ...state,
        currentConversation: null,
        websiteId: '',
        submittedUrl: '',
        messages: [],
        urlResult: null,
        error: null,
      };
    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const storedSession = readChatSession();
  const [state, dispatch] = useReducer(chatReducer, {
    conversations: [],
    currentConversation: storedSession?.currentConversation || null,
    websiteId: getWebsiteId(storedSession),
    messages: [],
    isLoading: false,
    isProcessingUrl: false,
    submittedUrl: storedSession?.submittedUrl || '',
    urlResult: storedSession?.urlResult || null,
    error: null,
  });

  useEffect(() => {
    if (state.currentConversation || state.urlResult || state.submittedUrl || state.websiteId) {
      writeChatSession({
        currentConversation: state.currentConversation || null,
        websiteId: state.websiteId || '',
        submittedUrl: state.submittedUrl || '',
        urlResult: state.urlResult || null,
      });
      return;
    }

    writeChatSession(null);
  }, [state.currentConversation, state.submittedUrl, state.urlResult, state.websiteId]);

  const submitUrl = useCallback(async (url) => {
    dispatch({ type: 'SET_PROCESSING_URL', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_SUBMITTED_URL', payload: url });
    dispatch({ type: 'SET_URL_RESULT', payload: null });
    try {
      const data = await api.submitUrl(url);
      const websiteId = extractWebsiteIdFromResult(data) || url;
      dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: websiteId });
      dispatch({ type: 'SET_WEBSITE_ID', payload: websiteId });
      dispatch({ type: 'SET_URL_RESULT', payload: data });
      writeChatSession({
        currentConversation: websiteId,
        websiteId,
        submittedUrl: url,
        urlResult: data,
      });
      return data;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      throw err;
    } finally {
      dispatch({ type: 'SET_PROCESSING_URL', payload: false });
    }
  }, []);

  const setWebsiteId = useCallback((websiteId) => {
    dispatch({ type: 'SET_WEBSITE_ID', payload: normalizeWebsiteId(websiteId) });
  }, []);

  const sendMessage = useCallback(async (message, websiteIdOverride) => {
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const websiteId = normalizeWebsiteId(websiteIdOverride) || state.websiteId || state.submittedUrl;
      const data = await api.sendMessage(message, websiteId);
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: extractAssistantText(data),
        timestamp: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
      return data;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}`,
        isError: true,
        timestamp: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.submittedUrl, state.websiteId]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      dispatch({ type: 'SET_CONVERSATIONS', payload: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    try {
      const data = await api.getConversationMessages(conversationId);
      dispatch({ type: 'SET_MESSAGES', payload: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  const setCurrentConversation = useCallback((conversationId) => {
    dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: conversationId });
    const session = readChatSession();
    if (session && session.urlResult) {
      writeChatSession({
        ...session,
        currentConversation: conversationId,
      });
    }
  }, []);

  const resetChat = useCallback(() => {
    dispatch({ type: 'RESET_CHAT' });
    writeChatSession(null);
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  return (
    <ChatContext.Provider
      value={{
        ...state,
        submitUrl,
        sendMessage,
        setWebsiteId,
        loadConversations,
        loadMessages,
        setCurrentConversation,
        resetChat,
        clearError,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
