import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  FileText,
  User,
  Users,
  Eye,
  Check,
  X,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Building,
  Target,
  ShieldCheck,
  RotateCcw,
  Sliders,
  Code2,
  Crown,
  MessageSquareQuote,
} from 'lucide-react';
import {
  UserProfileContext,
  AudienceType,
  ResponseStyle,
  DEFAULT_USER_PROFILE_CONTEXT,
  SAMPLE_PROFILES,
} from '../types/profile';

interface InterviewContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: UserProfileContext;
  onSave: (updated: UserProfileContext) => Promise<void> | void;
}

type TabId = 'resume' | 'jd' | 'audience' | 'preview';

const AUDIENCE_OPTIONS: Array<{
  id: AudienceType;
  label: string;
  sublabel: string;
  icon: any;
  color: string;
  description: string;
}> = [
  {
    id: 'technical',
    label: 'Technical Screener / Staff Engineer',
    sublabel: 'Code, algorithms, design & trade-offs',
    icon: Code2,
    color: '#60a5fa',
    description: 'Expects high technical depth, precise terminology, Big-O algorithmic complexity, distributed systems architecture, latency, and edge cases.',
  },
  {
    id: 'manager',
    label: 'Hiring Manager / Team Lead',
    sublabel: 'Ownership, agile delivery & team fit',
    icon: Users,
    color: '#34d399',
    description: 'Focuses on project delivery, cross-functional collaboration, unblocking others, agile rituals, pragmatic technical decisions, and team culture.',
  },
  {
    id: 'hr',
    label: 'HR Recruiter / Talent Screener',
    sublabel: 'Culture, career progression & soft skills',
    icon: User,
    color: '#f472b6',
    description: 'Focuses on career narrative, communication clarity, enthusiasm for mission, compensation alignment, and high-level non-jargon explanations.',
  },
  {
    id: 'executive',
    label: 'Director / VP / C-Level Exec',
    sublabel: 'Strategic vision, ROI & high-level impact',
    icon: Crown,
    color: '#fbbf24',
    description: 'Focuses on business ROI, strategic organizational leverage, team and platform scaling, cost/revenue impact, and executive summaries.',
  },
  {
    id: 'client',
    label: 'Client / External Stakeholder',
    sublabel: 'Business value, confidence & deliverables',
    icon: Building,
    color: '#a78bfa',
    description: 'Focuses on reliable project delivery, clear milestones, confidence, risk mitigation, and solutions-oriented non-technical phrasing.',
  },
  {
    id: 'custom',
    label: 'Custom Audience',
    sublabel: 'User-specified interviewer persona',
    icon: Sliders,
    color: '#38bdf8',
    description: 'Use custom interviewer instructions and tailored context specified in the notes below.',
  },
];

const STYLE_OPTIONS: Array<{
  id: ResponseStyle;
  label: string;
  badge: string;
  description: string;
}> = [
  {
    id: 'conversational',
    label: 'Conversational Spoken',
    badge: 'Recommended',
    description: 'Natural first-person spoken answers (~60-90s) that sound authentic and smooth when spoken aloud.',
  },
  {
    id: 'star',
    label: 'STAR Behavioral Framework',
    badge: 'Interviews',
    description: 'Situation, Task, Action, Result. Emphasizes your personal contribution and measurable business impact.',
  },
  {
    id: 'concise',
    label: 'Crisp Talking Bullets',
    badge: 'Quick-Scan',
    description: 'Punchy 30-45s bullet points that can be glanced at and voiced immediately under high pressure.',
  },
  {
    id: 'deep_dive',
    label: 'Deep Architectural Dive',
    badge: 'Technical',
    description: 'Comprehensive breakdown covering architecture, data flow, failure recovery, and trade-offs.',
  },
];

