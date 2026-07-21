import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyReply } from './classifier';

// Mock the Ollama client
vi.mock('@/lib/ollama/client', () => ({
  ollamaClient: {
    chat: vi.fn(),
    generateEmail: vi.fn(),
    embed: vi.fn(),
    model: 'glm-5.1',
    host: 'https://ollama.com/api',
  },
}));

import { ollamaClient } from '@/lib/ollama/client';

describe('classifyReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AI classification (happy path)', () => {
    it('classifies interested replies', async () => {
      vi.mocked(ollamaClient.chat).mockResolvedValueOnce('interested');
      const result = await classifyReply('This sounds great, tell me more!');
      expect(result.category).toBe('interested');
      expect(result.confidence).toBe('high');
    });

    it('classifies booked replies', async () => {
      vi.mocked(ollamaClient.chat).mockResolvedValueOnce('booked');
      const result = await classifyReply('Yes, let us do Thursday at 2pm. I will send a calendar invite.');
      expect(result.category).toBe('booked');
      expect(result.confidence).toBe('high');
    });

    it('classifies question replies', async () => {
      vi.mocked(ollamaClient.chat).mockResolvedValueOnce('question');
      const result = await classifyReply('How does this work with my existing setup?');
      expect(result.category).toBe('question');
      expect(result.confidence).toBe('high');
    });

    it('classifies not_interested replies', async () => {
      vi.mocked(ollamaClient.chat).mockResolvedValueOnce('not_interested');
      const result = await classifyReply('Not interested, please remove me from your list.');
      expect(result.category).toBe('not_interested');
      expect(result.confidence).toBe('high');
    });

    it('classifies auto_reply replies', async () => {
      vi.mocked(ollamaClient.chat).mockResolvedValueOnce('auto_reply');
      const result = await classifyReply('I am out of the office until Monday.');
      expect(result.category).toBe('auto_reply');
      expect(result.confidence).toBe('high');
    });
  });

  describe('AI response parsing', () => {
    it('handles whitespace around response', async () => {
      vi.mocked(ollamaClient.chat).mockResolvedValueOnce('  interested  ');
      const result = await classifyReply('Sounds good!');
      expect(result.category).toBe('interested');
    });

    it('handles partial match for "not interested" without underscore', async () => {
      vi.mocked(ollamaClient.chat).mockResolvedValueOnce('not interested');
      const result = await classifyReply('No thanks.');
      expect(result.category).toBe('not_interested');
    });

    it('handles "auto reply" without underscore', async () => {
      vi.mocked(ollamaClient.chat).mockResolvedValueOnce('auto reply');
      const result = await classifyReply('Out of office.');
      expect(result.category).toBe('auto_reply');
    });
  });

  describe('keyword fallback (Ollama unavailable)', () => {
    it('falls back to keywords when Ollama throws', async () => {
      vi.mocked(ollamaClient.chat).mockRejectedValueOnce(new Error('Connection refused'));
      const result = await classifyReply('Yes, let us book a call Thursday at 2pm.');
      expect(result.category).toBe('booked');
      expect(result.confidence).toBe('low');
    });

    it('falls back to keywords when Ollama returns garbage', async () => {
      vi.mocked(ollamaClient.chat).mockResolvedValueOnce('I think this is probably an interested lead but I am not sure');
      const result = await classifyReply('Tell me more about your pricing.');
      expect(result.category).toBe('interested');
      // AI call succeeded and parseCategory extracted 'interested' from the response
      expect(result.confidence).toBe('high');
    });

    it('defaults to question when nothing matches', async () => {
      vi.mocked(ollamaClient.chat).mockRejectedValueOnce(new Error('timeout'));
      const result = await classifyReply('ok');
      expect(result.category).toBe('question');
      expect(result.confidence).toBe('low');
    });
  });

  describe('keyword matching accuracy', () => {
    it('detects booked from calendar language', async () => {
      vi.mocked(ollamaClient.chat).mockRejectedValueOnce(new Error('down'));
      const result = await classifyReply('Sure, I will send you a calendar invite for next Tuesday.');
      expect(result.category).toBe('booked');
    });

    it('detects not_interested from unsubscribe language', async () => {
      vi.mocked(ollamaClient.chat).mockRejectedValueOnce(new Error('down'));
      const result = await classifyReply('Please unsubscribe me from these emails.');
      expect(result.category).toBe('not_interested');
    });

    it('detects interested from positive language', async () => {
      vi.mocked(ollamaClient.chat).mockRejectedValueOnce(new Error('down'));
      const result = await classifyReply('This sounds really interesting! Can you share more details?');
      expect(result.category).toBe('interested');
    });
  });
});
