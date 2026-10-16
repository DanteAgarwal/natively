export type ShortcutCategory = 'core_meeting' | 'stealth_control';

export type ShortcutActionId =
  | 'capture_screen'
  | 'mic_dictate'
  | 'what_to_answer'
  | 'recap_meeting'
  | 'follow_up'
  | 'shorten_response'
  | 'sync_meeting'
  | 'toggle_visibility'
  | 'panic_hide'
  | 'dismiss_cancel';

export interface ShortcutDefinition {
  id: ShortcutActionId;
  title: string;
  description: string;
  category: ShortcutCategory;
  primaryKey: string; // e.g. "Alt + S"
  secondaryKey?: string; // e.g. "Ctrl + Shift + S"
  isGlobal: boolean; // Works while focused on Zoom, Google Meet, or code editor
  icon: string;
  badge?: string;
}

export const SHORTCUT_CATEGORIES: Array<{ id: ShortcutCategory | 'all'; label: string; icon: string }> = [
  { id: 'all', label: 'All Shortcuts', icon: '⚡' },
  { id: 'core_meeting', label: 'Interview & Copilot', icon: '🎯' },
  { id: 'stealth_control', label: 'Stealth & Window', icon: '🛡️' },
];

/**
 * Curated, Uncongested Essential Shortcuts
 * Every shortcut here is tested, verified, and serves a critical workflow.
 */
export const SHORTCUT_CATALOG: ShortcutDefinition[] = [
  // 1. Core Interview & Copilot Actions
  {
    id: 'capture_screen',
    title: 'Screen Capture & AI Answer',
    description: 'Instant snapshot of active screen to solve coding problems, debug errors, or explain diagrams.',
    category: 'core_meeting',
    primaryKey: 'Alt + S',
    secondaryKey: 'Ctrl + Shift + S',
    isGlobal: true,
    icon: '📷',
    badge: 'Most Used',
  },
  {
    id: 'mic_dictate',
    title: 'Voice Dictation (Push-to-Talk)',
    description: 'Press once to speak your question; transcribes via Whisper and sends immediately to AI.',
    category: 'core_meeting',
    primaryKey: 'F9',
    secondaryKey: 'Alt + L',
    isGlobal: true,
    icon: '🎙️',
    badge: 'Single Key',
  },
  {
    id: 'what_to_answer',
    title: 'What to answer?',
    description: 'Analyzes the interviewer’s latest spoken question from system audio and outputs the optimal spoken reply.',
    category: 'core_meeting',
    primaryKey: 'Alt + W',
    secondaryKey: 'Ctrl + Shift + W',
    isGlobal: true,
    icon: '🎯',
    badge: 'Killer Feature',
  },
  {
    id: 'recap_meeting',
    title: 'Recap Meeting',
    description: 'Summarizes key discussion points, technical decisions, and next steps from speaker audio.',
    category: 'core_meeting',
    primaryKey: 'Alt + R',
    secondaryKey: 'Ctrl + Shift + R',
    isGlobal: true,
    icon: '📋',
  },
  {
    id: 'follow_up',
    title: 'Suggest Follow-Up Questions',
    description: 'Generates 3 impressive, strategic questions to ask the interviewer to demonstrate ownership.',
    category: 'core_meeting',
    primaryKey: 'Alt + F',
    secondaryKey: 'Ctrl + Shift + F',
    isGlobal: true,
    icon: '💡',
  },
  {
    id: 'shorten_response',
    title: 'Shorten to Spoken Bullets',
    description: 'Condenses the previous copilot answer into 2-3 crisp bullet points easy to say aloud.',
    category: 'core_meeting',
    primaryKey: 'Alt + K',
    secondaryKey: 'Ctrl + Shift + K',
    isGlobal: true,
    icon: '✂️',
  },
  {
    id: 'sync_meeting',
    title: 'Sync Meeting Audio (WASAPI)',
    description: 'Starts or stops capturing system speaker loopback audio from Zoom, Teams, or Google Meet.',
    category: 'core_meeting',
    primaryKey: 'Alt + M',
    secondaryKey: 'Ctrl + Shift + M',
    isGlobal: true,
    icon: '🎧',
  },

  // 2. Stealth & Window Controls
  {
    id: 'toggle_visibility',
    title: 'Hide / Show Ghost Overlay',
    description: 'Toggles window visibility without appearing in Windows taskbar or Alt-Tab switcher.',
    category: 'stealth_control',
    primaryKey: 'Ctrl + \\',
    isGlobal: true,
    icon: '👁️',
    badge: 'Stealth',
  },
  {
    id: 'panic_hide',
    title: 'Panic Hide & Mute',
    description: 'Emergency killswitch: instantly stops AI streaming, mutes audio, and hides overlay.',
    category: 'stealth_control',
    primaryKey: 'Ctrl + Shift + H',
    isGlobal: true,
    icon: '🚨',
    badge: 'Emergency',
  },
  {
    id: 'dismiss_cancel',
    title: 'Smart Cancel / Stop',
    description: 'Stops ongoing generation, closes modal drawers, or clears current prompt input.',
    category: 'stealth_control',
    primaryKey: 'Esc',
    isGlobal: false,
    icon: '⎋',
  },
];
