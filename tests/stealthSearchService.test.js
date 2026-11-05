const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { stealthSearchService } = require('../dist-electron/stealthSearchService');
const { nativeAudioService } = require('../dist-electron/nativeAudioService');

test('StealthSearchService - Meeting dialogue search', () => {
  // Add test transcript item
  nativeAudioService.addTranscriptItem({
    id: 'test-transcript-item-1',
    speaker: 'meeting',
    text: 'We should deploy the architecture changes to AWS this Friday',
    timestamp: Date.now(),
  });

  const results = stealthSearchService.searchMeetingHistory('architecture AWS');
  assert.ok(Array.isArray(results), 'Should return an array');
  assert.ok(results.length > 0, 'Should find the added meeting item');
  assert.strictEqual(results[0].speaker, 'meeting');
  assert.ok(results[0].text.includes('deploy the architecture'));
});

test('StealthSearchService - Local Codebase search (in-process, zero child processes)', async () => {
  const rootDir = path.resolve(__dirname, '..');
  const results = await stealthSearchService.searchCodebase('stealthSearchService', { rootDir, maxMatches: 5 });

  assert.ok(Array.isArray(results), 'Should return an array');
  assert.ok(results.length > 0, 'Should find matches in the repository');
  const match = results.find(r => r.relativePath.includes('main.ts') || r.relativePath.includes('stealthSearchService.ts'));
  assert.ok(match, 'Should find references to stealthSearchService in project source');
});

test('StealthSearchService - Directives routing (@web, @code, @meeting)', async () => {
  const codeSearch = await stealthSearchService.universalSearch('@code stealthSearchService');
  assert.strictEqual(codeSearch.query, 'stealthSearchService');
  assert.ok(codeSearch.codebaseResults.length > 0, 'Code directive should populate codebaseResults');

  const meetingSearch = await stealthSearchService.universalSearch('@meeting deploy');
  assert.strictEqual(meetingSearch.query, 'deploy');
  assert.ok(meetingSearch.meetingResults.length > 0, 'Meeting directive should populate meetingResults');
});

test('StealthSearchService - Prompt augmentation formatting', () => {
  const dummyResults = {
    query: 'test query',
    webResults: [
      {
        title: 'Electron Desktop Apps',
        url: 'https://electronjs.org',
        snippet: 'Framework for building desktop apps with JavaScript.',
        source: 'duckduckgo',
      },
    ],
    meetingResults: [
      {
        id: '1',
        speaker: 'meeting',
        text: 'Action item: review the PR by 5 PM',
        timestamp: Date.now(),
        formattedTime: '10:30:00 AM',
      },
    ],
    codebaseResults: [
      {
        filePath: 'C:/test/main.ts',
        relativePath: 'electron/main.ts',
        lineNumber: 42,
        lineContent: 'const mainWindow = null;',
        preview: '41: let app;\n42: const mainWindow = null;',
        matchType: 'content',
      },
    ],
    searchTimeMs: 15,
  };

  const context = stealthSearchService.formatSearchResultsForPrompt(dummyResults);
  assert.ok(context.includes('STEALTH SEARCH CONTEXT'), 'Should include context opening header');
  assert.ok(context.includes('Electron Desktop Apps'), 'Should include web title');
  assert.ok(context.includes('https://electronjs.org'), 'Should include web URL');
  assert.ok(context.includes('Action item: review the PR'), 'Should include meeting dialogue');
  assert.ok(context.includes('electron/main.ts'), 'Should include codebase file path');
});

