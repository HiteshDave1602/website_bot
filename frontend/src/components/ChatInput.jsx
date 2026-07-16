import { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/useChat';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';


export default function ChatInput({ websiteId }) {
  const [input, setInput] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [voiceRequested, setVoiceRequested] = useState(false);
  const textareaRef = useRef(null);
  const inputBeforeListeningRef = useRef('');
  const silenceTimerRef = useRef(null);
  const { sendMessage, isLoading } = useChat();
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    browserSupportsContinuousListening,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  const microphoneError = voiceRequested && !isMicrophoneAvailable
    ? 'Microphone access was blocked. Allow it in your browser site settings, then try again.'
    : '';

  useEffect(() => {
    if (!listening) return;

    setInput(`${inputBeforeListeningRef.current}${transcript}`);
  }, [listening, transcript]);

  useEffect(() => {
    if (!transcript.trim() || isLoading) return undefined;

    const spokenMessage = `${inputBeforeListeningRef.current}${transcript}`.trim();
    silenceTimerRef.current = setTimeout(async () => {
      SpeechRecognition.stopListening();

      try {
        await sendMessage(spokenMessage, websiteId);
        setInput('');
        inputBeforeListeningRef.current = '';
        resetTranscript();
      } catch {
        // Error state is handled by ChatContext.
      }
    }, 5000);

    return () => clearTimeout(silenceTimerRef.current);
  }, [isLoading, resetTranscript, sendMessage, transcript, websiteId]);

  useEffect(() => () => {
    clearTimeout(silenceTimerRef.current);
    SpeechRecognition.stopListening();
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  async function handleSubmit(e) {
    e.preventDefault();
    clearTimeout(silenceTimerRef.current);
    SpeechRecognition.stopListening();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    try {
      await sendMessage(trimmed, websiteId);
      setInput('');
    } catch {
      // Error state is handled by ChatContext.
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  async function toggleListening() {
    if (listening) {
      await SpeechRecognition.stopListening();
      return;
    }

    setVoiceRequested(true);
    setSpeechError('');

    if (!window.isSecureContext) {
      setSpeechError('Voice input requires HTTPS. Open the secure https:// version of this page.');
      return;
    }

    const permissionsPolicy = document.permissionsPolicy || document.featurePolicy;
    if (
      window.self !== window.top
      && permissionsPolicy?.allowsFeature
      && !permissionsPolicy.allowsFeature('microphone')
    ) {
      setSpeechError('This embedded chat is not allowed to use the microphone. Add allow="microphone" to its iframe.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setSpeechError('Microphone access is not available in this browser. Try the latest Chrome or Edge.');
      return;
    }

    clearTimeout(silenceTimerRef.current);
    inputBeforeListeningRef.current = input ? `${input.trimEnd()} ` : '';
    resetTranscript();

    try {
      // Request permission for the deployed origin before starting Web Speech.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      await SpeechRecognition.startListening({
        continuous: browserSupportsContinuousListening,
        language: navigator.language || 'en-US',
      });
    } catch (error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
        setSpeechError('Microphone permission was denied. Allow it in your browser site settings, then try again.');
      } else if (error?.name === 'NotFoundError') {
        setSpeechError('No microphone was found on this device.');
      } else if (error?.name === 'NotReadableError') {
        setSpeechError('The microphone is being used by another app. Close it and try again.');
      } else {
        setSpeechError('Voice recognition could not start. Check your connection and try again in Chrome or Edge.');
      }
    }
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            clearTimeout(silenceTimerRef.current);
            setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about the website..."
          rows={1}
          disabled={isLoading}
          className="chat-input-field"
        />
        {browserSupportsSpeechRecognition && (
          <button
            type="button"
            className={`chat-mic-btn${listening ? ' chat-mic-btn--listening' : ''}`}
            onClick={toggleListening}
            disabled={isLoading}
            title={listening ? 'Stop voice input' : 'Start voice input'}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={listening}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="17" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          className="chat-send-btn"
          disabled={isLoading || !input.trim()}
          title="Send message"
        >
          {isLoading ? (
            <span className="spinner spinner--small" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
      {(speechError || microphoneError) && (
        <p className="chat-voice-error" role="alert">
          {speechError || microphoneError}
        </p>
      )}
    </form>
  );
}
