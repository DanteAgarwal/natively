// ---------------------------------------------------------------------------
// Model Registry — Benchmark Harness
// PRD §6.4 FR-21, §10 SEC-04
//
// Runs standardized non-sensitive test prompts across models to measure
// latency, token throughput, and task-specific adherence.
// Never uses private user conversations (FR-21).
// ---------------------------------------------------------------------------

import { ModelRecord, TaskProfile } from './types';
import { providerRegistry } from './providerAdapters/providerRegistry';

export interface BenchmarkPrompt {
  id: string;
  taskProfile: TaskProfile;
  prompt: string;
  expectedModality: string;
  validator: (output: string) => boolean;
}

export const BENCHMARK_SUITE: BenchmarkPrompt[] = [
  {
    id: 'bench_fast_text',
    taskProfile: 'fast_text',
    prompt: 'In exactly one sentence, what is the capital of France?',
    expectedModality: 'text',
    validator: (text) => text.toLowerCase().includes('paris'),
  },
  {
    id: 'bench_reasoning',
    taskProfile: 'reasoning',
    prompt: 'Alice is older than Bob. Charlie is younger than Bob. Who is the oldest? Answer in one word.',
    expectedModality: 'text',
    validator: (text) => text.toLowerCase().includes('alice'),
  },
  {
    id: 'bench_coding',
    taskProfile: 'coding',
    prompt: 'Write a TypeScript function named reverseString that reverses a string. Return only code.',
    expectedModality: 'text',
    validator: (text) => text.includes('function reverseString') || text.includes('reverseString ='),
  },
  {
    id: 'bench_json',
    taskProfile: 'json',
    prompt: 'Output a valid JSON object with keys "status" and "code". Return only JSON.',
    expectedModality: 'json',
    validator: (text) => {
      try {
        const parsed = JSON.parse(text.trim().replace(/^```json|```$/g, ''));
        return parsed && typeof parsed === 'object' && 'status' in parsed;
      } catch {
        return false;
      }
    },
  },
];

export interface BenchmarkScore {
  modelId: string;
  providerId: string;
  promptId: string;
  taskProfile: TaskProfile;
  latencyMs: number;
  tokensGenerated?: number;
  passedValidation: boolean;
  outputPreview: string;
  timestamp: number;
}

export class BenchmarkHarness {
  private results: BenchmarkScore[] = [];

  /**
   * Run a specific benchmark prompt against a model
   */
  async runSingleBenchmark(model: ModelRecord, prompt: BenchmarkPrompt): Promise<BenchmarkScore> {
    const adapter = providerRegistry.getAdapter(model.providerId);
    const start = Date.now();

    try {
      const res = await adapter.invoke({
        modelId: model.modelId,
        prompt: prompt.prompt,
        temperature: 0.1,
        maxTokens: 300,
      });

      const latencyMs = Date.now() - start;
      const passedValidation = prompt.validator(res.text);

      const score: BenchmarkScore = {
        modelId: model.modelId,
        providerId: model.providerId,
        promptId: prompt.id,
        taskProfile: prompt.taskProfile,
        latencyMs,
        tokensGenerated: res.usage?.completionTokens,
        passedValidation,
        outputPreview: res.text.slice(0, 100),
        timestamp: Date.now(),
      };

      this.results.push(score);
      return score;
    } catch (err: any) {
      const score: BenchmarkScore = {
        modelId: model.modelId,
        providerId: model.providerId,
        promptId: prompt.id,
        taskProfile: prompt.taskProfile,
        latencyMs: Date.now() - start,
        passedValidation: false,
        outputPreview: `Error: ${err.message}`,
        timestamp: Date.now(),
      };
      this.results.push(score);
      return score;
    }
  }

  /**
   * Run the complete standard benchmark suite across a model
   */
  async runSuite(model: ModelRecord): Promise<BenchmarkScore[]> {
    const suiteResults: BenchmarkScore[] = [];
    for (const prompt of BENCHMARK_SUITE) {
      const result = await this.runSingleBenchmark(model, prompt);
      suiteResults.push(result);
    }
    return suiteResults;
  }

  /**
   * Get historical benchmark results
   */
  getResults(): BenchmarkScore[] {
    return [...this.results];
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const benchmarkHarness = new BenchmarkHarness();
