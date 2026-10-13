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
} from 'lucide-react';
import { MarkdownRenderer } from './components/MarkdownRenderer';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  screenshotPreview?: string;
  timestamp: number;
  isError?: boolean;
}

interface AppConfig {
  provider: 'gemini' | 'groq' | 'openrouter' | 'router';
  geminiApiKey: string;
  groqApiKey: string;
  openrouterApiKey: string;
  openrouterModel: string;
  routerPreset: string;
  routerBaseUrl: string;
  routerApiKey: string;
  routerModel: string;
  systemInstruction: string;
  model: string;
  groqModel: string;
  temperature: number;
  autoFallback: boolean;
  selectedAudioOutputDevice?: string;
}

type ActiveTab = 'chat' | 'capture';
type AssistantMode = 'general' | 'interview' | 'coding' | 'meeting';

const ASSISTANT_MODES: Array<{ id: AssistantMode; label: string; icon: string; prompt: string }> = [
  { id: 'general', label: 'General', icon: '⚡', prompt: 'Provide a concise, direct, accurate answer without unnecessary filler.' },
  { id: 'interview', label: 'Interview', icon: '💼', prompt: 'Structure your response using the STAR method (Situation, Task, Action, Result) or crisp conversational bullet points that are natural to speak aloud in an interview.' },
  { id: 'coding', label: 'LeetCode / Code', icon: '💻', prompt: 'Identify the problem, provide optimal Time & Space Complexity, give concise intuition, and output clean, fully correct, idiomatic code.' },
  { id: 'meeting', label: 'Meeting Notes', icon: '📝', prompt: 'Extract executive summary, key decisions, action items, and objections handling in structured bullets.' },
];

