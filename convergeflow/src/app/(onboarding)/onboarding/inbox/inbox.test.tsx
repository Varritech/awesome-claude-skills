/**
 * Component test for the onboarding inbox step. Guards the payload that reaches
 * POST /api/inboxes for each provider — the boundary the connect flow depends on.
 * Previously the custom option posted { provider: "custom", credentials } which
 * fails schema validation (invalid provider + wrong shape) and silently dropped
 * the connection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ apiPost: vi.fn(), push: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiPost: mocks.apiPost,
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

import InboxPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiPost.mockResolvedValue({ authUrl: null });
});

describe('Onboarding inbox step', () => {
  it('posts a bare gmail provider (OAuth resolves the rest later)', async () => {
    render(<InboxPage />);
    fireEvent.click(screen.getByText('Connect Gmail'));
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() =>
      expect(mocks.apiPost).toHaveBeenCalledWith('/api/inboxes', { provider: 'gmail' })
    );
  });

  it('posts a schema-valid smtp_imap payload for a custom provider', async () => {
    render(<InboxPage />);
    fireEvent.click(screen.getByText('Other provider'));

    fireEvent.change(screen.getByPlaceholderText('smtp.example.com'), { target: { value: 'smtp.mail.com' } });
    fireEvent.change(screen.getByPlaceholderText('imap.example.com'), { target: { value: 'imap.mail.com' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'me@mail.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your email password'), { target: { value: 'secret' } });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalled());

    const [path, payload] = mocks.apiPost.mock.calls[0];
    expect(path).toBe('/api/inboxes');
    expect(payload).toMatchObject({
      provider: 'smtp_imap',
      email: 'me@mail.com',
      smtp: { host: 'smtp.mail.com', port: 587, user: 'me@mail.com', password: 'secret' },
      imap: { host: 'imap.mail.com', port: 993, user: 'me@mail.com', password: 'secret' },
    });
    // must NOT use the old invalid shape
    expect(payload).not.toHaveProperty('credentials');
    expect(payload.provider).not.toBe('custom');
  });
});
