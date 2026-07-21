import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyReplyPipeline, categoryLabel, categoryBadgeColor, categoryChartColor } from './pipeline';
import type { FetchedReply } from '@/lib/imap/client';

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

function makeReply(overrides: Partial<FetchedReply> = {}): FetchedReply {
  return {
    uid: 1,
    headers: {
      subject: 'Re: Quick question',
      from: 'prospect@acme.com',
      to: 'sender@convergeflow.io',
      messageId: '<abc123@acme.com>',
      inReplyTo: '<xyz789@convergeflow.io>',
    },
    bodyText: 'Hey, this sounds interesting!',
    receivedAt: new Date(),
    ...overrides,
  };
}

describe('classifyReplyPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('short-circuits on auto-reply headers (no AI call)', async () => {
    const reply = makeReply({
      headers: {
        subject: 'Automatic reply: Out of Office',
        from: 'prospect@acme.com',
        'auto-submitted': 'auto-replied',
      },
      bodyText: 'I am out of the office.',
    });

    const result = await classifyReplyPipeline(reply);
    expect(result.category).toBe('auto_reply');
    expect(result.confidence).toBe('high');
    expect(result.usedAi).toBe(false);
    expect(ollamaClient.chat).not.toHaveBeenCalled();
  });

  it('short-circuits on auto-reply body (no AI call)', async () => {
    const reply = makeReply({
      bodyText: 'I am currently out of the office and will return on Monday.',
    });

    const result = await classifyReplyPipeline(reply);
    expect(result.category).toBe('auto_reply');
    expect(result.usedAi).toBe(false);
  });

  it('uses AI for real human replies', async () => {
    vi.mocked(ollamaClient.chat).mockResolvedValueOnce('interested');
    const reply = makeReply({
      bodyText: 'This sounds great! Can we schedule a call?',
    });

    const result = await classifyReplyPipeline(reply);
    expect(result.category).toBe('interested');
    expect(result.usedAi).toBe(true);
    expect(ollamaClient.chat).toHaveBeenCalled();
  });

  it('falls back to keywords when AI fails', async () => {
    vi.mocked(ollamaClient.chat).mockRejectedValueOnce(new Error('down'));
    const reply = makeReply({
      bodyText: 'Yes, let us book a call Thursday at 2pm.',
    });

    const result = await classifyReplyPipeline(reply);
    expect(result.category).toBe('booked');
    expect(result.usedAi).toBe(false);
  });

  it('passes context to AI classifier', async () => {
    vi.mocked(ollamaClient.chat).mockResolvedValueOnce('interested');
    const reply = makeReply();

    await classifyReplyPipeline(reply, {
      leadName: 'Alex',
      originalEmail: 'Hey Alex, want to chat about ConvergeFlow?',
    });

    const callArgs = vi.mocked(ollamaClient.chat).mock.calls[0]![0];
    const userMessage = callArgs.find((m) => m.role === 'user')?.content ?? '';
    expect(userMessage).toContain('Alex');
    expect(userMessage).toContain('ConvergeFlow');
  });
});

describe('categoryLabel', () => {
  it('returns human-readable labels', () => {
    expect(categoryLabel('interested')).toBe('Interested');
    expect(categoryLabel('booked')).toBe('Booked');
    expect(categoryLabel('question')).toBe('Question');
    expect(categoryLabel('not_interested')).toBe('Not Interested');
    expect(categoryLabel('auto_reply')).toBe('Auto Reply');
  });
});

describe('categoryBadgeColor', () => {
  it('returns mint for positive categories', () => {
    expect(categoryBadgeColor('interested')).toBe('mint');
    expect(categoryBadgeColor('booked')).toBe('mint');
  });

  it('returns default for neutral/negative categories', () => {
    expect(categoryBadgeColor('question')).toBe('default');
    expect(categoryBadgeColor('not_interested')).toBe('default');
    expect(categoryBadgeColor('auto_reply')).toBe('default');
  });
});

describe('categoryChartColor', () => {
  it('returns distinct colors for each category', () => {
    const colors = new Set([
      categoryChartColor('interested'),
      categoryChartColor('booked'),
      categoryChartColor('question'),
      categoryChartColor('not_interested'),
      categoryChartColor('auto_reply'),
    ]);
    expect(colors.size).toBe(5);
  });
});
