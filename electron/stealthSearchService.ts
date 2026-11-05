// ---------------------------------------------------------------------------
// Stealth Search Service — In-Process Hybrid Search
// Zero child processes, zero console windows, 100% in-memory & encrypted HTTPS.
//
// Capabilities:
//   1. Live Web Search:
//      - Approach 1: Gemini Cloud-Native Grounding (in geminiService)
//      - Approach 2: In-Process Zero-Key DuckDuckGo Lite or Brave Search API
//   2. Meeting & History Search:
//      - Search rolling audio transcripts & chat dialogue
//   3. Local File & Codebase Search:
//      - Fast in-memory asynchronous file & content search
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { nativeAudioService, TranscriptItem } from './nativeAudioService';
import { configService } from './storeService';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'duckduckgo' | 'brave';
}

export interface MeetingSearchResult {
  id: string;
  speaker: 'meeting' | 'user';
  text: string;
  timestamp: number;
  formattedTime: string;
  matchSnippet?: string;
}

export interface CodebaseSearchResult {
  filePath: string;
  relativePath: string;
  lineNumber: number;
  lineContent: string;
  preview: string;
  matchType: 'content' | 'filename';
}

export interface UniversalSearchResults {
  query: string;
  webResults: WebSearchResult[];
  meetingResults: MeetingSearchResult[];
  codebaseResults: CodebaseSearchResult[];
  searchTimeMs: number;
}

// Common directories to skip for codebase search
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  '.next',
  '.turbo',
  'dist',
  'dist-electron',
  'build',
  'release',
  'coverage',
  'target',
  'bin',
  'obj',
  '.vscode',
  '.idea',
  '__pycache__',
  '.venv',
  'venv',
  'vendor',
  '.cache',
]);

// Binary/media file extensions to skip for content search
const IGNORED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.mp3',
  '.wav',
  '.ogg',
  '.mp4',
  '.webm',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.7z',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.node',
  '.wasm',
  '.bin',
  '.lock',
]);

export class StealthSearchService {
  /**
   * ── Pillar 1: In-Process Web Search (Zero-Key DuckDuckGo / Brave) ──
   * Pure Node.js HTTPS fetch — zero console windows, zero child processes.
   */
  public async searchWeb(query: string, maxResults: number = 5): Promise<WebSearchResult[]> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return [];

    const config = configService.getConfig();
    const braveApiKey = (config.braveApiKey || process.env.BRAVE_API_KEY || '').trim();

    // 1. Try Brave Search API if an explicit key is provided
    if (braveApiKey) {
      try {
        const braveResults = await this.searchBrave(cleanQuery, braveApiKey, maxResults);
        if (braveResults.length > 0) return braveResults;
      } catch (err: any) {
        console.warn('[StealthSearch] Brave search failed, falling back to in-process DuckDuckGo:', err?.message || err);
      }
    }