const QUICK_PROMPTS = [
  { label: 'Solve', icon: '🎯', prompt: 'Analyze this screen. If there is a question, problem, or code error, provide the immediate correct solution. Be concise and direct.' },
  { label: 'Explain', icon: '💡', prompt: 'Explain what is on this screen in simple terms. Break it down step by step.' },
  { label: 'Debug Code', icon: '🐛', prompt: 'Find and fix any bugs or errors in the code shown on screen. Show corrected code with brief explanations.' },
  { label: 'Summarize', icon: '📝', prompt: 'Summarize the key information on this screen in bullet points.' },
];

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
  });

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
    };
  }, []);

  // Emergency Escape / Panic & Push-to-Listen key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l')) {
        e.preventDefault();
        toggleListeningRef.current();
        return;
      }
      if (e.key === 'Escape') {
        if (isListening) {
          stopListening();
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (showShortcuts) {
          setShowShortcuts(false);
        } else if (window.ghostAPI) {
          window.ghostAPI.minimizeWindow();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, showShortcuts, isListening]);

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
        window.ghostAPI.setWindowHeight(600);
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
    executePrompt(`Based on this live meeting conversation:\n\n${recent}\n\nWhat is the best, most direct, and impressive answer to what was just asked or discussed? Give me the answer formatted concisely to speak aloud.`);
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
    executePrompt(`Please provide a concise executive summary, key decisions, and action items from this meeting conversation transcript:\n\n${fullTranscript}`);
  };

  const handleFollowUp = async () => {
    const rolling = await window.ghostAPI.getRollingTranscript?.();
    const sourceList = (rolling && rolling.length > 0) ? rolling : meetingTranscripts;
    const context = sourceList && sourceList.length > 0
      ? sourceList.slice(-8).map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`).join('\n')
      : messages.slice(-4).map((m) => `${m.role}: ${m.text}`).join('\n');
    executePrompt(`Based on this ongoing discussion:\n\n${context}\n\nSuggest 3 sharp, strategic follow-up questions I can ask right now to steer the conversation effectively.`);
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

  // Keep toggleListeningRef updated for hotkeys
  useEffect(() => {
    toggleListeningRef.current = toggleListening;
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
        const finalPrompt = assistantMode !== 'general' && activeModeObj
          ? `[Mode Instruction: ${activeModeObj.prompt}]\n\n${basePrompt}`
          : basePrompt;

        await window.ghostAPI.captureAndAnalyze(finalPrompt);
      } catch (err: any) {
        setIsStreaming(false);
        setCaptureStatus('idle');
      }
    },
    [isStreaming, config.provider, config.geminiApiKey, config.groqApiKey, config.openrouterApiKey, config.routerPreset, config.routerBaseUrl, capturePrompt, assistantMode]
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
    if (window.ghostAPI) {
      const active = await window.ghostAPI.toggleGhostMode();
      setIsGhostActive(active);
    }
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
      <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden transition-all duration-200"
        style={{
          background: 'rgba(10, 11, 16, 0.96)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.9), 0 0 0 0.5px rgba(255,255,255,0.05)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* ── Top Bar / Drag Handle ── */}
        <div
          className="titlebar-drag-region shrink-0 h-12 px-3 flex items-center justify-between border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)', position: 'relative', zIndex: 10 }}
          onMouseEnter={() => { if (isClickThrough) window.ghostAPI?.setIgnoreMouseEvents(false); }}
          onMouseLeave={() => { if (isClickThrough) window.ghostAPI?.setIgnoreMouseEvents(true, { forward: true }); }}
        >
          {/* Left: Ghost Status Badge */}
          <div className="flex items-center gap-2 no-drag">
            <button
              onClick={handleToggleGhostMode}
              title={isGhostActive ? 'Ghost Shield Active — invisible in Zoom, Meet, OBS, Discord' : 'Ghost Mode Disabled — click to re-enable'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200"
              style={{
                background: isGhostActive ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${isGhostActive ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                color: isGhostActive ? '#34d399' : '#fbbf24',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: isGhostActive ? '#34d399' : '#fbbf24',
                  animation: isGhostActive ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
                }}
              />
              {isGhostActive ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
              <span>{isGhostActive ? 'Ghost Shield' : 'Visible'}</span>
            </button>

            {/* Click-Through Mode Toggle */}
            <button
              onClick={handleToggleClickThrough}
              title={isClickThrough ? 'Click-Through ON — mouse clicks pass through to window behind (Ctrl+Shift+X)' : 'Enable Click-Through pass-through (Ctrl+Shift+X)'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200"
              style={{
                background: isClickThrough ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isClickThrough ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: isClickThrough ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
              }}
            >
              <MousePointer className="w-3 h-3" />
              <span>{isClickThrough ? 'Pass-Thru ON' : 'Click-Thru'}</span>
            </button>

            {/* Model tag button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Current AI Model & Provider (Click to open Settings)"
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full transition-all hover:scale-105"
              style={{
                background:
                  config.provider === 'groq'
                    ? 'rgba(249, 115, 22, 0.15)'
                    : config.provider === 'openrouter'
                      ? 'rgba(168, 85, 247, 0.15)'
                      : config.provider === 'router'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(59, 130, 246, 0.15)',
                color:
                  config.provider === 'groq'
                    ? '#fdba74'
                    : config.provider === 'openrouter'
                      ? '#d8b4fe'
                      : config.provider === 'router'
                        ? '#6ee7b7'
                        : '#93c5fd',
                border:
                  config.provider === 'groq'
                    ? '1px solid rgba(249, 115, 22, 0.35)'
                    : config.provider === 'openrouter'
                      ? '1px solid rgba(168, 85, 247, 0.35)'
                      : config.provider === 'router'
                        ? '1px solid rgba(16, 185, 129, 0.35)'
                        : '1px solid rgba(59, 130, 246, 0.35)',
              }}
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>
                {config.provider === 'groq'
                  ? `groq:${config.groqModel.split('-')[0]}`
                  : config.provider === 'openrouter'
                    ? `openrouter:${config.openrouterModel.replace(':free', '').split('/').pop()?.slice(0, 10)}`
                    : config.provider === 'router'
                      ? `router:${config.routerPreset || 'custom'}`
                      : config.model.split('-').slice(0, 2).join('-')}
              </span>
            </button>
          </div>

          {/* Center: Drag grip visual */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
            <GripHorizontal className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.12)' }} />
          </div>

          {/* Right: Window Controls */}
          <div className="flex items-center gap-0.5 no-drag">
            <button
              onClick={() => setShowShortcuts((v) => !v)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              title="Keyboard shortcuts"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              title="Settings & API Key"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              title={isCollapsed ? 'Expand' : 'Collapse to mini bar'}
            >
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => window.ghostAPI?.minimizeWindow()}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              title="Hide Overlay (Ctrl+\ to restore)"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => window.ghostAPI?.closeWindow()}
              className="p-1.5 rounded-lg transition-colors ml-1"
              style={{ color: 'rgba(239,68,68,0.5)' }}
              title="Quit App"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

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
              <span><strong>Click-Through Active</strong> — Clicks pass to apps behind. Press <kbd className="px-1 py-0.2 rounded font-mono text-[10px]" style={{ background: 'rgba(99,102,241,0.35)', border: '1px solid rgba(99,102,241,0.5)' }}>Ctrl+Shift+X</kbd> to interact.</span>
            </div>
            <button
              onClick={handleToggleClickThrough}
              className="px-2 py-0.5 rounded text-[10px] font-medium transition-all"
              style={{ background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.45)' }}
            >
              Disable
            </button>
          </div>
        )}

        {/* ── Keyboard Shortcuts Panel ── */}
        {showShortcuts && !isCollapsed && (
          <div
            className="shrink-0 px-4 py-3 border-b text-[11px]"
            style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.5)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>Keyboard Shortcuts</span>
              <button onClick={() => setShowShortcuts(false)} style={{ color: 'rgba(255,255,255,0.3)' }}><X className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                ['Ctrl+\\', 'Toggle show/hide'],
                ['Ctrl+Shift+S', 'Capture & analyze screen'],
                ['F9 / Ctrl+Shift+L', 'Push-to-Listen (Voice STT)'],
                ['Ctrl+Shift+X', 'Toggle Click-Through mode'],
                ['Ctrl+Shift+H', 'Stealth Panic Hide'],
                ['Esc', 'Instant hide overlay'],
                ['Enter', 'Send chat message'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>{key}</kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
                { id: 'chat' as const, label: 'Chat', icon: MessageSquare, badge: messageCount > 0 ? messageCount : null },
                { id: 'capture' as const, label: 'Screen AI', icon: ScanLine },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-all duration-150"
                  style={{
                    background: activeTab === tab.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: activeTab === tab.id ? '#60a5fa' : 'rgba(255,255,255,0.35)',
                    border: activeTab === tab.id ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                  }}
                >
                  <tab.icon className="w-3 h-3" />
                  <span>{tab.label}</span>
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
                      title="Export Session as Markdown"
                    >
                      <Download className="w-2.5 h-2.5" />
                      <span>Export</span>
                    </button>
                    <button
                      onClick={handleClearMessages}
                      className="p-1 rounded text-white/30 hover:text-red-400 transition-colors"
                      title="Clear Session Messages"
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
              {exportNotice && (
                <span className="text-[10px] text-emerald-400 font-medium">{exportNotice}</span>
              )}
            </div>

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
                      title="Go to Screen Capture tab"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Capture Screen</span>
                      <span className="opacity-60 font-mono">Ctrl+⇧+S</span>
                    </button>

                    {/* Push-to-Listen (User Microphone) */}
                    <button
                      onClick={toggleListening}
                      disabled={isStreaming || isTranscribing}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${isListening
                        ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm'
                        : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:text-white hover:border-zinc-500'
                        }`}
                      title="Push to Listen (Your Microphone) [F9 or Ctrl+Shift+L]"
                    >
                      {isListening ? (
                        <>
                          <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                          <span>Mic: Recording...</span>
                          <span className="opacity-70 font-mono text-[9px] bg-red-950/60 px-1 rounded">F9</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3 text-emerald-400" />
                          <span>Mic: Dictate</span>
                          <span className="opacity-60 font-mono text-[9px] bg-zinc-700/50 px-1 rounded">F9</span>
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
                      title="Sync Meeting Audio (Captures Interviewer / Speaker Output via Rust WASAPI)"
                    >
                      <Headphones className={`w-3 h-3 ${isMeetingListening ? 'text-cyan-400' : 'text-cyan-500'}`} />
                      <span>{isMeetingListening ? 'Meeting: Listening' : 'Sync Meeting'}</span>
                    </button>

                    {messageCount > 0 && !isStreaming && (
                      <button
                        onClick={handleClearMessages}
                        className="p-1 rounded-lg transition-colors ml-auto"
                        style={{ color: 'rgba(239,68,68,0.4)' }}
                        title="Clear conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* ── Natively Meeting Quick Action Pills ── */}
                  <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                    <button
                      onClick={handleWhatToAnswer}
                      disabled={isStreaming}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 disabled:opacity-40"
                      title="Analyze recent meeting audio and suggest the best response"
                    >
                      <span>🎯</span>
                      <span>What to answer?</span>
                    </button>
                    <button
                      onClick={handleRecapMeeting}
                      disabled={isStreaming}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40"
                      title="Summarize key points from meeting transcript"
                    >
                      <span>📋</span>
                      <span>Recap</span>
                    </button>
                    <button
                      onClick={handleFollowUp}
                      disabled={isStreaming}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40"
                      title="Suggest 3 smart follow-up questions"
                    >
                      <span>💡</span>
                      <span>Follow Up</span>
                    </button>
                    <button
                      onClick={handleShorten}
                      disabled={isStreaming}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 disabled:opacity-40"
                      title="Condense previous answer into speakable bullet points"
                    >
                      <span>✂️</span>
                      <span>Shorten</span>
                    </button>
                    {meetingTranscripts.length > 0 && (
                      <button
                        onClick={() => setShowTranscriptDrawer(!showTranscriptDrawer)}
                        className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ml-auto ${showTranscriptDrawer
                          ? 'bg-zinc-700 text-white'
                          : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
                          }`}
                      >
                        <ListOrdered className="w-2.5 h-2.5" />
                        <span>Transcript ({meetingTranscripts.length})</span>
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
                      <div className="text-[12px] font-semibold" style={{ color: isGhostActive ? '#34d399' : '#fbbf24' }}>
                        {isGhostActive ? '🛡️ True Ghost Mode Active' : '⚠️ Ghost Mode Disabled'}
                      </div>
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {isGhostActive
                          ? 'This window is 100% invisible in Zoom, Meet, Teams, OBS & Discord screen share'
                          : 'This window is currently visible on screen share. Click Ghost Shield to re-enable.'}
                      </div>
                    </div>
                    <button
                      onClick={handleToggleGhostMode}
                      className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                      style={{
                        background: isGhostActive ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: isGhostActive ? '#34d399' : '#fbbf24',
                        border: `1px solid ${isGhostActive ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                      }}
                    >
                      {isGhostActive ? 'Disable' : 'Enable'}
                    </button>
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

      {/* ── Settings Modal ── */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 px-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsSettingsOpen(false); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(14,15,20,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.9)',
              maxHeight: '90vh',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'white' }}>
                <Settings className="w-4 h-4" style={{ color: '#3b82f6' }} />
                Settings
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} style={{ color: 'rgba(255,255,255,0.4)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Switcher */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>AI Cloud Provider & Router</label>
              <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, provider: 'gemini' })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center ${config.provider === 'gemini'
                    ? 'bg-blue-600 text-white shadow font-semibold'
                    : 'text-white/40 hover:text-white/70'
                    }`}
                >
                  Google Gemini
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, provider: 'groq' })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center ${config.provider === 'groq'
                    ? 'bg-orange-600 text-white shadow font-semibold'
                    : 'text-white/40 hover:text-white/70'
                    }`}
                >
                  Groq Cloud ⚡
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, provider: 'openrouter' })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center ${config.provider === 'openrouter'
                    ? 'bg-purple-600 text-white shadow font-semibold'
                    : 'text-white/40 hover:text-white/70'
                    }`}
                >
                  OpenRouter 🌐 (Free)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, provider: 'router' })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center ${config.provider === 'router'
                    ? 'bg-emerald-600 text-white shadow font-semibold'
                    : 'text-white/40 hover:text-white/70'
                    }`}
                >
                  Free Router 🔀
                </button>
              </div>
            </div>

            {/* Provider-specific Key & Model */}
            {config.provider === 'gemini' && (
              <>
                {/* Gemini API Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Google Gemini API Key
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] flex items-center gap-0.5 hover:underline"
                      style={{ color: '#60a5fa' }}
                    >
                      Get free key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={config.geminiApiKey}
                    onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                    }}
                  />
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      onClick={() => handleTestKey('gemini')}
                      disabled={!config.geminiApiKey.trim() || testStatus?.testing}
                      className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {testStatus?.testing ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Testing...</span>
                      ) : 'Test Connection'}
                    </button>
                    {testStatus?.success === true && (
                      <span className="text-[11px] flex items-center gap-1" style={{ color: '#34d399' }}>
                        <Check className="w-3 h-3" /> Valid Gemini Key
                      </span>
                    )}
                    {testStatus?.success === false && (
                      <span className="text-[11px] max-w-[200px] truncate" style={{ color: '#f87171' }} title={testStatus.error || 'Connection failed'}>
                        {testStatus.error || 'Connection failed'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Gemini Model Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold" style={{ color: '#f4f4f5' }}>Gemini Model</label>
                    <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: '#34d399' }} title="Automatic multi-model fallback on rate limits or outages">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Fault-Tolerant
                    </span>
                  </div>
                  <select
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    className="w-full rounded-xl px-3 py-2.5 text-xs font-medium outline-none cursor-pointer border border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:border-zinc-500 focus:border-blue-500 shadow-md transition-colors"
                    style={{
                      backgroundColor: '#18181b',
                      color: '#f4f4f5',
                      colorScheme: 'dark',
                    }}
                  >
                    <option value="gemini-3.8-flash" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>gemini-3.8-flash — Flagship Intelligence & Vision ⚡ (Free)</option>
                    <option value="gemini-3.5-flash-lite" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>gemini-3.5-flash-lite — Ultra Fast & Lightweight 🚀 (Free)</option>
                    <option value="gemini-3.7-flash" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>gemini-3.7-flash — Fast Coding & Agents (Free)</option>
                    <option value="gemini-3.6-flash" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>gemini-3.6-flash — Balanced Multimodal (Free)</option>
                  </select>
                </div>
              </>
            )}

            {config.provider === 'groq' && (
              <>
                {/* Groq API Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Groq API Key
                    </label>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] flex items-center gap-0.5 hover:underline"
                      style={{ color: '#fb923c' }}
                    >
                      Get free Groq key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={config.groqApiKey}
                    onChange={(e) => setConfig({ ...config, groqApiKey: e.target.value })}
                    placeholder="gsk_..."
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                    }}
                  />
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      onClick={() => handleTestKey('groq')}
                      disabled={!config.groqApiKey.trim() || testStatus?.testing}
                      className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {testStatus?.testing ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Testing...</span>
                      ) : 'Test Connection'}
                    </button>
                    {testStatus?.success === true && (
                      <span className="text-[11px] flex items-center gap-1" style={{ color: '#34d399' }}>
                        <Check className="w-3 h-3" /> Valid Groq Key
                      </span>
                    )}
                    {testStatus?.success === false && (
                      <span className="text-[11px] max-w-[200px] truncate" style={{ color: '#f87171' }} title={testStatus.error || 'Connection failed'}>
                        {testStatus.error || 'Connection failed'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Groq Model Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold" style={{ color: '#f4f4f5' }}>Groq Model</label>
                    <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: '#34d399' }} title="Automatic multi-model fallback on rate limits or outages">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Fault-Tolerant
                    </span>
                  </div>
                  <select
                    value={config.groqModel}
                    onChange={(e) => setConfig({ ...config, groqModel: e.target.value })}
                    className="w-full rounded-xl px-3 py-2.5 text-xs font-medium outline-none cursor-pointer border border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:border-zinc-500 focus:border-orange-500 shadow-md transition-colors"
                    style={{
                      backgroundColor: '#18181b',
                      color: '#f4f4f5',
                      colorScheme: 'dark',
                    }}
                  >
                    <option value="llama-3.3-70b-versatile" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>llama-3.3-70b-versatile — Flagship Reasoning & Coding (280 tok/s) ⚡</option>
                    <option value="llama-3.1-8b-instant" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>llama-3.1-8b-instant — Ultra-Fast Lightweight Model (~560 tok/s) ⚡</option>
                    <option value="deepseek-r1-distill-qwen-32b" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>deepseek-r1-distill-qwen-32b — Deep Reasoning, Math & Logic (320 tok/s) 🧠</option>
                    <option value="qwen-2.5-coder-32b" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>qwen-2.5-coder-32b — Specialized Code Synthesis & Debugging 💻</option>
                    <option value="gemma2-9b-it" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>gemma2-9b-it — Google Gemma 2 on Groq Hardware 🌐</option>
                  </select>
                </div>
              </>
            )}

            {config.provider === 'openrouter' && (
              <>
                {/* OpenRouter API Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      OpenRouter API Key
                    </label>
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] flex items-center gap-0.5 hover:underline"
                      style={{ color: '#c084fc' }}
                    >
                      Get free key (free models daily) <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={config.openrouterApiKey}
                    onChange={(e) => setConfig({ ...config, openrouterApiKey: e.target.value })}
                    placeholder="sk-or-v1-..."
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                    }}
                  />
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      onClick={() => handleTestKey('openrouter')}
                      disabled={!config.openrouterApiKey.trim() || testStatus?.testing}
                      className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {testStatus?.testing ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Testing...</span>
                      ) : 'Test Connection'}
                    </button>
                    {testStatus?.success === true && (
                      <span className="text-[11px] flex items-center gap-1" style={{ color: '#34d399' }}>
                        <Check className="w-3 h-3" /> Valid OpenRouter Key
                      </span>
                    )}
                    {testStatus?.success === false && (
                      <span className="text-[11px] max-w-[200px] truncate" style={{ color: '#f87171' }} title={testStatus.error || 'Connection failed'}>
                        {testStatus.error || 'Connection failed'}
                      </span>
                    )}
                  </div>
                </div>

                {/* OpenRouter Model Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold" style={{ color: '#f4f4f5' }}>OpenRouter Free Model</label>
                    <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: '#c084fc' }} title="Rotating catalog of $0.00 free models">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                      Free Tokens
                    </span>
                  </div>
                  <select
                    value={config.openrouterModel}
                    onChange={(e) => setConfig({ ...config, openrouterModel: e.target.value })}
                    className="w-full rounded-xl px-3 py-2.5 text-xs font-medium outline-none cursor-pointer border border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:border-zinc-500 focus:border-purple-500 shadow-md transition-colors"
                    style={{
                      backgroundColor: '#18181b',
                      color: '#f4f4f5',
                      colorScheme: 'dark',
                    }}
                  >
                    <option value="openrouter/free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>openrouter/free — Smart Free Auto-Router 🔀 (Auto-Selects Healthy Free Model)</option>
                    <option value="google/gemini-2.0-flash-exp:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>google/gemini-2.0-flash-exp:free — Multimodal Screen Vision & 1M Context 👁️ (Free)</option>
                    <option value="meta-llama/llama-3.3-70b-instruct:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>meta-llama/llama-3.3-70b-instruct:free — Meta Flagship 70B Reasoning ⚡ (Free)</option>
                    <option value="deepseek/deepseek-r1:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>deepseek/deepseek-r1:free — SOTA Math & Logic Reasoning 🧠 (Free)</option>
                    <option value="qwen/qwen-2.5-coder-32b-instruct:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>qwen/qwen-2.5-coder-32b-instruct:free — Code Specialist & Architecture 💻 (Free)</option>
                    <option value="mistralai/mistral-7b-instruct:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>mistralai/mistral-7b-instruct:free — Ultra-Fast Low Latency 🚀 (Free)</option>
                    <option value="deepseek/deepseek-chat:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>deepseek/deepseek-chat:free — DeepSeek V3 General Chat 🌐 (Free)</option>
                    <option value="google/gemini-2.0-pro-exp-02-05:free" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>google/gemini-2.0-pro-exp-02-05:free — Pro Research & Multimodal 🔬 (Free)</option>
                  </select>
                </div>

                {/* Free Tier Info Badge */}
                <div
                  className="p-2.5 rounded-xl text-[11px] leading-relaxed"
                  style={{ background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.2)', color: '#d8b4fe' }}
                >
                  <strong>🎁 100% Free OpenRouter Models:</strong> Models with <code className="text-[10px] bg-purple-900/40 px-1 py-0.5 rounded">:free</code> suffix cost $0.00 per token. Ghost Copilot automatically fails over across candidate free models if any model is rate-limited.
                </div>
              </>
            )}

            {config.provider === 'router' && (
              <>
                {/* Preset Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#f4f4f5' }}>Router Preset</label>
                  <select
                    value={config.routerPreset}
                    onChange={(e) => {
                      const presetId = e.target.value;
                      if (presetId === 'pollinations') {
                        setConfig({
                          ...config,
                          routerPreset: 'pollinations',
                          routerBaseUrl: 'https://text.pollinations.ai/openai',
                          routerModel: 'openai',
                        });
                      } else if (presetId === 'cerebras') {
                        setConfig({
                          ...config,
                          routerPreset: 'cerebras',
                          routerBaseUrl: 'https://api.cerebras.ai/v1',
                          routerModel: 'llama-3.3-70b',
                        });
                      } else if (presetId === 'ollama') {
                        setConfig({
                          ...config,
                          routerPreset: 'ollama',
                          routerBaseUrl: 'http://localhost:11434/v1',
                          routerModel: 'llama3.2',
                        });
                      } else if (presetId === 'deepinfra') {
                        setConfig({
                          ...config,
                          routerPreset: 'deepinfra',
                          routerBaseUrl: 'https://api.deepinfra.com/v1/openai',
                          routerModel: 'meta-llama/Llama-3.3-70B-Instruct',
                        });
                      } else {
                        setConfig({
                          ...config,
                          routerPreset: 'custom',
                        });
                      }
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-xs font-medium outline-none cursor-pointer border border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:border-zinc-500 focus:border-emerald-500 shadow-md transition-colors"
                    style={{
                      backgroundColor: '#18181b',
                      color: '#f4f4f5',
                      colorScheme: 'dark',
                    }}
                  >
                    <option value="pollinations" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>Pollinations AI — 100% Free (No API Key Required! 🎁)</option>
                    <option value="cerebras" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>Cerebras Cloud — Ultra-Fast 2,000 tok/s Free Tier ⚡</option>
                    <option value="ollama" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>Ollama — Local Offline 100% Free 💻</option>
                    <option value="deepinfra" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>DeepInfra — Free Tier Open Weights 🌐</option>
                    <option value="custom" className="bg-zinc-900 text-zinc-100 py-2" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>Custom OpenAI-Compatible Router (LiteLLM, vLLM, etc.) 🔀</option>
                  </select>
                </div>

                {/* Router Base URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Router Endpoint (Base URL)</label>
                  <input
                    type="text"
                    value={config.routerBaseUrl}
                    onChange={(e) => setConfig({ ...config, routerBaseUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                    }}
                  />
                </div>

                {/* API Key (Optional for Pollinations and Ollama) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      API Key
                      {config.routerPreset === 'pollinations' || config.routerPreset === 'ollama' ? (
                        <span className="ml-1 text-[10px] text-emerald-400 font-normal">(Not required)</span>
                      ) : (
                        <span className="ml-1 text-[10px] text-white/30 font-normal">(if required by router)</span>
                      )}
                    </label>
                    {config.routerPreset === 'cerebras' && (
                      <a
                        href="https://cloud.cerebras.ai"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] flex items-center gap-0.5 hover:underline"
                        style={{ color: '#34d399' }}
                      >
                        Get free Cerebras key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <input
                    type="password"
                    value={config.routerApiKey}
                    onChange={(e) => setConfig({ ...config, routerApiKey: e.target.value })}
                    placeholder={
                      config.routerPreset === 'pollinations'
                        ? 'Not required for Pollinations AI'
                        : config.routerPreset === 'ollama'
                          ? 'Not required for local Ollama'
                          : 'csk-... or router token'
                    }
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                    }}
                  />
                </div>

                {/* Model Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Model Name</label>
                  <input
                    type="text"
                    value={config.routerModel}
                    onChange={(e) => setConfig({ ...config, routerModel: e.target.value })}
                    placeholder="e.g. openai, llama-3.3-70b, llama3.2"
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none font-mono transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                    }}
                  />
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      onClick={() => handleTestKey('router')}
                      disabled={testStatus?.testing}
                      className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {testStatus?.testing ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Testing...</span>
                      ) : 'Test Connection'}
                    </button>
                    {testStatus?.success === true && (
                      <span className="text-[11px] flex items-center gap-1" style={{ color: '#34d399' }}>
                        <Check className="w-3 h-3" /> Connected to Router
                      </span>
                    )}
                    {testStatus?.success === false && (
                      <span className="text-[11px] max-w-[200px] truncate" style={{ color: '#f87171' }} title={testStatus.error || 'Connection failed'}>
                        {testStatus.error || 'Connection failed'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Router Info Badge */}
                <div
                  className="p-2.5 rounded-xl text-[11px] leading-relaxed"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}
                >
                  {config.routerPreset === 'pollinations'
                    ? '🎁 Pollinations AI requires ZERO API key and gives 100% free unlimited tokens for text and code.'
                    : config.routerPreset === 'cerebras'
                      ? '⚡ Cerebras runs inference on Wafer-Scale chips at 2,000+ tokens/second with generous daily free tiers.'
                      : config.routerPreset === 'ollama'
                        ? '💻 Ollama runs 100% locally on your machine with total privacy and zero token cost.'
                        : '🔀 Any OpenAI-compatible router endpoint (LiteLLM, vLLM, Bifrost, DeepInfra) can be connected.'}
                </div>
              </>
            )}

            {/* Auto-Fallback Checkbox */}
            <div
              className="flex items-center gap-2 p-2.5 rounded-xl text-[11px]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
            >
              <input
                type="checkbox"
                id="autoFallbackCheck"
                checked={config.autoFallback}
                onChange={(e) => setConfig({ ...config, autoFallback: e.target.checked })}
                className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
              />
              <label htmlFor="autoFallbackCheck" className="cursor-pointer select-none">
                <strong>Smart Fallback:</strong> If primary provider hits rate limits or quota, auto-fallback seamlessly without failing.
              </label>
            </div>

            {/* System Instructions */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                System Instructions
                <span className="ml-1.5 font-normal text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>optional</span>
              </label>
              <textarea
                rows={3}
                value={config.systemInstruction}
                onChange={(e) => setConfig({ ...config, systemInstruction: e.target.value })}
                placeholder="e.g. You are a senior software engineer. Answer concisely..."
                className="w-full rounded-lg p-2.5 text-xs outline-none resize-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.8)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Temperature Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Temperature</label>
                <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{config.temperature ?? 0.7}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.temperature ?? 0.7}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full h-1 appearance-none rounded cursor-pointer"
                style={{ accentColor: '#3b82f6' }}
              />
            </div>

            {/* ── Audio Device Configuration (Rust Native Module) ── */}
            <div className="space-y-2 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#f4f4f5' }}>
                  <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                  Meeting Audio Output (Loopback)
                </label>
                <span className="text-[10px] font-mono text-cyan-400">Rust WASAPI</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Select the speaker or headphone device where you hear the interviewer or meeting participants:
              </p>
              <select
                value={selectedOutputDevice}
                onChange={(e) => setSelectedOutputDevice(e.target.value)}
                className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition-all cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                }}
              >
                <option value="" className="bg-zinc-900 text-white">Default Audio Output (Auto-detect)</option>
                {audioDevices.outputs.map((dev) => (
                  <option key={dev.id} value={dev.id} className="bg-zinc-900 text-white">
                    {dev.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Ghost Mode Info Box */}
            <div
              className="p-3 rounded-xl text-[11px] leading-relaxed"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', color: '#6ee7b7' }}
            >
              <strong>🛡️ True Ghost Display:</strong> This overlay uses OS-level hardware display affinity (Windows: <code className="text-[10px]">SetWindowDisplayAffinity</code>, macOS: <code className="text-[10px]">WDA_EXCLUDEFROMCAPTURE</code>). It is completely invisible to <strong>all</strong> screen capture software: Zoom, Google Meet, Microsoft Teams, OBS, Discord, and any recording tool.
            </div>

            {/* Save */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                style={{ background: '#2563eb', color: 'white' }}
              >
                {saveSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{saveSuccess ? 'Saved!' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──

const EmptyState: React.FC<{
  onCapture: () => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
  provider: 'gemini' | 'groq' | 'openrouter' | 'router';
}> = ({
  onCapture,
  onOpenSettings,
  hasApiKey,
  provider,
}) => (
    <div className="h-full flex flex-col items-center justify-center text-center p-6 py-8">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.1))',
          border: '1px solid rgba(59,130,246,0.2)',
          boxShadow: '0 8px 32px rgba(59,130,246,0.15)',
        }}
      >
        <Sparkles className="w-7 h-7" style={{ color: '#60a5fa' }} />
      </div>
      <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'white' }}>Ghost AI Ready</h3>
      <p className="text-xs mb-5 leading-relaxed max-w-[260px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {hasApiKey
          ? 'Completely invisible on screen share. Ask anything or capture your screen for instant AI analysis.'
          : provider === 'openrouter'
            ? 'Add your OpenRouter key to get started with free models (:free). This overlay is invisible in all screen share apps.'
            : provider === 'groq'
              ? 'Add your Groq API key to get started. This overlay is invisible in all screen share apps.'
              : provider === 'router'
                ? 'Configure your Free Router endpoint in Settings to get started. This overlay is invisible in all screen share apps.'
                : 'Add your free Gemini API key to get started. This overlay is invisible in all screen share apps.'}
      </p>
      {!hasApiKey ? (
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: '#2563eb', color: 'white' }}
        >
          <Settings className="w-3.5 h-3.5" />
          {provider === 'openrouter'
            ? 'Add OpenRouter Key'
            : provider === 'groq'
              ? 'Add Groq API Key'
              : provider === 'router'
                ? 'Configure Free Router'
                : 'Add Gemini API Key'}
        </button>
      ) : (
        <div className="flex flex-col gap-2 items-center">
          <button
            onClick={onCapture}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: '#2563eb', color: 'white' }}
          >
            <Camera className="w-3.5 h-3.5" />
            Capture & Analyze Screen
          </button>
          <div className="flex flex-col gap-1 text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <div>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mr-1.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>Ctrl+\</kbd>
              Toggle visibility
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mr-1.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>Ctrl+Shift+S</kbd>
              Instant screen capture
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mr-1.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>F9 / Ctrl+Shift+L</kbd>
              Push to Listen (Speaker voice)
            </div>
          </div>
        </div>
      )}
    </div>
  );

