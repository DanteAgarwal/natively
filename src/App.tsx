import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Send,
  Settings,
  Trash2,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldOff,
  EyeOff,
  Sparkles,
  Zap,
  Check,
  X,
  ExternalLink,
  Loader2,
  Copy,
  MessageSquare,
  ScanLine,
  Info,
  StopCircle,
  ChevronRight,
  Minus,
  GripHorizontal,
  Download,
  MousePointer,
  Briefcase,
  Code,
  FileText,
  Mic,
  MicOff,
  Radio,
  Headphones,
  Volume2,
  Layers,
  ListOrdered,
  Maximize2,
} from 'lucide-react';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { InterviewContextModal } from './components/InterviewContextModal';
import { Header } from './components/Header';
import { HotkeyCheatSheet } from './components/HotkeyCheatSheet';
import { SettingsModal } from './components/SettingsModal';
import { EmptyState } from './components/EmptyState';
import { MessageBubble } from './components/MessageBubble';
import { UserProfileContext, DEFAULT_USER_PROFILE_CONTEXT } from './types/profile';
import {
  Message,
  AppConfig,
  ActiveTab,
  AssistantMode,
  ASSISTANT_MODES,
  QUICK_PROMPTS,
} from './types/config';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGhostActive, setIsGhostActive] = useState(true);
  const [isClickThrough, setIsClickThrough] = useState(false);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('general');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [capturePrompt, setCapturePrompt] = useState('');
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [windowOpacity, setWindowOpacity] = useState(0.97);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Config state
  const [config, setConfig] = useState<AppConfig>({
    provider: 'gemini',
    geminiApiKey: '',
    groqApiKey: '',
    openrouterApiKey: '',
    openrouterModel: 'openrouter/free',
    routerPreset: 'pollinations',
    routerBaseUrl: 'https://text.pollinations.ai/openai',
    routerApiKey: '',
    routerModel: 'openai',
    systemInstruction: '',
    model: 'gemini-3.8-flash',
    groqModel: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    autoFallback: true,
    userProfileContext: DEFAULT_USER_PROFILE_CONTEXT,
  });

  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<{ testing: boolean; success?: boolean; error?: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'capturing' | 'analyzing'>('idle');

  // Push-to-Listen voice state (User Microphone)
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const toggleListeningRef = useRef<() => void>(() => { });

  // Meeting Audio State (System Speaker Output via Rust WASAPI loopback)
  const [isMeetingListening, setIsMeetingListening] = useState(false);
  const [meetingTranscripts, setMeetingTranscripts] = useState<Array<{ id: string; speaker: 'meeting' | 'user'; text: string; timestamp: number }>>([]);
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);
  const [audioDevices, setAudioDevices] = useState<{ inputs: any[]; outputs: any[] }>({ inputs: [], outputs: [] });
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('');
  const [quickToast, setQuickToast] = useState<string | null>(null);
  const [isBigOverlay, setIsBigOverlay] = useState<boolean>(false);

  const toggleMeetingRef = useRef<() => void>(() => {});
  const captureAndAnalyzeRef = useRef<() => void>(() => {});
  const exportSessionRef = useRef<() => void>(() => {});
  const clearMessagesRef = useRef<() => void>(() => {});
  const whatToAnswerRef = useRef<() => void>(() => {});
  const recapRef = useRef<() => void>(() => {});
  const followUpRef = useRef<() => void>(() => {});
  const shortenRef = useRef<() => void>(() => {});
  const cycleProviderRef = useRef<() => void>(() => {});
  const toggleWindowSizeRef = useRef<() => void>(() => {});
  const copyLastResponseRef = useRef<() => void>(() => {});
  const stopStreamRef = useRef<() => void>(() => {});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<boolean>(false);

  // Load config on mount
  useEffect(() => {
    if (window.ghostAPI) {
      window.ghostAPI.getConfig().then((cfg) => {
        if (cfg) {
          const obsoleteGemini = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.5-pro',
            'gemini-2.5-flash-lite',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-3-flash-preview',
          ];
          if (obsoleteGemini.includes(cfg.model)) {
            cfg.model = 'gemini-3.8-flash';
          }
          const obsoleteGroq = ['llama-3.2-11b-vision-preview', 'deepseek-r1-distill-llama-70b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
          if (obsoleteGroq.includes(cfg.groqModel)) {
            cfg.groqModel = 'llama-3.3-70b-versatile';
          }
          if (cfg.selectedAudioOutputDevice) {
            setSelectedOutputDevice(cfg.selectedAudioOutputDevice);
          }
          if (cfg.userProfileContext) {
            cfg.userProfileContext = { ...DEFAULT_USER_PROFILE_CONTEXT, ...cfg.userProfileContext };
          }
          setConfig((prev) => ({ ...prev, ...cfg }));
        }
      });
    }
  }, []);

  // Set up event listeners from Electron
  useEffect(() => {
    if (!window.ghostAPI) return;

    let buffer = '';
    let rafTimer: number | null = null;

    const flushChunkBuffer = () => {
      if (!buffer) return;
      const incoming = buffer;
      buffer = '';
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === 'model') {
          return [...prev.slice(0, -1), { ...last, text: last.text + incoming }];
        }
        return prev;
      });
    };

    const unsubChunk = window.ghostAPI.onStreamChunk((chunk) => {
      if (abortRef.current) return;
      buffer += chunk;
      if (!rafTimer) {
        rafTimer = requestAnimationFrame(() => {
          flushChunkBuffer();
          rafTimer = null;
        });
      }
    });

    const unsubEnd = window.ghostAPI.onStreamEnd(() => {
      if (rafTimer) {
        cancelAnimationFrame(rafTimer);
        rafTimer = null;
      }
      flushChunkBuffer();
      setIsStreaming(false);
      setCaptureStatus('idle');
      abortRef.current = false;
    });

    const unsubError = window.ghostAPI.onStreamError((err) => {
      setIsStreaming(false);
      setCaptureStatus('idle');
      abortRef.current = false;
      setMessages((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'model' && prev[prev.length - 1].text === '') {
          return [
            ...prev.slice(0, -1),
            {
              id: prev[prev.length - 1].id,
              role: 'model',
              text: `⚠️ **Error**: ${err}`,
              timestamp: Date.now(),
              isError: true,
            },
          ];
        }
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'model',
            text: `⚠️ **Error**: ${err}`,
            timestamp: Date.now(),
            isError: true,
          },
        ];
      });
    });

    const unsubScreenshot = window.ghostAPI.onScreenshotCaptured(({ previewUrl, prompt }) => {
      setCaptureStatus('analyzing');
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'user',
          text: prompt,
          screenshotPreview: previewUrl,
          timestamp: Date.now(),
        },
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: '',
          timestamp: Date.now(),
        },
      ]);
      setIsStreaming(true);
      // Auto switch to chat to see result
      setActiveTab('chat');
    });

    const unsubHotkeyCapture = window.ghostAPI.onTriggerCapture(() => {
      handleCaptureAndAnalyze();
    });

    const unsubHotkeyListen = window.ghostAPI.onTriggerListen?.(() => {
      toggleListeningRef.current();
    });

    const unsubClickThrough = window.ghostAPI.onClickThroughToggled((active) => {
      setIsClickThrough(active);
    });

    const unsubPanic = window.ghostAPI.onPanicHide(() => {
      setIsStreaming(false);
      setCaptureStatus('idle');
      abortRef.current = true;
      window.ghostAPI?.stopStream();
    });

    const unsubMeetingTranscript = window.ghostAPI.onMeetingTranscript?.((item) => {
      setMeetingTranscripts((prev) => [...prev.slice(-40), item]);
    });

    const unsubMeetingStatus = window.ghostAPI.onMeetingStatus?.((status) => {
      setIsMeetingListening(status.isCapturing);
    });

    // Fetch audio devices from Rust native module
    window.ghostAPI.getAudioDevices?.().then((devices) => {
      if (devices) {
        setAudioDevices(devices);
      }
    });

    const unsubHotkeyMeeting = window.ghostAPI.onTriggerMeeting?.(() => {
      toggleMeetingRef.current();
    });

    const unsubWindowSize = window.ghostAPI.onWindowSizeToggled?.((expanded) => {
      setIsBigOverlay(expanded);
    });

    return () => {
      unsubChunk();
      unsubEnd();
      unsubError();
      unsubScreenshot();
      unsubHotkeyCapture();
      unsubHotkeyListen?.();
      unsubClickThrough();
      unsubPanic();
      unsubMeetingTranscript?.();
      unsubMeetingStatus?.();
      unsubHotkeyMeeting?.();
      unsubWindowSize?.();
    };
  }, []);

  // Universal Keyboard Shortcut Dispatcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      // 1. Escape: Hierarchical Smart Dismiss
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isStreaming) {
          stopStreamRef.current();
          setQuickToast('Streaming cancelled ⏹️');
          setTimeout(() => setQuickToast(null), 1500);
          return;
        }
        if (isListening) {
          stopListening();
          return;
        }
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
        if (showTranscriptDrawer) {
          setShowTranscriptDrawer(false);
          return;
        }
        if (isInputFocused && inputPrompt) {
          setInputPrompt('');
          return;
        }
        if (isInputFocused) {
          (activeEl as HTMLElement).blur();
          return;
        }
        if (window.ghostAPI) {
          window.ghostAPI.minimizeWindow();
        }
        return;
      }

      // 2. Cheatsheet HUD (? when not typing, or F1)
      if ((e.key === '?' && !isInputFocused) || e.key === 'F1') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // 3. Focus Prompt Input (/ when not typing, or Alt+/, or Ctrl+L)
      if (((e.key === '/' && !isInputFocused) || (e.altKey && e.key === '/') || (e.ctrlKey && e.key.toLowerCase() === 'l')) && !e.shiftKey) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // 4. Voice Dictation (F9 or Alt+L or Ctrl+Shift+L)
      if (e.key === 'F9' || (e.altKey && e.key.toLowerCase() === 'l') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l')) {
        e.preventDefault();
        toggleListeningRef.current();
        return;
      }

      // 5. Capture & Analyze Screen (Alt+S or Ctrl+Shift+S)
      if ((e.altKey && e.key.toLowerCase() === 's') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        captureAndAnalyzeRef.current();
        return;
      }

      // 6. Meeting Audio Sync (Alt+M or Ctrl+Shift+M)
      if ((e.altKey && e.key.toLowerCase() === 'm') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm')) {
        e.preventDefault();
        toggleMeetingRef.current();
        return;
      }

      // 7. Toggle Meeting Transcripts Drawer (Alt+T or Ctrl+Shift+T)
      if ((e.altKey && e.key.toLowerCase() === 't') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't')) {
        e.preventDefault();
        setShowTranscriptDrawer((prev) => !prev);
        return;
      }

      // 8. Meeting Action Pills (Alt+W, Alt+R, Alt+F, Alt+K)
      if (e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        whatToAnswerRef.current();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        recapRef.current();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        followUpRef.current();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        shortenRef.current();
        return;
      }

      // 9. Clear Chat (Ctrl+K or Ctrl+Shift+C)
      if ((e.ctrlKey && e.key.toLowerCase() === 'k' && !e.altKey) || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c')) {
        e.preventDefault();
        clearMessagesRef.current();
        setQuickToast('Conversation cleared 🗑️');
        setTimeout(() => setQuickToast(null), 1500);
        return;
      }

      // 10. Copy Last Response (Alt+C or Ctrl+Shift+Y)
      if ((e.altKey && e.key.toLowerCase() === 'c') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        copyLastResponseRef.current();
        return;
      }

      // 11. Cycle AI Provider (Alt+P or Ctrl+Shift+P)
      if ((e.altKey && e.key.toLowerCase() === 'p') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        cycleProviderRef.current();
        return;
      }

      // 12. Toggle Overlay Size (Big vs Standard) (Alt+B or Ctrl+Shift+B)
      if ((e.altKey && e.key.toLowerCase() === 'b') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        toggleWindowSizeRef.current();
        return;
      }

      // 13. Settings (Ctrl+, or Alt+,)
      if ((e.ctrlKey && e.key === ',') || (e.altKey && e.key === ',')) {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
        return;
      }

      // 14. Export Session (Alt+E or Ctrl+Shift+E)
      if ((e.altKey && e.key.toLowerCase() === 'e') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e')) {
        e.preventDefault();
        exportSessionRef.current();
        return;
      }

      // 15. Toggle Click-Through (Alt+X or Ctrl+Shift+X)
      if ((e.altKey && e.key.toLowerCase() === 'x') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x')) {
        e.preventDefault();
        handleToggleClickThrough();
        return;
      }

      // 16. Toggle Ghost Shield (Alt+G or Ctrl+Shift+G)
      if ((e.altKey && e.key.toLowerCase() === 'g') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g')) {
        e.preventDefault();
        handleToggleGhostMode();
        return;
      }

      // 17. Toggle Interview Persona & JD Context Modal (Alt+U or Alt+J)
      if (e.altKey && (e.key.toLowerCase() === 'u' || e.key.toLowerCase() === 'j')) {
        e.preventDefault();
        setIsContextModalOpen((prev) => !prev);
        return;
      }

      // 18. Tab Switching (Alt+1 for Chat, Alt+2 for Screen AI)
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setActiveTab('chat');
        return;
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        setActiveTab('capture');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isContextModalOpen, showShortcuts, isListening, isStreaming, showTranscriptDrawer, inputPrompt]);

  // Auto-scroll when messages update
  useEffect(() => {
    if (!isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isCollapsed]);

  // Adjust window size on collapse/expand
  useEffect(() => {
    if (window.ghostAPI) {
      if (isCollapsed) {
        window.ghostAPI.setWindowHeight(52);
      } else {
        window.ghostAPI.setWindowHeight(720);
      }
    }
  }, [isCollapsed]);

  // Toggle Click-Through Mode
  const handleToggleClickThrough = async () => {
    if (window.ghostAPI) {
      const active = await window.ghostAPI.toggleClickThrough();
      setIsClickThrough(active);
    }
  };

  // Export session to Markdown
  const handleExportSession = async () => {
    const activeModelName =
      config.provider === 'groq'
        ? config.groqModel
        : config.provider === 'openrouter'
          ? config.openrouterModel
          : config.provider === 'router'
            ? (config.routerModel || config.routerPreset)
            : config.model;

    let markdown = `# Ghost AI Session Export\n*Date: ${new Date().toLocaleString()}*  \n*Provider: ${config.provider.toUpperCase()}*  \n*Model: ${activeModelName}*  \n*Mode: ${assistantMode.toUpperCase()}*\n\n---\n\n`;

    for (const msg of messages) {
      const timeStr = new Date(msg.timestamp).toLocaleTimeString();
      if (msg.role === 'user') {
        markdown += `### 👤 Prompt (${timeStr})\n\n${msg.text}\n\n`;
      } else {
        markdown += `### 🤖 Ghost Copilot (${timeStr})\n\n${msg.text}\n\n---\n\n`;
      }
    }

    if (window.ghostAPI) {
      const res = await window.ghostAPI.exportSession(markdown);
      if (res.success) {
        setExportNotice('Saved to file ✓');
        setTimeout(() => setExportNotice(null), 3500);
      }
    }
  };

  // Core AI Prompt Dispatcher (used by both text input and voice STT)
  const executePrompt = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || isStreaming) return;

    if (!hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: '',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputPrompt('');
    setIsStreaming(true);
    abortRef.current = false;

    try {
      const history = messages.slice(-12).map((m) => ({ role: m.role, text: m.text }));
      const activeModeObj = ASSISTANT_MODES.find((m) => m.id === assistantMode);
      const finalPrompt = assistantMode !== 'general' && activeModeObj
        ? `[Mode Instruction: ${activeModeObj.prompt}]\n\n${text}`
        : text;

      await window.ghostAPI.sendMessage(finalPrompt, history);
    } catch (err: any) {
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: `⚠️ Error: ${err?.message || 'Failed to send'}`,
          timestamp: Date.now(),
          isError: true,
        },
      ]);
    }
  };

  // Send a regular text message
  const handleSendMessage = async () => {
    executePrompt(inputPrompt);
  };

  // ── Push-to-Listen Audio Recording & Speech-to-Text ──
  const startListening = async () => {
    if (isListening || isTranscribing) return;
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsListening(true);
    } catch (err: any) {
      console.error('Failed to access microphone:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: `⚠️ Microphone Error: ${err?.message || 'Could not access microphone. Please check permissions.'}`,
          timestamp: Date.now(),
          isError: true,
        },
      ]);
    }
  };

  const stopListening = () => {
    if (!mediaRecorderRef.current || !isListening) return;

    const recorder = mediaRecorderRef.current;
    setIsListening(false);

    recorder.onstop = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (audioBlob.size < 400) {
        return;
      }

      setIsTranscribing(true);

      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const resultStr = reader.result as string;
          const base64Data = resultStr ? resultStr.split(',')[1] : null;
          if (!base64Data) {
            setIsTranscribing(false);
            return;
          }

          const result = await window.ghostAPI.transcribeAudio({
            audioBase64: base64Data,
            mimeType: 'audio/webm',
          });

          setIsTranscribing(false);

          if (result && result.success && result.text?.trim()) {
            const transcribedText = result.text.trim();
            setInputPrompt(transcribedText);
            // Automatically execute the question into the AI pipeline
            executePrompt(transcribedText);
          } else if (result && result.error) {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'model',
                text: `⚠️ Voice Transcription Error: ${result.error}`,
                timestamp: Date.now(),
                isError: true,
              },
            ]);
          }
        };
        reader.readAsDataURL(audioBlob);
      } catch (err: any) {
        setIsTranscribing(false);
        console.error('Transcription failed:', err);
      }
    };

    recorder.stop();
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // ── Meeting Audio (Rust WASAPI / ScreenCaptureKit System Loopback) ──
  const toggleMeetingAudio = async () => {
    if (isMeetingListening) {
      const res = await window.ghostAPI.stopMeetingAudio?.();
      if (res?.success) {
        setIsMeetingListening(false);
      }
    } else {
      const res = await window.ghostAPI.startMeetingAudio?.(selectedOutputDevice || undefined);
      if (res?.success) {
        setIsMeetingListening(true);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'model',
            text: `⚠️ Meeting Audio Capture: ${res?.error || 'Could not start speaker capture. Ensure speakers/headphones are active.'}`,
            timestamp: Date.now(),
            isError: true,
          },
        ]);
      }
    }
  };

  const handleWhatToAnswer = async () => {
    const rolling = await window.ghostAPI.getRollingTranscript?.();
    const sourceList = (rolling && rolling.length > 0) ? rolling : meetingTranscripts;
    if (!sourceList || sourceList.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: 'ℹ️ No meeting audio transcript captured yet. Click **"Sync Meeting"** in the action bar to start capturing the interviewer or speaker audio.',
          timestamp: Date.now(),
        },
      ]);
      return;
    }
    const recent = sourceList.slice(-6).map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`).join('\n');
    const profile = config.userProfileContext;
    const personaInstruction = profile?.enabled
      ? `\n\n[Persona Directive]: Answer speaking directly in first-person ("I...") as the candidate applying for ${profile.targetRole || 'the position'}${profile.targetCompany ? ` at ${profile.targetCompany}` : ''}. Tailor your terminology, depth, and tone for a ${profile.audienceType} interviewer. Highlight relevant experience from my resume.`
      : '';
    executePrompt(`Based on this live meeting conversation:\n\n${recent}\n\nWhat is the best, most direct, and impressive answer to what was just asked or discussed? Give me the answer formatted concisely to speak aloud.${personaInstruction}`);
  };

  const handleRecapMeeting = async () => {
    const rolling = await window.ghostAPI.getRollingTranscript?.();
    const sourceList = (rolling && rolling.length > 0) ? rolling : meetingTranscripts;
    if (!sourceList || sourceList.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: 'ℹ️ No meeting transcript recorded yet. Click **"Sync Meeting"** to start recording notes.',
          timestamp: Date.now(),
        },
      ]);
      return;
    }
    const fullTranscript = sourceList.map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`).join('\n');
    const profile = config.userProfileContext;
    const personaInstruction = profile?.enabled
      ? ` Also highlight key takeaways, questions answered, and strategic next steps relevant to my candidacy for ${profile.targetRole || 'the role'}.`
      : '';
    executePrompt(`Please provide a concise executive summary, key decisions, and action items from this meeting conversation transcript:\n\n${fullTranscript}${personaInstruction}`);
  };

  const handleFollowUp = async () => {
    const rolling = await window.ghostAPI.getRollingTranscript?.();
    const sourceList = (rolling && rolling.length > 0) ? rolling : meetingTranscripts;
    const context = sourceList && sourceList.length > 0
      ? sourceList.slice(-8).map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`).join('\n')
      : messages.slice(-4).map((m) => `${m.role}: ${m.text}`).join('\n');
    const profile = config.userProfileContext;
    const personaInstruction = profile?.enabled
      ? `\n\n[Persona Directive]: Tailor these questions for a ${profile.audienceType} interviewer${profile.targetCompany ? ` at ${profile.targetCompany}` : ''} to demonstrate deep ownership and strategic alignment with ${profile.targetRole || 'the target role'}.`
      : '';
    executePrompt(`Based on this ongoing discussion:\n\n${context}\n\nSuggest 3 sharp, strategic follow-up questions I can ask right now to steer the conversation effectively.${personaInstruction}`);
  };

  const handleShorten = async () => {
    const lastModel = [...messages].reverse().find((m) => m.role === 'model' && m.text && !m.isError);
    if (!lastModel) return;
    executePrompt(`Shorten the following answer into 2-3 crisp, punchy bullet points that are quick and easy to say aloud in an interview:\n\n${lastModel.text}`);
  };

  const clearMeetingTranscripts = async () => {
    await window.ghostAPI.clearRollingTranscript?.();
    setMeetingTranscripts([]);
  };

  const handleCycleProvider = () => {
    const providers: Array<'gemini' | 'groq' | 'openrouter' | 'router'> = ['gemini', 'groq', 'openrouter', 'router'];
    const currentIndex = providers.indexOf(config.provider);
    const nextProvider = providers[(currentIndex + 1) % providers.length];
    const newConfig = { ...config, provider: nextProvider };
    setConfig(newConfig);
    if (window.ghostAPI) {
      window.ghostAPI.saveConfig(newConfig);
    }
    setQuickToast(`Switched to ${nextProvider.toUpperCase()} ⚡`);
    setTimeout(() => setQuickToast(null), 2500);
  };

  const handleToggleWindowSize = async () => {
    if (window.ghostAPI?.toggleWindowSize) {
      const expanded = await window.ghostAPI.toggleWindowSize();
      setIsBigOverlay(expanded);
      setQuickToast(expanded ? 'Expanded Screen (800x880) 📐' : 'Standard Screen (640x720) 📏');
      setTimeout(() => setQuickToast(null), 2500);
    }
  };

  const handleCopyLastResponse = () => {
    const lastModelMessage = [...messages].reverse().find((m) => m.role === 'model' && m.text);
    if (lastModelMessage) {
      navigator.clipboard.writeText(lastModelMessage.text);
      setQuickToast('Copied response to clipboard ✓');
      setTimeout(() => setQuickToast(null), 2000);
    } else {
      setQuickToast('No response to copy');
      setTimeout(() => setQuickToast(null), 2000);
    }
  };

  // Keep action refs updated for universal hotkey dispatcher
  useEffect(() => {
    toggleListeningRef.current = toggleListening;
    toggleMeetingRef.current = toggleMeetingAudio;
    captureAndAnalyzeRef.current = handleCaptureAndAnalyze;
    exportSessionRef.current = handleExportSession;
    clearMessagesRef.current = handleClearMessages;
    whatToAnswerRef.current = handleWhatToAnswer;
    recapRef.current = handleRecapMeeting;
    followUpRef.current = handleFollowUp;
    shortenRef.current = handleShorten;
    cycleProviderRef.current = handleCycleProvider;
    toggleWindowSizeRef.current = handleToggleWindowSize;
    copyLastResponseRef.current = handleCopyLastResponse;
    stopStreamRef.current = handleStopStream;
  });

  // Capture screen & analyze with Vision AI
  const handleCaptureAndAnalyze = useCallback(
    async (customPrompt?: string) => {
      if (isStreaming) return;

      const hasActiveKey =
        config.provider === 'gemini'
          ? !!config.geminiApiKey?.trim()
          : config.provider === 'groq'
            ? !!config.groqApiKey?.trim()
            : config.provider === 'openrouter'
              ? !!config.openrouterApiKey?.trim()
              : (config.routerPreset === 'pollinations' || !!config.routerBaseUrl?.trim());

      if (!hasActiveKey) {
        setIsSettingsOpen(true);
        return;
      }

      setCaptureStatus('capturing');
      abortRef.current = false;

      try {
        const activeModeObj = ASSISTANT_MODES.find((m) => m.id === assistantMode);
        const basePrompt = customPrompt || capturePrompt || 'Analyze this screen carefully. If there is a question, coding problem, error, or task — provide the direct, correct answer or solution. Be concise and structured.';
        const profile = config.userProfileContext;
        const personaPrefix = profile?.enabled
          ? `[Context: Candidate for ${profile.targetRole || profile.candidateTitle || 'the position'} | Audience: ${profile.audienceType}]\n`
          : '';
        const finalPrompt = assistantMode !== 'general' && activeModeObj
          ? `[Mode Instruction: ${activeModeObj.prompt}]\n\n${personaPrefix}${basePrompt}`
          : `${personaPrefix}${basePrompt}`;

        await window.ghostAPI.captureAndAnalyze(finalPrompt);
      } catch (err: any) {
        setIsStreaming(false);
        setCaptureStatus('idle');
      }
    },
    [isStreaming, config.provider, config.geminiApiKey, config.groqApiKey, config.openrouterApiKey, config.routerPreset, config.routerBaseUrl, config.userProfileContext, capturePrompt, assistantMode]
  );

  const handleStopStream = () => {
    abortRef.current = true;
    setIsStreaming(false);
    setCaptureStatus('idle');
    window.ghostAPI?.stopStream();
    // Mark the last model message as complete
    setMessages((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].role === 'model' && prev[prev.length - 1].text === '') {
        return [...prev.slice(0, -1)];
      }
      return prev;
    });
  };

  const handleClearMessages = () => {
    if (!isStreaming) setMessages([]);
  };

  const handleToggleGhostMode = async () => {
    // 🛡️ Ghost Shield is permanently locked ON during interviews
    if (window.ghostAPI) {
      await window.ghostAPI.toggleGhostMode();
      setIsGhostActive(true);
    }
    setQuickToast('Ghost Shield is permanently locked ON for stealth protection 🛡️');
    setTimeout(() => setQuickToast(null), 2500);
  };

  const handleTestKey = async (providerOverride?: 'gemini' | 'groq' | 'openrouter' | 'router') => {
    const provider = providerOverride || config.provider;
    let key = '';
    if (provider === 'gemini') key = config.geminiApiKey.trim();
    else if (provider === 'groq') key = config.groqApiKey.trim();
    else if (provider === 'openrouter') key = config.openrouterApiKey.trim();
    else if (provider === 'router') key = config.routerApiKey.trim();

    if (provider !== 'router' && !key) return;
    setTestStatus({ testing: true });
    try {
      const res = await window.ghostAPI.testApiKey(key, provider, {
        baseUrl: config.routerBaseUrl,
        model: config.routerModel,
      });
      setTestStatus({ testing: false, success: res.success, error: res.error });
    } catch (e: any) {
      setTestStatus({ testing: false, success: false, error: e?.message });
    }
  };

  const handleSaveConfig = async () => {
    if (window.ghostAPI) {
      await window.ghostAPI.saveConfig({ ...config, selectedOutputDevice });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      setIsSettingsOpen(false);
    }
  };

  const handleSaveUserProfileContext = async (updated: UserProfileContext) => {
    const newConfig: AppConfig = {
      ...config,
      userProfileContext: updated,
    };
    setConfig(newConfig);
    if (window.ghostAPI) {
      await window.ghostAPI.saveConfig(newConfig);
    }
    setQuickToast(updated.enabled ? 'Interview Persona Active 🎯' : 'Persona Context Saved ✓');
    setTimeout(() => setQuickToast(null), 2500);
  };

  const hasApiKey =
    config.provider === 'gemini'
      ? !!config.geminiApiKey?.trim()
      : config.provider === 'groq'
        ? !!config.groqApiKey?.trim()
        : config.provider === 'openrouter'
          ? !!config.openrouterApiKey?.trim()
          : (config.routerPreset === 'pollinations' || !!config.routerBaseUrl?.trim());
  const messageCount = messages.length;

  return (
    <div
      className="w-full h-screen p-2 box-border flex flex-col font-sans select-none"
      style={{ background: 'transparent', opacity: windowOpacity }}
    >
      {/* Main Glass Shell */}
      <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden transition-all duration-200 relative"
        style={{
          background: 'rgba(10, 11, 16, 0.96)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.9), 0 0 0 0.5px rgba(255,255,255,0.05)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Floating Quick Action Toast Notification */}
        {quickToast && (
          <div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-2xl border flex items-center gap-1.5 pointer-events-none transition-all"
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
            }}
          >
            <span>{quickToast}</span>
          </div>
        )}

        {/* ── Top Bar / Drag Handle ── */}
        <Header
          isGhostActive={isGhostActive}
          onToggleGhostMode={handleToggleGhostMode}
          isClickThrough={isClickThrough}
          onToggleClickThrough={handleToggleClickThrough}
          config={config}
          onCycleProvider={handleCycleProvider}
          isBigOverlay={isBigOverlay}
          onToggleWindowSize={handleToggleWindowSize}
          showShortcuts={showShortcuts}
          onToggleShortcuts={() => setShowShortcuts((v) => !v)}
          onOpenContextModal={() => setIsContextModalOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onMinimize={() => window.ghostAPI?.minimizeWindow()}
          onClose={() => window.ghostAPI?.closeWindow()}
        />

        {/* ── Click-Through Notice Banner ── */}
        {isClickThrough && !isCollapsed && (
          <div
            className="shrink-0 px-3 py-1.5 flex items-center justify-between text-[11px] border-b no-drag"
            style={{
              background: 'rgba(99,102,241,0.15)',
              borderColor: 'rgba(99,102,241,0.3)',
              color: '#c7d2fe',
            }}
            onMouseEnter={() => window.ghostAPI?.setIgnoreMouseEvents(false)}
            onMouseLeave={() => window.ghostAPI?.setIgnoreMouseEvents(true, { forward: true })}
          >
            <div className="flex items-center gap-1.5">
              <MousePointer className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
              <span><strong>Click-Through Active</strong> — Clicks pass to apps behind. Press <kbd className="px-1 py-0.2 rounded font-mono text-[10px]" style={{ background: 'rgba(99,102,241,0.35)', border: '1px solid rgba(99,102,241,0.5)' }}>Alt+X</kbd> or <kbd className="px-1 py-0.2 rounded font-mono text-[10px]" style={{ background: 'rgba(99,102,241,0.35)', border: '1px solid rgba(99,102,241,0.5)' }}>Ctrl+Shift+X</kbd> to interact.</span>
            </div>
            <button
              onClick={handleToggleClickThrough}
              className="px-2 py-0.5 rounded text-[10px] font-medium transition-all"
              style={{ background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.45)' }}
            >
              Disable (Alt+X)
            </button>
          </div>
        )}

        {/* ── Comprehensive Keyboard Shortcuts Cheatsheet Modal ── */}
        <HotkeyCheatSheet
          show={showShortcuts && !isCollapsed}
          onClose={() => setShowShortcuts(false)}
        />

        {/* ── Content Area (Hidden if Collapsed) ── */}
        {!isCollapsed && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* No API Key Warning */}
            {!hasApiKey && (
              <div
                className="shrink-0 mx-3 mt-2.5 px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-[11px]"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <div>
                  <span className="font-semibold">API key required. </span>
                  <button onClick={() => setIsSettingsOpen(true)} className="underline hover:text-amber-300">Open Settings</button>
                  {' to add your free Gemini key.'}
                </div>
              </div>
            )}

            {/* ── Tab Navigation ── */}
            <div
              className="shrink-0 flex items-center gap-1 px-3 pt-2.5 pb-1.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              {[
                { id: 'chat' as const, label: 'Chat', icon: MessageSquare, shortcut: 'Alt+1', badge: messageCount > 0 ? messageCount : null },
                { id: 'capture' as const, label: 'Screen AI', icon: ScanLine, shortcut: 'Alt+2' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150"
                  style={{
                    background: activeTab === tab.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: activeTab === tab.id ? '#60a5fa' : 'rgba(255,255,255,0.35)',
                    border: activeTab === tab.id ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                  }}
                  title={`Switch to ${tab.label} [${tab.shortcut}]`}
                >
                  <tab.icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                  <kbd className="font-mono text-[8px] bg-white/5 px-1 rounded opacity-50">{tab.shortcut}</kbd>
                  {tab.badge && (
                    <span className="px-1 py-0 rounded text-[9px] font-semibold" style={{ background: 'rgba(59,130,246,0.3)', color: '#93c5fd' }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}

              {/* Export & Clear & Opacity */}
              <div className="ml-auto flex items-center gap-2">
                {messages.length > 0 && (
                  <>
                    <button
                      onClick={handleExportSession}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
                      title="Export Session as Markdown [Alt+E]"
                    >
                      <Download className="w-2.5 h-2.5" />
                      <span>Export</span>
                      <kbd className="font-mono text-[8px] opacity-60 ml-0.5">Alt+E</kbd>
                    </button>
                    <button
                      onClick={handleClearMessages}
                      className="p-1 rounded text-white/30 hover:text-red-400 transition-colors"
                      title="Clear Session Messages [Ctrl+K]"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
                <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/5">
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Opacity</span>
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.05"
                    value={windowOpacity}
                    onChange={(e) => setWindowOpacity(parseFloat(e.target.value))}
                    className="w-14 h-1 appearance-none rounded cursor-pointer"
                    style={{ accentColor: '#3b82f6' }}
                    title={`Opacity: ${Math.round(windowOpacity * 100)}%`}
                  />
                </div>
              </div>
            </div>

            {/* ── Assistant Mode Selector Strip ── */}
            <div
              className="shrink-0 flex items-center justify-between px-3 py-1.5"
              style={{ background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-1">
                <span className="text-[10px] mr-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Mode:</span>
                {ASSISTANT_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setAssistantMode(m.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all"
                    style={{
                      background: assistantMode === m.id ? 'rgba(59,130,246,0.18)' : 'transparent',
                      color: assistantMode === m.id ? '#93c5fd' : 'rgba(255,255,255,0.4)',
                      border: assistantMode === m.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                    }}
                    title={m.prompt}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => setIsContextModalOpen(true)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    config.userProfileContext?.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-white border border-zinc-700/60'
                  }`}
                  title="Configure Candidate Resume, JD & Audience Persona [Alt+U / Alt+J]"
                >
                  <Briefcase className="w-2.5 h-2.5 text-emerald-400" />
                  <span>
                    {config.userProfileContext?.enabled
                      ? `Persona: ${config.userProfileContext.targetRole || config.userProfileContext.candidateTitle || 'Active'} (${config.userProfileContext.audienceType})`
                      : 'Resume & JD'}
                  </span>
                  {config.userProfileContext?.enabled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                  )}
                </button>
                {exportNotice && (
                  <span className="text-[10px] text-emerald-400 font-medium">{exportNotice}</span>
                )}
              </div>
            </div>

            {/* ── Active Context & Persona Banner ── */}
            {config.userProfileContext?.enabled && (
              <div
                className="shrink-0 mx-3 mt-1.5 px-3 py-1.5 rounded-xl flex items-center justify-between text-[11px]"
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.22)',
                  color: '#6ee7b7',
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                  <div className="truncate">
                    <span className="font-semibold text-emerald-300">
                      {config.userProfileContext.candidateName ? `${config.userProfileContext.candidateName} • ` : ''}
                      {config.userProfileContext.targetRole || config.userProfileContext.candidateTitle || 'Candidate'}
                    </span>
                    {config.userProfileContext.targetCompany && (
                      <span className="text-emerald-400/80"> @ {config.userProfileContext.targetCompany}</span>
                    )}
                    <span className="ml-1.5 px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-500/30 text-[9px] font-mono text-emerald-300">
                      Audience: {config.userProfileContext.audienceType}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={() => setIsContextModalOpen(true)}
                    className="text-[10px] font-semibold text-emerald-300 hover:text-white underline"
                  >
                    Edit Context
                  </button>
                  <button
                    onClick={async () => {
                      const updated = {
                        ...config,
                        userProfileContext: {
                          ...config.userProfileContext!,
                          enabled: false,
                        },
                      };
                      setConfig(updated);
                      if (window.ghostAPI) {
                        await window.ghostAPI.saveConfig(updated);
                      }
                      setQuickToast('Persona Context Paused');
                      setTimeout(() => setQuickToast(null), 2000);
                    }}
                    className="text-[10px] text-zinc-400 hover:text-red-300 transition-colors"
                    title="Pause persona context"
                  >
                    Pause
                  </button>
                </div>
              </div>
            )}

            {/* ── CHAT TAB ── */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {messages.length === 0 ? (
                    <EmptyState
                      onCapture={() => { setActiveTab('capture'); }}
                      onOpenSettings={() => setIsSettingsOpen(true)}
                      hasApiKey={hasApiKey}
                      provider={config.provider}
                    />
                  ) : (
                    messages.map((msg) => (
                      <MessageBubble key={msg.id} msg={msg} provider={config.provider} />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Bar */}
                <div className="shrink-0 p-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Live Voice Status Banners */}
                  {isListening && (
                    <div
                      className="flex items-center justify-between px-3 py-1.5 rounded-xl mb-2 text-xs transition-all animate-pulse"
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#fca5a5',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="font-semibold text-[11px]">🎙️ Listening to speaker... Speak now</span>
                      </div>
                      <button
                        onClick={stopListening}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold transition-all hover:bg-red-600/30 text-white flex items-center gap-1"
                        style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                      >
                        <span>Stop & Answer</span>
                        <kbd className="font-mono text-[9px] bg-red-950/80 px-1 rounded">F9</kbd>
                      </button>
                    </div>
                  )}

                  {isTranscribing && (
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl mb-2 text-xs transition-all"
                      style={{
                        background: 'rgba(249, 115, 22, 0.12)',
                        border: '1px solid rgba(249, 115, 22, 0.35)',
                        color: '#fdba74',
                      }}
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                      <span className="text-[11px] font-medium">⚡ Groq Whisper transcribing voice question...</span>
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <button
                      onClick={() => { setActiveTab('capture'); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                      title="Screen Capture & Vision Analysis [Alt+S or Ctrl+Shift+S]"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Capture Screen</span>
                      <kbd className="font-mono text-[9px] bg-blue-950/60 px-1 rounded opacity-70">Alt+S</kbd>
                    </button>

                    {/* Push-to-Listen (User Microphone) */}
                    <button
                      onClick={toggleListening}
                      disabled={isStreaming || isTranscribing}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${isListening
                        ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm'
                        : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:text-white hover:border-zinc-500'
                        }`}
                      title="Push to Listen (Microphone Dictation) [Alt+L or F9]"
                    >
                      {isListening ? (
                        <>
                          <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                          <span>Mic: Recording...</span>
                          <kbd className="font-mono text-[9px] bg-red-950/60 px-1 rounded opacity-80">F9</kbd>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3 text-emerald-400" />
                          <span>Mic: Dictate</span>
                          <kbd className="font-mono text-[9px] bg-zinc-700/50 px-1 rounded opacity-70">Alt+L</kbd>
                        </>
                      )}
                    </button>

                    {/* Meeting Audio Loopback (Rust WASAPI / Speakers) */}
                    <button
                      onClick={toggleMeetingAudio}
                      disabled={isStreaming}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${isMeetingListening
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm animate-pulse'
                        : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:text-white hover:border-cyan-500/50'
                        }`}
                      title="Sync Meeting Audio (Interviewer loopback via WASAPI) [Alt+M or Ctrl+Shift+M]"
                    >
                      <Headphones className={`w-3 h-3 ${isMeetingListening ? 'text-cyan-400' : 'text-cyan-500'}`} />
                      <span>{isMeetingListening ? 'Meeting: Listening' : 'Sync Meeting'}</span>
                      <kbd className="font-mono text-[9px] bg-cyan-950/60 px-1 rounded opacity-70">Alt+M</kbd>
                    </button>

                    {messageCount > 0 && !isStreaming && (
                      <button
                        onClick={handleClearMessages}
                        className="p-1 rounded-lg transition-colors ml-auto flex items-center gap-1"
                        style={{ color: 'rgba(239,68,68,0.6)' }}
                        title="Clear conversation [Ctrl+K]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-mono opacity-50">^K</span>
                      </button>
                    )}
                  </div>

                  {/* ── Natively Meeting Quick Action Pills ── */}
                  <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                    <button
                      onClick={handleWhatToAnswer}
                      disabled={isStreaming}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 disabled:opacity-40"
                      title="Analyze recent meeting audio and suggest best answer [Alt+W]"
                    >
                      <span>🎯</span>
                      <span>What to answer?</span>
                      <kbd className="font-mono text-[8px] bg-blue-950/40 px-1 rounded opacity-70">Alt+W</kbd>
                    </button>
                    <button
                      onClick={handleRecapMeeting}
                      disabled={isStreaming}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40"
                      title="Summarize key points from meeting transcript [Alt+R]"
                    >
                      <span>📋</span>
                      <span>Recap</span>
                      <kbd className="font-mono text-[8px] bg-emerald-950/40 px-1 rounded opacity-70">Alt+R</kbd>
                    </button>
                    <button
                      onClick={handleFollowUp}
                      disabled={isStreaming}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40"
                      title="Suggest 3 smart follow-up questions [Alt+F]"
                    >
                      <span>💡</span>
                      <span>Follow Up</span>
                      <kbd className="font-mono text-[8px] bg-amber-950/40 px-1 rounded opacity-70">Alt+F</kbd>
                    </button>
                    <button
                      onClick={handleShorten}
                      disabled={isStreaming}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 disabled:opacity-40"
                      title="Condense previous answer into bullet points [Alt+K]"
                    >
                      <span>✂️</span>
                      <span>Shorten</span>
                      <kbd className="font-mono text-[8px] bg-purple-950/40 px-1 rounded opacity-70">Alt+K</kbd>
                    </button>
                    {meetingTranscripts.length > 0 && (
                      <button
                        onClick={() => setShowTranscriptDrawer(!showTranscriptDrawer)}
                        className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ml-auto ${showTranscriptDrawer
                          ? 'bg-zinc-700 text-white'
                          : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
                          }`}
                        title="Toggle Live Meeting Transcript Feed [Alt+T]"
                      >
                        <ListOrdered className="w-2.5 h-2.5" />
                        <span>Transcript ({meetingTranscripts.length})</span>
                        <kbd className="font-mono text-[8px] bg-zinc-800 px-1 rounded opacity-70">Alt+T</kbd>
                      </button>
                    )}
                  </div>

                  {/* ── Meeting Transcript Live Drawer ── */}
                  {showTranscriptDrawer && meetingTranscripts.length > 0 && (
                    <div
                      className="rounded-xl p-2.5 mb-2 text-xs space-y-1.5 max-h-36 overflow-y-auto transition-all"
                      style={{
                        background: 'rgba(24, 24, 27, 0.95)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        scrollbarWidth: 'thin',
                      }}
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                        <span className="text-[10px] font-semibold text-cyan-400 flex items-center gap-1">
                          <Volume2 className="w-3 h-3" /> Live Meeting Audio Feed
                        </span>
                        <button
                          onClick={clearMeetingTranscripts}
                          className="text-[9px] text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                      {meetingTranscripts.slice(-8).map((t) => (
                        <div key={t.id} className="text-[11px] leading-relaxed flex gap-1.5">
                          <span className={`font-semibold shrink-0 ${t.speaker === 'meeting' ? 'text-cyan-400' : 'text-emerald-400'}`}>
                            {t.speaker === 'meeting' ? '🔊 Speaker:' : '🎙️ You:'}
                          </span>
                          <span className="text-zinc-200">{t.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputPrompt}
                      onChange={(e) => setInputPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={
                        isListening
                          ? 'Listening to spoken words...'
                          : hasApiKey
                            ? 'Ask anything or press F9 to speak...'
                            : 'Set API key in Settings first...'
                      }
                      disabled={isStreaming || !hasApiKey || isListening}
                      className="flex-1 bg-transparent text-xs outline-none px-1"
                      style={{ color: 'rgba(255,255,255,0.85)', caretColor: '#3b82f6' }}
                    />

                    {/* Microphone Push-to-Listen Icon Button */}
                    <button
                      onClick={toggleListening}
                      disabled={isStreaming || isTranscribing}
                      className={`p-1.5 rounded-lg transition-all ${isListening
                        ? 'bg-red-500/25 text-red-300 border border-red-500/40 shadow-sm'
                        : 'hover:bg-white/10 text-zinc-400 hover:text-white'
                        }`}
                      title={isListening ? 'Stop listening & send (F9)' : 'Push to Listen [F9 or Ctrl+Shift+L]'}
                    >
                      {isListening ? (
                        <MicOff className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {isStreaming ? (
                      <button
                        onClick={handleStopStream}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                        title="Stop generation"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputPrompt.trim() || !hasApiKey}
                        className="p-1.5 rounded-lg transition-all disabled:pointer-events-none"
                        style={{
                          background: inputPrompt.trim() && hasApiKey ? '#2563eb' : 'rgba(255,255,255,0.06)',
                          color: inputPrompt.trim() && hasApiKey ? 'white' : 'rgba(255,255,255,0.2)',
                        }}
                        title="Send (Enter)"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── SCREEN CAPTURE TAB ── */}
            {activeTab === 'capture' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-3 py-3 space-y-3"
                style={{ scrollbarWidth: 'none' }}
              >
                {/* Ghost Shield Status Card */}
                <div
                  className="rounded-xl p-3.5"
                  style={{
                    background: isGhostActive ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
                    border: `1px solid ${isGhostActive ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    {isGhostActive ? (
                      <Shield className="w-4 h-4" style={{ color: '#34d399' }} />
                    ) : (
                      <ShieldOff className="w-4 h-4" style={{ color: '#fbbf24' }} />
                    )}
                    <div>
                      <div className="text-[12px] font-semibold text-emerald-400">
                        🛡️ Ghost Shield Locked ON
                      </div>
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Permanently locked ON to eliminate any risk of accidental screen leaks during interviews. Window is 100% invisible in Zoom, Meet, Teams, OBS & Discord screen share.
                      </div>
                    </div>
                    <div
                      className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-default select-none"
                      style={{
                        background: 'rgba(16,185,129,0.15)',
                        color: '#34d399',
                        border: '1px solid rgba(16,185,129,0.3)',
                      }}
                    >
                      Locked ON ✓
                    </div>
                  </div>
                  <div
                    className="text-[10px] font-mono px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.35)' }}
                  >
                    Works via Windows/macOS OS-level display affinity API — not detectable by any app
                  </div>
                </div>

                {/* Quick Capture Prompts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Quick Capture</span>
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>Ctrl+Shift+S</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_PROMPTS.map((qp) => (
                      <button
                        key={qp.label}
                        onClick={() => handleCaptureAndAnalyze(qp.prompt)}
                        disabled={isStreaming || !hasApiKey}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all duration-150 active:scale-95 disabled:opacity-40"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          color: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        <span className="text-base leading-none">{qp.icon}</span>
                        <div>
                          <div className="text-[11px] font-semibold">{qp.label}</div>
                          <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {qp.prompt.slice(0, 32)}...
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Prompt Capture */}
                <div>
                  <div className="text-[11px] font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Custom Prompt + Capture</div>
                  <div
                    className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <input
                      ref={captureInputRef}
                      type="text"
                      value={capturePrompt}
                      onChange={(e) => setCapturePrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCaptureAndAnalyze();
                      }}
                      placeholder="e.g. Find the bug in this code..."
                      disabled={isStreaming || !hasApiKey}
                      className="flex-1 bg-transparent text-xs outline-none"
                      style={{ color: 'rgba(255,255,255,0.8)', caretColor: '#3b82f6' }}
                    />
                    <button
                      onClick={() => handleCaptureAndAnalyze()}
                      disabled={isStreaming || !hasApiKey}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-40"
                      style={{ background: '#2563eb', color: 'white' }}
                    >
                      {captureStatus === 'capturing' ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /><span>Capturing</span></>
                      ) : captureStatus === 'analyzing' ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /><span>Analyzing</span></>
                      ) : (
                        <><Camera className="w-3 h-3" /><span>Capture</span></>
                      )}
                    </button>
                  </div>
                </div>

                {/* Recent screenshots / results teaser */}
                {messages.filter((m) => m.screenshotPreview).length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Recent Captures</div>
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {messages.filter((m) => m.screenshotPreview).slice(-4).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setActiveTab('chat'); }}
                          className="shrink-0 rounded-lg overflow-hidden border transition-all hover:opacity-80"
                          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                          title="Click to view in chat"
                        >
                          <img
                            src={m.screenshotPreview}
                            alt="Capture"
                            className="w-20 h-12 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsed Bar */}
        {isCollapsed && (
          <div className="flex items-center justify-center h-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="flex items-center gap-1.5 text-[10px] transition-all"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* â”€â”€ Settings Modal â”€â”€ */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        setConfig={setConfig}
        onSave={handleSaveConfig}
        saveSuccess={saveSuccess}
        onOpenContextModal={() => setIsContextModalOpen(true)}
        audioDevices={audioDevices}
        selectedOutputDevice={selectedOutputDevice}
        setSelectedOutputDevice={setSelectedOutputDevice}
        testStatus={testStatus}
        onTestKey={handleTestKey}
      />
      {/* ── Interview Persona & JD Context Modal ── */}
      <InterviewContextModal
        isOpen={isContextModalOpen}
        onClose={() => setIsContextModalOpen(false)}
        context={config.userProfileContext || DEFAULT_USER_PROFILE_CONTEXT}
        onSave={handleSaveUserProfileContext}
      />
    </div>
  );
};

export default App;