    // 2. Default Zero-Key In-Process DuckDuckGo Lite search
    return await this.searchDuckDuckGo(cleanQuery, maxResults);
  }

  /**
   * Zero-Key In-Process DuckDuckGo Lite fetch
   */
  private async searchDuckDuckGo(query: string, maxResults: number = 5): Promise<WebSearchResult[]> {
    try {
      const response = await fetch('https://lite.duckduckgo.com/lite/', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml',
        },
        body: `q=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo responded with HTTP ${response.status}`);
      }

      const html = await response.text();
      const results: WebSearchResult[] = [];

      const linkRegex = /<a[^>]*href="([^"]+)"[^>]*class='result-link'>([\s\S]*?)<\/a>/g;
      const snippetRegex = /<td class='result-snippet'>([\s\S]*?)<\/td>/g;

      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = linkRegex.exec(html)) !== null && results.length < maxResults) {
        const snippetMatch = snippetRegex.exec(html);
        const rawUrl = linkMatch[1];
        const rawTitle = linkMatch[2];
        const rawSnippet = snippetMatch ? snippetMatch[1] : '';

        // Clean HTML entities and tags
        const cleanTitle = rawTitle.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
        const cleanSnippet = rawSnippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();

        if (cleanTitle && rawUrl) {
          results.push({
            title: cleanTitle,
            url: rawUrl,
            snippet: cleanSnippet || cleanTitle,
            source: 'duckduckgo',
          });
        }
      }

      return results;
    } catch (err: any) {
      console.warn('[StealthSearch] DuckDuckGo search error:', err?.message || err);
      return [];
    }
  }

  /**
   * Optional Brave Search API
   */
  private async searchBrave(query: string, apiKey: string, maxResults: number = 5): Promise<WebSearchResult[]> {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    const webResults = data?.web?.results || [];

    return webResults.slice(0, maxResults).map((r: any) => ({
      title: r.title || 'Untitled',
      url: r.url,
      snippet: r.description || '',
      source: 'brave' as const,
    }));
  }

  /**
   * ── Pillar 2: Meeting & History Search ──
   * Searches live rolling transcripts and meeting dialogue in-memory.
   */
  public searchMeetingHistory(query: string, maxResults: number = 10): MeetingSearchResult[] {
    const cleanQuery = (query || '').toLowerCase().trim();
    if (!cleanQuery) return [];

    const tokens = cleanQuery.split(/\s+/).filter(Boolean);
    const transcript = nativeAudioService.getRollingTranscript();
    const matches: MeetingSearchResult[] = [];

    for (const item of transcript) {
      const lowerText = item.text.toLowerCase();
      // Check if text matches all or any query tokens
      const matchesAll = tokens.every((token) => lowerText.includes(token));
      const matchesAny = tokens.some((token) => lowerText.includes(token));

      if (matchesAll || matchesAny) {
        const date = new Date(item.timestamp);
        const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        matches.push({
          id: item.id,
          speaker: item.speaker,
          text: item.text,
          timestamp: item.timestamp,
          formattedTime,
          matchSnippet: item.text,
        });

        if (matches.length >= maxResults) break;
      }
    }

    return matches;
  }

  /**
   * ── Pillar 3: Local File & Codebase Search ──
   * Fast, safe in-process file & content search without spawning child processes.
   */
  public async searchCodebase(
    query: string,
    options: {
      rootDir?: string;
      maxMatches?: number;
      filePattern?: string;
    } = {}
  ): Promise<CodebaseSearchResult[]> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return [];

    const config = configService.getConfig();
    const rootDir = options.rootDir || config.codebasePath || process.cwd();
    const maxMatches = options.maxMatches || 15;
    const lowerQuery = cleanQuery.toLowerCase();

    const results: CodebaseSearchResult[] = [];
    let filesScanned = 0;
    const MAX_FILES_TO_SCAN = 400; // Protection against infinite directory recursion
    const MAX_FILE_SIZE_BYTES = 300 * 1024; // 300 KB limit per file

    const walk = async (currentDir: string): Promise<void> => {
      if (filesScanned >= MAX_FILES_TO_SCAN || results.length >= maxMatches) return;

      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (filesScanned >= MAX_FILES_TO_SCAN || results.length >= maxMatches) break;

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (IGNORED_EXTENSIONS.has(ext)) continue;

          filesScanned++;
          const relativePath = path.relative(rootDir, fullPath);

          // 1. Filename match
          if (entry.name.toLowerCase().includes(lowerQuery)) {
            results.push({
              filePath: fullPath,
              relativePath,
              lineNumber: 1,
              lineContent: entry.name,
              preview: `Matching file: ${relativePath}`,
              matchType: 'filename',
            });
            if (results.length >= maxMatches) return;
          }

          // 2. Content match (for reasonably sized text files)
          try {
            const stats = await fs.promises.stat(fullPath);
            if (stats.size > MAX_FILE_SIZE_BYTES || stats.size === 0) continue;

            const content = await fs.promises.readFile(fullPath, 'utf8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxMatches) break;

              const line = lines[i];
              if (line.toLowerCase().includes(lowerQuery)) {
                // Grab surrounding 1 line context
                const start = Math.max(0, i - 1);
                const end = Math.min(lines.length, i + 2);
                const preview = lines
                  .slice(start, end)
                  .map((l, idx) => `${start + idx + 1}: ${l}`)
                  .join('\n');

                results.push({
                  filePath: fullPath,
                  relativePath,
                  lineNumber: i + 1,
                  lineContent: line.trim(),
                  preview,
                  matchType: 'content',
                });
              }
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    };

    try {
      if (fs.existsSync(rootDir)) {
        await walk(rootDir);
      }
    } catch (err: any) {
      console.warn('[StealthSearch] Codebase search error:', err?.message || err);
    }

    return results;
  }

  /**
   * ── Universal Hybrid Search ──
   * Searches Web, Meeting History, and Codebase simultaneously.
   */
  public async universalSearch(query: string): Promise<UniversalSearchResults> {
    const startTime = Date.now();
    const cleanQuery = (query || '').trim();

    // Check query directives: @web, @code, @meeting
    const isExplicitWeb = cleanQuery.startsWith('@web');
    const isExplicitCode = cleanQuery.startsWith('@code') || cleanQuery.startsWith('@file');
    const isExplicitMeeting = cleanQuery.startsWith('@meeting') || cleanQuery.startsWith('@notes');

    const strippedQuery = cleanQuery.replace(/^@(web|code|file|meeting|notes)\s*/i, '').trim();
    const searchQuery = strippedQuery || cleanQuery;

    let webResults: WebSearchResult[] = [];
    let meetingResults: MeetingSearchResult[] = [];
    let codebaseResults: CodebaseSearchResult[] = [];

    if (isExplicitWeb) {
      webResults = await this.searchWeb(searchQuery, 6);
    } else if (isExplicitCode) {
      codebaseResults = await this.searchCodebase(searchQuery, { maxMatches: 12 });
    } else if (isExplicitMeeting) {
      meetingResults = this.searchMeetingHistory(searchQuery, 10);
    } else {
      // Hybrid parallel execution
      const [web, code] = await Promise.all([
        this.searchWeb(searchQuery, 4),
        this.searchCodebase(searchQuery, { maxMatches: 5 }),
      ]);
      webResults = web;
      codebaseResults = code;
      meetingResults = this.searchMeetingHistory(searchQuery, 5);
    }

    return {
      query: searchQuery,
      webResults,
      meetingResults,
      codebaseResults,
      searchTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Formats search results into a clean markdown context block
   * for injecting into LLM prompts without exceeding token limits.
   */
  public formatSearchResultsForPrompt(results: UniversalSearchResults): string {
    const parts: string[] = [];

    if (results.webResults.length > 0) {
      parts.push('### 🌐 Live Web Search Results:');
      results.webResults.forEach((r, idx) => {
        parts.push(`[${idx + 1}] **${r.title}** (${r.url})\n${r.snippet}`);
      });
    }

    if (results.meetingResults.length > 0) {
      parts.push('\n### 📝 Relevant Meeting & Transcript Dialogue:');
      results.meetingResults.forEach((m) => {
        const speakerLabel = m.speaker === 'meeting' ? 'Speaker/Participant' : 'You (Microphone)';
        parts.push(`- [${m.formattedTime}] ${speakerLabel}: "${m.text}"`);
      });
    }

    if (results.codebaseResults.length > 0) {
      parts.push('\n### 💻 Local Codebase & File Matches:');
      results.codebaseResults.forEach((c) => {
        parts.push(`File: \`${c.relativePath}\` (Line ${c.lineNumber}):\n\`\`\`\n${c.preview}\n\`\`\``);
      });
    }

    if (parts.length === 0) return '';

    return (
      '\n\n[STEALTH SEARCH CONTEXT - Use the following verified real-time sources to answer accurately]:\n' +
      parts.join('\n') +
      '\n[END STEALTH SEARCH CONTEXT]\n\n'
    );
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────
export const stealthSearchService = new StealthSearchService();

