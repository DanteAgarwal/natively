import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Header } from './components/Header';
import { ContextBar } from './components/ContextBar';
import { CommandDock } from './components/CommandDock';
import { TranscriptDrawer } from './components/TranscriptDrawer';
import { CaptureStudio } from './components/CaptureStudio';
import { EmptyState } from './components/EmptyState';
import { MessageBubble } from './components/MessageBubble';
import { HotkeyCheatSheet } from './components/HotkeyCheatSheet';
import { ShortcutActionId } from './types/shortcuts';
import { SettingsModal } from './components/SettingsModal';
import { InterviewContextModal } from './components/InterviewContextModal';
import { UserProfileContext, DEFAULT_USER_PROFILE_CONTEXT } from './types/profile';
import {
  Message,
  AppConfig,
  ActiveTab,
  AssistantMode,
  ASSISTANT_MODES,
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

  const copyLastResponseRef = useRef<() => void>(() => {});
  const executeShortcutActionRef = useRef<(actionId: ShortcutActionId) => void>(() => {});
  const lastShortcutTimeRef = useRef<Record<string, number>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<boolean>(false);

  // Load config on mount
  useEffect(() => {
    if (window.ghostAPI) {
      window.ghostAPI.getConfig().then((cfg) => {
        if (cfg) {
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
      executeShortcutActionRef.current('capture_screen');
    });

    const unsubHotkeyListen = window.ghostAPI.onTriggerListen?.(() => {
      executeShortcutActionRef.current('mic_dictate');
    });

    const unsubClickThrough = window.ghostAPI.onClickThroughToggled((active) => {
      setIsClickThrough(active);
    });

    const unsubPanic = window.ghostAPI.onPanicHide(() => {
      executeShortcutActionRef.current('panic_hide');
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
      executeShortcutActionRef.current('sync_meeting');
    });

    const unsubWhatToAnswer = window.ghostAPI.onTriggerWhatToAnswer?.(() => {
      executeShortcutActionRef.current('what_to_answer');
    });

    const unsubRecap = window.ghostAPI.onTriggerRecap?.(() => {
      executeShortcutActionRef.current('recap_meeting');
    });

    const unsubFollowUp = window.ghostAPI.onTriggerFollowUp?.(() => {
      executeShortcutActionRef.current('follow_up');
    });

    const unsubShorten = window.ghostAPI.onTriggerShorten?.(() => {
      executeShortcutActionRef.current('shorten_response');
    });

    const unsubCopyResponse = window.ghostAPI.onTriggerCopyResponse?.(() => {
      copyLastResponseRef.current();
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
      unsubWhatToAnswer?.();
      unsubRecap?.();
      unsubFollowUp?.();
      unsubShorten?.();
      unsubCopyResponse?.();
      unsubWindowSize?.();
    };
  }, []);

  // Universal Keyboard Shortcut Dispatcher (Aligned strictly with pruned 10-shortcut catalog)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      // 1. Escape: Hierarchical Smart Dismiss
      if (e.key === 'Escape') {
        e.preventDefault();
        executeShortcutActionRef.current('dismiss_cancel');
        return;
      }

      // 2. Cheatsheet HUD (? when not typing, or F1)
      if ((e.key === '?' && !isInputFocused) || e.key === 'F1') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // 3. Screen Capture (Alt+S or Ctrl+Shift+S)
      if ((e.altKey && e.key.toLowerCase() === 's') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        executeShortcutActionRef.current('capture_screen');
        return;
      }

      // 4. Voice Dictation (F9 or Alt+L or Ctrl+Shift+L)
      if (e.key === 'F9' || (e.altKey && e.key.toLowerCase() === 'l') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l')) {
        e.preventDefault();
        executeShortcutActionRef.current('mic_dictate');
        return;
      }

      // 5. What to answer? (Alt+W or Ctrl+Shift+W)
      if ((e.altKey && e.key.toLowerCase() === 'w') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'w')) {
        e.preventDefault();
        executeShortcutActionRef.current('what_to_answer');
        return;
      }

      // 6. Recap Meeting (Alt+R or Ctrl+Shift+R)
      if ((e.altKey && e.key.toLowerCase() === 'r') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        executeShortcutActionRef.current('recap_meeting');
        return;
      }

      // 7. Suggest Follow-Up Questions (Alt+F or Ctrl+Shift+F)
      if ((e.altKey && e.key.toLowerCase() === 'f') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        executeShortcutActionRef.current('follow_up');
        return;
      }

      // 8. Shorten Response (Alt+K or Ctrl+Shift+K)
      if ((e.altKey && e.key.toLowerCase() === 'k') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        executeShortcutActionRef.current('shorten_response');
        return;
      }

      // 9. Meeting Audio WASAPI Sync (Alt+M or Ctrl+Shift+M)
      if ((e.altKey && e.key.toLowerCase() === 'm') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm')) {
        e.preventDefault();
        executeShortcutActionRef.current('sync_meeting');
        return;
      }

      // 10. Stealth Panic Hide (Ctrl+Shift+H)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        executeShortcutActionRef.current('panic_hide');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        setExportNotice('Saved ✓');
        setTimeout(() => setExportNotice(null), 3000);
        setQuickToast('Session saved to file ✓');
        setTimeout(() => setQuickToast(null), 2500);
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

  // Keep active action refs synchronized
  useEffect(() => {
    toggleListeningRef.current = toggleListening;
    copyLastResponseRef.current = handleCopyLastResponse;
    executeShortcutActionRef.current = handleExecuteShortcutAction;
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
        const errMessage = err?.message || 'Screen capture or vision request failed.';
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'model',
            text: `⚠️ **Screen Vision Error**: ${errMessage}`,
            timestamp: Date.now(),
            isError: true,
          },
        ]);
        setActiveTab('chat');
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

  // Smart Hierarchical Dismiss (Esc)
  const handleSmartDismiss = () => {
    if (isStreaming) {
      handleStopStream();
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
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
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
  };

  // Unified Shortcut Action Dispatcher (Debounced against duplicate OS & window keystrokes)
  const handleExecuteShortcutAction = (actionId: ShortcutActionId) => {
    const now = Date.now();
    if (now - (lastShortcutTimeRef.current[actionId] || 0) < 350) {
      return; // Ignore duplicate execution within 350ms
    }
    lastShortcutTimeRef.current[actionId] = now;

    switch (actionId) {
      case 'capture_screen':
        handleCaptureAndAnalyze();
        break;
      case 'mic_dictate':
        toggleListening();
        break;
      case 'what_to_answer':
        handleWhatToAnswer();
        break;
      case 'recap_meeting':
        handleRecapMeeting();
        break;
      case 'follow_up':
        handleFollowUp();
        break;
      case 'shorten_response':
        handleShorten();
        break;
      case 'sync_meeting':
        toggleMeetingAudio();
        break;
      case 'toggle_visibility':
        if (window.ghostAPI) {
          window.ghostAPI.toggleGhostMode();
        }
        break;
      case 'panic_hide':
        setIsStreaming(false);
        setCaptureStatus('idle');
        abortRef.current = true;
        window.ghostAPI?.stopStream();
        setQuickToast('Stealth Panic: Muted & Hidden 🚨');
        setTimeout(() => setQuickToast(null), 2000);
        break;
      case 'dismiss_cancel':
        handleSmartDismiss();
        break;
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

        {/* Global Keyboard Shortcuts Cheatsheet Modal */}
        <HotkeyCheatSheet
          show={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          onExecuteAction={handleExecuteShortcutAction}
        />

        {/* Main Content Workspace (Hidden when Collapsed) */}
        {!isCollapsed && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Unified Top Context & Mode Strip */}
            <ContextBar
              config={config}
              assistantMode={assistantMode}
              onSelectMode={setAssistantMode}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              messageCount={messageCount}
              isMeetingListening={isMeetingListening}
              transcriptCount={meetingTranscripts.length}
              onToggleTranscriptDrawer={() => setShowTranscriptDrawer((prev) => !prev)}
              showTranscriptDrawer={showTranscriptDrawer}
              onOpenContextModal={() => setIsContextModalOpen(true)}
              isClickThrough={isClickThrough}
              onToggleClickThrough={handleToggleClickThrough}
              hasApiKey={hasApiKey}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onExportSession={handleExportSession}
              onClearMessages={handleClearMessages}
              windowOpacity={windowOpacity}
              onChangeOpacity={setWindowOpacity}
              exportNotice={exportNotice}
            />

            {/* TAB 1: Real-time Copilot Chat Feed */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0 relative">
                {/* Scrollable Messages Stream */}
                <div
                  className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {messages.length === 0 ? (
                    <EmptyState
                      onCapture={() => setActiveTab('capture')}
                      onOpenSettings={() => setIsSettingsOpen(true)}
                      onToggleMeetingAudio={toggleMeetingAudio}
                      onOpenContextModal={() => setIsContextModalOpen(true)}
                      hasApiKey={hasApiKey}
                      provider={config.provider}
                    />
                  ) : (
                    messages.map((msg, index) => {
                      const prevUserMsg = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user');
                      return (
                        <MessageBubble
                          key={msg.id}
                          msg={msg}
                          provider={config.provider}
                          onRetry={msg.isError && prevUserMsg ? () => executePrompt(prevUserMsg.text) : undefined}
                          onOpenSettings={() => setIsSettingsOpen(true)}
                        />
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Live Meeting Transcripts Drawer */}
                <TranscriptDrawer
                  isOpen={showTranscriptDrawer && meetingTranscripts.length > 0}
                  onClose={() => setShowTranscriptDrawer(false)}
                  transcripts={meetingTranscripts}
                  onClear={clearMeetingTranscripts}
                  onAnswerItem={(text) => {
                    executePrompt(`Regarding this statement from the meeting: "${text}"\n\nWhat is the best, most direct, and impressive answer? Give me the response formatted to say aloud concisely.`);
                  }}
                />

                {/* Bottom Dock: Input + Meeting Action Pills + Voice Mic */}
                <CommandDock
                  inputPrompt={inputPrompt}
                  setInputPrompt={setInputPrompt}
                  onSendMessage={handleSendMessage}
                  onCaptureAndAnalyze={() => handleCaptureAndAnalyze()}
                  isStreaming={isStreaming}
                  onStopStream={handleStopStream}
                  hasApiKey={hasApiKey}
                  isListening={isListening}
                  isTranscribing={isTranscribing}
                  onToggleListening={toggleListening}
                  onWhatToAnswer={handleWhatToAnswer}
                  onRecap={handleRecapMeeting}
                  onFollowUp={handleFollowUp}
                  onShorten={handleShorten}
                  transcriptCount={meetingTranscripts.length}
                  showTranscriptDrawer={showTranscriptDrawer}
                  onToggleTranscriptDrawer={() => setShowTranscriptDrawer((prev) => !prev)}
                />
              </div>
            )}

            {/* TAB 2: Screen Vision AI Workspace */}
            {activeTab === 'capture' && (
              <CaptureStudio
                onCapture={(prompt) => handleCaptureAndAnalyze(prompt)}
                capturePrompt={capturePrompt}
                setCapturePrompt={setCapturePrompt}
                captureStatus={captureStatus}
                isStreaming={isStreaming}
                hasApiKey={hasApiKey}
                isGhostActive={isGhostActive}
                recentCaptures={messages
                  .filter((m) => m.screenshotPreview)
                  .map((m) => ({ id: m.id, previewUrl: m.screenshotPreview!, prompt: m.text }))}
                onSelectCapture={(_id) => {
                  setActiveTab('chat');
                }}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}
          </div>
        )}

        {/* Collapsed Pill Indicator */}
        {isCollapsed && (
          <div className="flex items-center justify-center h-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-all"
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