export const InterviewContextModal: React.FC<InterviewContextModalProps> = ({
  isOpen,
  onClose,
  context,
  onSave,
}) => {
  const [form, setForm] = useState<UserProfileContext>({
    ...DEFAULT_USER_PROFILE_CONTEXT,
    ...context,
  });
  const [activeTab, setActiveTab] = useState<TabId>('resume');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      ...DEFAULT_USER_PROFILE_CONTEXT,
      ...context,
    });
  }, [context, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await onSave(form);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  const handleLoadPreset = (key: string) => {
    const preset = SAMPLE_PROFILES[key];
    if (preset) {
      setForm((prev) => ({
        ...prev,
        ...preset.data,
      }));
      setActivePreset(key);
    }
  };

  const handleClear = () => {
    setForm({
      ...DEFAULT_USER_PROFILE_CONTEXT,
      enabled: false,
    });
    setActivePreset(null);
  };

  // Compile preview string
  const compilePreview = () => {
    const audienceObj = AUDIENCE_OPTIONS.find((a) => a.id === form.audienceType) || AUDIENCE_OPTIONS[0];
    const styleObj = STYLE_OPTIONS.find((s) => s.id === form.responseStyle) || STYLE_OPTIONS[0];

    return `=== CANDIDATE PERSONA & INTERVIEW COPILOT CONTEXT (ACTIVE) ===
CRITICAL ROLE: You are acting as the live, real-time interview co-pilot for the candidate below.
ALL ANSWERS MUST BE FORMULATED IN FIRST-PERSON ("I", "my team", "in my previous role at [Company]").
The candidate will speak your response aloud to the interviewer in real-time.

--- 1. CANDIDATE BACKGROUND (RESUME) ---
Candidate Name: ${form.candidateName || 'Candidate'}
Current / Target Title: ${form.candidateTitle || 'Senior Software Engineer'}
Years of Experience: ${form.yearsOfExperience || 'Experienced'}
Current / Past Companies: ${form.currentCompany || 'Confidential'}
Core Skills & Tech Stack: ${form.keySkills || 'Software Engineering'}

Key Flagship Achievements to ALWAYS Weave In:
${form.keyHighlights || 'Demonstrate strong ownership, problem-solving, and measurable results.'}

Topics to AVOID or DOWNPLAY:
${form.avoidTopics || 'None specified.'}

Full Resume / Experience Details:
${form.resumeText || '(No full resume pasted yet - rely on candidate title and skills)'}

--- 2. TARGET JOB DESCRIPTION (JD) ---
Target Role: ${form.targetRole || 'Target Engineering Role'}
Target Company: ${form.targetCompany || 'Target Employer'}

Job Requirements & Scope:
${form.jobDescription || '(No JD provided - optimize for industry standards of target role)'}

--- 3. TARGET AUDIENCE & PERSONA ---
Audience Type: ${audienceObj.label} (${form.audienceType.toUpperCase()})
Audience Expectations: ${audienceObj.description}
${form.audienceCustomNotes ? `Specific Interviewer Notes: ${form.audienceCustomNotes}\n` : ''}Speaking Style & Structure: ${styleObj.description}

--- 4. STRICT COPILOT EXECUTION RULES ---
1. SPEAK DIRECTLY AS THE CANDIDATE: Use natural first-person ("I designed", "We deployed", "My approach was"). Never say "As an AI" or "The candidate should say".
2. BRIDGE RESUME TO JD: Whenever possible, link the candidate's real background projects to the specific requirements of the job description.
3. CALIBRATE FOR AUDIENCE: Adjust depth and jargon to match the interviewer's profile perfectly.
4. CONCISE & SPOKEN: Responses must be structured for immediate speaking out loud, without awkward formatting or robotic preambles.`;
  };

  const previewText = compilePreview();
  const wordCount = previewText.split(/\s+/).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150"
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden text-zinc-100"
        style={{
          background: 'linear-gradient(180deg, #18181b 0%, #111113 100%)',
          borderColor: form.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)',
          boxShadow: form.enabled
            ? '0 25px 50px -12px rgba(16, 185, 129, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div
          className="shrink-0 px-4 py-3.5 flex items-center justify-between border-b"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            borderColor: 'rgba(255, 255, 255, 0.07)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-inner"
              style={{
                background: form.enabled ? 'rgba(16, 185, 129, 0.18)' : 'rgba(59, 130, 246, 0.15)',
                border: form.enabled ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(59, 130, 246, 0.25)',
                color: form.enabled ? '#34d399' : '#60a5fa',
              }}
            >
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-white">
                  Resume, JD & Interview Persona
                </h2>
                {form.enabled ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active in Copilot
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                Tailors AI answers directly to your background, the job description, and your interviewer.
              </p>
            </div>
          </div>

          {/* Quick Enable Toggle & Close */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-[11px] font-medium text-zinc-300">Enable</span>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  form.enabled ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
                role="switch"
                aria-checked={form.enabled}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    form.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Preset Strip ── */}
        <div
          className="shrink-0 px-4 py-2 flex items-center justify-between border-b text-[11px]"
          style={{
            background: 'rgba(255, 255, 255, 0.015)',
            borderColor: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Quick Samples:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {Object.entries(SAMPLE_PROFILES).map(([key, sample]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleLoadPreset(key)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                  activePreset === key
                    ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40'
                    : 'bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700/80 border border-zinc-700/50'
                }`}
                title={sample.description}
              >
                {sample.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-0.5 rounded-md text-[10px] font-medium text-zinc-400 hover:text-red-300 hover:bg-red-500/10 border border-zinc-800 transition-all flex items-center gap-1"
              title="Reset fields to empty"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div
          className="shrink-0 px-4 pt-2.5 flex items-center gap-2 border-b"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.1)',
          }}
        >
          {[
            { id: 'resume' as const, label: '1. Resume & Background', icon: FileText, badge: form.resumeText?.trim() ? '✓' : null },
            { id: 'jd' as const, label: '2. Job Description (JD)', icon: Target, badge: form.jobDescription?.trim() ? '✓' : null },
            { id: 'audience' as const, label: '3. Audience & Persona', icon: Users, badge: form.audienceType.toUpperCase() },
            { id: 'preview' as const, label: '4. Live AI Preview', icon: Eye, badge: `${wordCount} words` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all duration-150 ${
                activeTab === tab.id
                  ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10 rounded-t-lg'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold"
                  style={{
                    background: activeTab === tab.id ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)',
                    color: activeTab === tab.id ? '#6ee7b7' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab Content (Scrollable) ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(92vh - 200px)' }}>
          {/* ════ TAB 1: RESUME & BACKGROUND ════ */}
          {activeTab === 'resume' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Candidate Name</label>
                  <input
                    type="text"
                    value={form.candidateName}
                    onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                    placeholder="e.g. Alex Rivera"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Your Current / Target Title</label>
                  <input
                    type="text"
                    value={form.candidateTitle}
                    onChange={(e) => setForm({ ...form, candidateTitle: e.target.value })}
                    placeholder="e.g. Senior Full-Stack Engineer"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Total Years of Experience</label>
                  <input
                    type="text"
                    value={form.yearsOfExperience}
                    onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })}
                    placeholder="e.g. 6+ years"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Current / Past Companies</label>
                  <input
                    type="text"
                    value={form.currentCompany}
                    onChange={(e) => setForm({ ...form, currentCompany: e.target.value })}
                    placeholder="e.g. Fintech Solutions, Stripe, AWS"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-300">
                  Core Skills & Technical Stack
                  <span className="text-[10px] text-zinc-500 ml-1.5">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={form.keySkills}
                  onChange={(e) => setForm({ ...form, keySkills: e.target.value })}
                  placeholder="e.g. React, TypeScript, Node.js, Go, Kubernetes, PostgreSQL, Redis, System Design"
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Full Resume Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Paste Full Resume / Career Highlights</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {form.resumeText?.length || 0} characters
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={form.resumeText}
                  onChange={(e) => setForm({ ...form, resumeText: e.target.value })}
                  placeholder="Paste your resume, experience bullet points, or past project descriptions here... The AI will use these real facts so you can answer accurately in first-person."
                  className="w-full rounded-xl p-3 text-xs bg-zinc-900/90 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none resize-y font-mono leading-relaxed"
                />
              </div>

              {/* Talking Points & Safeguards */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-emerald-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Key Highlights to ALWAYS Emphasize</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.keyHighlights}
                    onChange={(e) => setForm({ ...form, keyHighlights: e.target.value })}
                    placeholder="e.g. 1. Reduced p99 latency by 45%. 2. Handled $15M/day payment volume. 3. Mentored 4 engineers."
                    className="w-full rounded-lg p-2 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-amber-300 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span>Topics to AVOID or DOWNPLAY</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.avoidTopics}
                    onChange={(e) => setForm({ ...form, avoidTopics: e.target.value })}
                    placeholder="e.g. Do not mention leaving previous company early; downplay legacy PHP experience; avoid basic CSS."
                    className="w-full rounded-lg p-2 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ════ TAB 2: JOB DESCRIPTION (JD) ════ */}
          {activeTab === 'jd' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Target Role Title</label>
                  <input
                    type="text"
                    value={form.targetRole}
                    onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                    placeholder="e.g. Senior Full-Stack Engineer"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Target Company Name</label>
                  <input
                    type="text"
                    value={form.targetCompany}
                    onChange={(e) => setForm({ ...form, targetCompany: e.target.value })}
                    placeholder="e.g. Stripe, Google, Datadog"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Full JD Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-blue-400" />
                    <span>Paste Target Job Description (JD) / Requirements</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {form.jobDescription?.length || 0} characters
                  </span>
                </div>
                <textarea
                  rows={9}
                  value={form.jobDescription}
                  onChange={(e) => setForm({ ...form, jobDescription: e.target.value })}
                  placeholder="Paste the job description, required qualifications, key challenges, or team mission here... The AI will automatically bridge your resume experience to what the hiring team is looking for."
                  className="w-full rounded-xl p-3 text-xs bg-zinc-900/90 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none resize-y font-mono leading-relaxed"
                />
              </div>

              <div
                className="p-3 rounded-xl text-[11px] leading-relaxed flex items-start gap-2.5"
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: '#93c5fd',
                }}
              >
                <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Why add the JD?</strong> When the interviewer asks questions like <em>"Tell me about a difficult bug you solved"</em> or <em>"How would you design our checkout service?"</em>, the AI will automatically tailor your answer to use the tech stack and priorities highlighted in this job description.
                </div>
              </div>
            </div>
          )}

          {/* ════ TAB 3: AUDIENCE & PERSONA ════ */}
          {activeTab === 'audience' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Who is Your Interviewer / Audience?</span>
                </label>
                <p className="text-[11px] text-zinc-400">
                  Select who is interviewing you. The AI adapts technical depth, jargon, and business framing to match their expectations:
                </p>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {AUDIENCE_OPTIONS.map((item) => {
                    const isSelected = form.audienceType === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setForm({ ...form, audienceType: item.id })}
                        className={`p-3 rounded-xl text-left border transition-all duration-150 flex flex-col justify-between ${
                          isSelected
                            ? 'bg-zinc-800/90 shadow-md ring-1'
                            : 'bg-zinc-900/60 hover:bg-zinc-800/50 border-zinc-800'
                        }`}
                        style={{
                          borderColor: isSelected ? item.color : 'rgba(255, 255, 255, 0.08)',
                          boxShadow: isSelected ? `0 0 16px ${item.color}25` : 'none',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${item.color}20`, color: item.color }}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-semibold text-zinc-100">{item.label}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-snug">{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Audience Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-300">
                  Specific Notes About the Interviewer / Audience
                  <span className="text-[10px] text-zinc-500 ml-1.5">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.audienceCustomNotes}
                  onChange={(e) => setForm({ ...form, audienceCustomNotes: e.target.value })}
                  placeholder="e.g. Interviewer is ex-Amazon Principal Engineer who is obsessed with high availability and metrics."
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700/70 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Response Style */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <MessageSquareQuote className="w-3.5 h-3.5 text-cyan-400" />
                  <span>How Should Answers Be Structured?</span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {STYLE_OPTIONS.map((style) => {
                    const isSelected = form.responseStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setForm({ ...form, responseStyle: style.id })}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-zinc-800 border-cyan-500/50 shadow-sm'
                            : 'bg-zinc-900/60 hover:bg-zinc-800/40 border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-zinc-100">{style.label}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-700/60 text-zinc-300 font-mono">
                            {style.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-snug">{style.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════ TAB 4: LIVE AI PREVIEW ════ */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    Compiled Context Injected into AI System Instructions
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                  <span>{wordCount} words</span>
                  <span>•</span>
                  <span>~{Math.round(previewText.length / 4)} tokens</span>
                </div>
              </div>

              <div
                className="p-3 rounded-xl border bg-black/60 font-mono text-[11px] leading-relaxed text-zinc-300 overflow-x-auto whitespace-pre-wrap select-text max-h-[360px]"
                style={{
                  borderColor: form.enabled ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                }}
              >
                {previewText}
              </div>

              <div
                className="p-3 rounded-xl text-[11px] leading-relaxed"
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  color: '#6ee7b7',
                }}
              >
                <strong>✓ Auto-Injected Across All Modes:</strong> When enabled, this context block is automatically included in all text chat prompts, screen vision analysis, and meeting audio answers ("What to answer?") across Gemini, Groq, OpenRouter, and custom router models.
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div
          className="shrink-0 px-4 py-3 flex items-center justify-between border-t"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            borderColor: 'rgba(255, 255, 255, 0.07)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                form.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
              }`}
            />
            <span className="text-xs text-zinc-400">
              {form.enabled
                ? `Context Active • ${form.targetRole || form.candidateTitle || 'Candidate'} (${form.audienceType})`
                : 'Context Inactive • Normal Assistant Mode'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-white shadow-md transition-all hover:brightness-110 active:scale-95"
              style={{
                background: form.enabled
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
              }}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Apply</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