const MessageBubble: React.FC<{ msg: Message; provider?: 'gemini' | 'groq' | 'openrouter' | 'router' }> = ({ msg, provider = 'gemini' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {msg.screenshotPreview && (
          <div
            className="rounded-lg overflow-hidden max-w-[180px]"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <img src={msg.screenshotPreview} alt="Screen capture" className="w-full h-auto object-cover max-h-28" />
          </div>
        )}
        <div
          className="px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs max-w-[85%] break-words"
          style={{
            background: 'rgba(37,99,235,0.2)',
            border: '1px solid rgba(59,130,246,0.25)',
            color: '#bfdbfe',
          }}
        >
          {msg.text}
        </div>
      </div>
    );
  }

  // Model message
  return (
    <div className="flex flex-col items-start">
      <div
        className="relative group text-xs w-full max-w-full rounded-2xl rounded-tl-sm px-3.5 py-2.5"
        style={{
          background: msg.isError ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${msg.isError ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        {msg.text ? (
          <>
            <MarkdownRenderer content={msg.text} />
            <div
              className="mt-2 pt-1.5 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                {copied ? <Check className="w-3 h-3" style={{ color: '#34d399' }} /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 py-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#3b82f6' }} />
            <span className="text-[11px] font-mono">
              {provider === 'groq'
                ? 'Groq is thinking...'
                : provider === 'openrouter'
                  ? 'OpenRouter is thinking...'
                  : provider === 'router'
                    ? 'Free Router is thinking...'
                    : 'Gemini is analyzing...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
