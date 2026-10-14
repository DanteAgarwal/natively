import Store from 'electron-store';
import { app } from 'electron';

export type AudienceType =
  | 'technical' // Technical Interviewer / Senior Engineer / Architect
  | 'manager'   // Hiring Manager / Team Lead
  | 'hr'        // HR / Recruiter / Talent Acquisition
  | 'executive' // Director / VP / Executive
  | 'client'    // Client / Customer / Stakeholder
  | 'custom';   // Custom audience specified by user

export type ResponseStyle =
  | 'conversational' // Natural spoken first-person sentences
  | 'star'           // STAR method (Situation, Task, Action, Result)
  | 'concise'        // Crisp, punchy bullets (under 60s read)
  | 'deep_dive';     // In-depth technical architecture & trade-offs

export interface UserProfileContext {
  enabled: boolean;
  candidateName: string;
  candidateTitle: string;
  yearsOfExperience: string;
  currentCompany: string;
  keySkills: string;          // e.g. "React, TypeScript, Go, Microservices, System Design"
  resumeText: string;         // Full resume or career highlights
  targetRole: string;         // e.g. "Senior Full-Stack Engineer"
  targetCompany: string;      // e.g. "Stripe", "Google", "Fintech Startup"
  jobDescription: string;     // Full JD text or core requirements
  audienceType: AudienceType;
  audienceCustomNotes: string;// e.g. "Emphasizes latency, high concurrency, and clean code"
  responseStyle: ResponseStyle;
  keyHighlights: string;      // Projects/achievements to ALWAYS weave into answers
  avoidTopics: string;        // Things NOT to bring up (e.g. gaps, unused tools)
}

export const DEFAULT_USER_PROFILE_CONTEXT: UserProfileContext = {
  enabled: false,
  candidateName: '',
  candidateTitle: '',
  yearsOfExperience: '',
  currentCompany: '',
  keySkills: '',
  resumeText: '',
  targetRole: '',
  targetCompany: '',
  jobDescription: '',
  audienceType: 'technical',
  audienceCustomNotes: '',
  responseStyle: 'conversational',
  keyHighlights: '',
  avoidTopics: '',
};

export interface AppConfig {
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
  userProfileContext?: UserProfileContext;
}

const DEFAULT_CONFIG: AppConfig = {
  provider: 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModel: 'openrouter/free',
  routerPreset: 'pollinations',
  routerBaseUrl: process.env.ROUTER_BASE_URL || 'https://text.pollinations.ai/openai',
  routerApiKey: process.env.ROUTER_API_KEY || '',
  routerModel: process.env.ROUTER_MODEL || 'openai',
  systemInstruction: 'You are an expert AI assistant. Provide concise, clear, and direct answers. When code is requested, provide clean and correct code with brief explanation. Do not include unnecessary filler words.',
  model: 'gemini-3.8-flash',
  groqModel: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  autoFallback: true,
  selectedAudioOutputDevice: '',
  userProfileContext: DEFAULT_USER_PROFILE_CONTEXT,
};

class ConfigService {
  private store: Store<AppConfig>;

  constructor() {
    this.store = new Store<AppConfig>({
      name: 'ghost-copilot-config',
      defaults: DEFAULT_CONFIG
    });
  }

  public getConfig(): AppConfig {
    let savedModel = this.store.get('model') || DEFAULT_CONFIG.model;
    // Auto-migrate retired or restricted model names to official active gemini-3.8-flash
    const obsoleteGemini = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-3-flash-preview',
    ];
    if (obsoleteGemini.includes(savedModel)) {
      savedModel = 'gemini-3.8-flash';
      this.store.set('model', savedModel);
    }

    let savedGroqModel = this.store.get('groqModel') || DEFAULT_CONFIG.groqModel;
    const obsoleteGroq = ['llama-3.2-11b-vision-preview', 'deepseek-r1-distill-llama-70b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
    if (obsoleteGroq.includes(savedGroqModel)) {
      savedGroqModel = 'llama-3.3-70b-versatile';
      this.store.set('groqModel', savedGroqModel);
    }

    const cleanKey = (val?: string) => (val || '').trim().replace(/^["']|["']$/g, '');

    const envGemini = process.env.GEMINI_API_KEY || (process.env as any)['GEMINI_API_KEY '];
    const envGroq = process.env.GROQ_API_KEY || (process.env as any)['GROQ_API_KEY '];
    const envOpenRouter = process.env.OPENROUTER_API_KEY || (process.env as any)['OPENROUTER_API_KEY '];
    const envRouterKey = process.env.ROUTER_API_KEY || (process.env as any)['ROUTER_API_KEY '];
    const envRouterUrl = process.env.ROUTER_BASE_URL || (process.env as any)['ROUTER_BASE_URL '];
    const envRouterModel = process.env.ROUTER_MODEL || (process.env as any)['ROUTER_MODEL '];

    const getStoredOrEnv = (storeKey: keyof AppConfig, envVal?: string) => {
      const stored = this.store.get(storeKey);
      if (stored !== undefined && stored !== null) {
        return cleanKey(String(stored));
      }
      return cleanKey(envVal) || '';
    };

    const storedProfile = (this.store.get('userProfileContext') || {}) as Partial<UserProfileContext>;

    return {
      provider: (this.store.get('provider') as any) || DEFAULT_CONFIG.provider,
      geminiApiKey: getStoredOrEnv('geminiApiKey', envGemini),
      groqApiKey: getStoredOrEnv('groqApiKey', envGroq),
      openrouterApiKey: getStoredOrEnv('openrouterApiKey', envOpenRouter),
      openrouterModel: this.store.get('openrouterModel') || DEFAULT_CONFIG.openrouterModel,
      routerPreset: this.store.get('routerPreset') || DEFAULT_CONFIG.routerPreset,
      routerBaseUrl: this.store.get('routerBaseUrl') || cleanKey(envRouterUrl) || DEFAULT_CONFIG.routerBaseUrl,
      routerApiKey: getStoredOrEnv('routerApiKey', envRouterKey),
      routerModel: this.store.get('routerModel') || cleanKey(envRouterModel) || DEFAULT_CONFIG.routerModel,
      systemInstruction: this.store.get('systemInstruction') || DEFAULT_CONFIG.systemInstruction,
      model: savedModel,
      groqModel: savedGroqModel,
      temperature: this.store.get('temperature') ?? DEFAULT_CONFIG.temperature,
      autoFallback: this.store.get('autoFallback') ?? DEFAULT_CONFIG.autoFallback,
      selectedAudioOutputDevice: this.store.get('selectedAudioOutputDevice') || '',
      userProfileContext: {
        ...DEFAULT_USER_PROFILE_CONTEXT,
        ...storedProfile,
      },
    };
  }

  public setConfig(newConfig: Partial<AppConfig>): AppConfig {
    const cleanKey = (val?: string) => (val || '').trim().replace(/^["']|["']$/g, '');

    if (newConfig.provider !== undefined) this.store.set('provider', newConfig.provider);
    if (newConfig.geminiApiKey !== undefined) this.store.set('geminiApiKey', cleanKey(newConfig.geminiApiKey));
    if (newConfig.groqApiKey !== undefined) this.store.set('groqApiKey', cleanKey(newConfig.groqApiKey));
    if (newConfig.openrouterApiKey !== undefined) this.store.set('openrouterApiKey', cleanKey(newConfig.openrouterApiKey));
    if (newConfig.openrouterModel !== undefined) this.store.set('openrouterModel', newConfig.openrouterModel);
    if (newConfig.routerPreset !== undefined) this.store.set('routerPreset', newConfig.routerPreset);
    if (newConfig.routerBaseUrl !== undefined) this.store.set('routerBaseUrl', newConfig.routerBaseUrl);
    if (newConfig.routerApiKey !== undefined) this.store.set('routerApiKey', cleanKey(newConfig.routerApiKey));
    if (newConfig.routerModel !== undefined) this.store.set('routerModel', newConfig.routerModel);
    if (newConfig.systemInstruction !== undefined) this.store.set('systemInstruction', newConfig.systemInstruction);
    if (newConfig.model !== undefined) this.store.set('model', newConfig.model);
    if (newConfig.groqModel !== undefined) this.store.set('groqModel', newConfig.groqModel);
    if (newConfig.temperature !== undefined) this.store.set('temperature', newConfig.temperature);
    if (newConfig.autoFallback !== undefined) this.store.set('autoFallback', newConfig.autoFallback);
    if (newConfig.selectedAudioOutputDevice !== undefined) this.store.set('selectedAudioOutputDevice', newConfig.selectedAudioOutputDevice);
    if (newConfig.userProfileContext !== undefined) {
      const existing = (this.store.get('userProfileContext') || DEFAULT_USER_PROFILE_CONTEXT) as UserProfileContext;
      const merged = { ...existing, ...newConfig.userProfileContext };
      this.store.set('userProfileContext', merged);
    }
    return this.getConfig();
  }
}

export const configService = new ConfigService();

/**
 * Builds the effective system instruction dynamically.
 * If candidate persona/resume/JD context is enabled, merges candidate details,
 * target JD, audience persona rules, and response style with the base system instruction.
 */
export function buildEffectiveSystemInstruction(config: AppConfig): string {
  const baseInstruction = config.systemInstruction?.trim() ||
    'You are an expert AI assistant embedded in a private, invisible overlay. Provide concise, clear, and direct answers. Format responses with markdown for readability.';

  const profile = config.userProfileContext;
  if (!profile || !profile.enabled) {
    return baseInstruction;
  }

  // Check if at least some persona or JD context has been supplied
  const hasResume = !!(profile.resumeText?.trim() || profile.candidateTitle?.trim() || profile.keySkills?.trim() || profile.candidateName?.trim());
  const hasJd = !!(profile.jobDescription?.trim() || profile.targetRole?.trim() || profile.targetCompany?.trim());
  const hasCustomNotes = !!profile.audienceCustomNotes?.trim();

  if (!hasResume && !hasJd && !hasCustomNotes) {
    return baseInstruction;
  }

  const audienceDescriptions: Record<AudienceType, string> = {
    technical: 'Senior/Staff Software Engineer, Technical Architect, or Technical Coding Screener. Expects high technical depth, precise terminology, data structures & algorithms (Big-O), system architecture, scalability, concurrency, edge cases, and pragmatic trade-offs.',
    manager: 'Engineering Manager, Team Lead, or Delivery Lead. Expects focus on project ownership, cross-functional collaboration, mentorship, handling blockers, business agility, agile sprints, and practical technical trade-offs.',
    hr: 'HR Recruiter or Talent Acquisition Partner. Expects clear, jargon-free explanations, culture fit, career progression narrative, enthusiasm for the company mission, teamwork, emotional intelligence, and non-intimidating summaries.',
    executive: 'Director, VP, or C-Level Executive (CTO/CEO). Expects strategic vision, high-level business ROI, cost/revenue impact, team/platform scaling, cross-functional leverage, and crisp executive summaries.',
    client: 'Client, Enterprise Customer, or External Stakeholder. Expects professional confidence, risk mitigation, business value delivery, clear milestones, and solutions-oriented phrasing.',
    custom: profile.audienceCustomNotes?.trim() || 'Custom interviewer context.',
  };

  const responseStyleInstructions: Record<ResponseStyle, string> = {
    conversational: 'Deliver natural, spoken conversational answers that sound authentic and smooth when spoken aloud. Aim for ~60-90 seconds speaking time with clear cadence.',
    star: 'Structure behavioral questions strictly with STAR (Situation, Task, Action, Result). Highlight your specific personal Actions and include quantifiable business impact in the Result.',
    concise: 'Deliver punchy, bulleted talking points (30-45 seconds) that are effortless to scan and articulate under pressure.',
    deep_dive: 'Deliver a thorough, comprehensive technical breakdown covering system components, data flow, failure modes, and performance trade-offs.',
  };

  const audienceLabel: Record<AudienceType, string> = {
    technical: 'Technical Screener / Senior Engineer',
    manager: 'Hiring Manager / Engineering Lead',
    hr: 'HR / Recruiter',
    executive: 'Director / VP / Executive',
    client: 'Client / Stakeholder',
    custom: 'Custom Audience',
  };

  const audienceType = profile.audienceType || 'technical';
  const responseStyle = profile.responseStyle || 'conversational';
  const audienceInfo = audienceDescriptions[audienceType] || audienceDescriptions.technical;
  const styleInfo = responseStyleInstructions[responseStyle] || responseStyleInstructions.conversational;

  const parts: string[] = [
    baseInstruction,
    '\n\n=========================================================',
    '=== CANDIDATE PERSONA & INTERVIEW COPILOT CONTEXT (ACTIVE) ===',
    '=========================================================',
    'CRITICAL ROLE: You are acting as the live, real-time interview & meeting co-pilot for the candidate below.',
    'ALL ANSWERS MUST BE FORMULATED IN FIRST-PERSON ("I", "my team", "in my previous role at [Company]").',
    'The candidate will speak your response aloud to the interviewer in real-time.',
    '\n--- 1. CANDIDATE BACKGROUND (RESUME) ---',
    `Candidate Name: ${profile.candidateName?.trim() || 'Candidate'}`,
    `Current / Target Title: ${profile.candidateTitle?.trim() || 'Senior Software Engineer'}`,
    `Years of Experience: ${profile.yearsOfExperience?.trim() || 'Experienced'}`,
    `Current / Past Companies: ${profile.currentCompany?.trim() || 'Confidential'}`,
    `Core Skills & Tech Stack: ${profile.keySkills?.trim() || 'Software Engineering'}`,
  ];

  if (profile.keyHighlights?.trim()) {
    parts.push(`Key Flagship Achievements to ALWAYS Weave In:\n${profile.keyHighlights.trim()}`);
  }

  if (profile.avoidTopics?.trim()) {
    parts.push(`Topics to AVOID or DOWNPLAY:\n${profile.avoidTopics.trim()}`);
  }

  if (profile.resumeText?.trim()) {
    parts.push(`Full Resume & Experience Summary:\n${profile.resumeText.trim()}`);
  }

  parts.push('\n--- 2. TARGET JOB DESCRIPTION (JD) ---');
  parts.push(`Target Role: ${profile.targetRole?.trim() || 'Target Engineering Role'}`);
  parts.push(`Target Company: ${profile.targetCompany?.trim() || 'Target Company'}`);

  if (profile.jobDescription?.trim()) {
    parts.push(`Job Requirements & Scope:\n${profile.jobDescription.trim()}`);
  }

  parts.push('\n--- 3. TARGET AUDIENCE & PERSONA ---');
  parts.push(`Audience Type: ${audienceLabel[audienceType]} (${audienceType.toUpperCase()})`);
  parts.push(`Audience Expectations: ${audienceInfo}`);
  if (profile.audienceCustomNotes?.trim() && audienceType !== 'custom') {
    parts.push(`Specific Interviewer Notes: ${profile.audienceCustomNotes.trim()}`);
  }
  parts.push(`Speaking Style & Structure: ${styleInfo}`);

  parts.push('\n--- 4. STRICT COPILOT EXECUTION RULES ---');
  parts.push('1. SPEAK DIRECTLY AS THE CANDIDATE: Use natural first-person ("I designed", "We deployed", "My approach was"). Never say "As an AI" or "The candidate should say".');
  parts.push('2. BRIDGE RESUME TO JD: Whenever possible, link the candidate\'s real background projects to the specific requirements of the job description.');
  parts.push('3. CALIBRATE FOR AUDIENCE: Adjust depth and jargon to match the interviewer\'s profile perfectly.');
  parts.push('4. CONCISE & SPOKEN: Responses must be structured for immediate speaking out loud, without awkward formatting or robotic preambles.');

  return parts.join('\n');
}
