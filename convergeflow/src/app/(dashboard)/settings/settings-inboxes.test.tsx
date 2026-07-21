/**
 * Component test: the Settings page "Connected Inboxes" section must read from
 * the real inbox source (GET /api/inboxes), not from profile.inboxes (which the
 * connect flow never populates). Regression guard for the bug where a connected
 * Gmail account showed "No inboxes connected yet."
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), apiPatch: vi.fn(), apiPost: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiGet: mocks.apiGet,
  apiPatch: mocks.apiPatch,
  apiPost: mocks.apiPost,
}));

import SettingsPage from './page';

const PROFILE = {
  fullName: 'Cristiano Varriale',
  email: 'christian@varritech.com',
  inboxes: [], // profile carries no inboxes — the section must NOT rely on this
};

function routeApiGet(inboxes: unknown[]) {
  mocks.apiGet.mockImplementation((path: string) => {
    if (path === '/api/user/profile') return Promise.resolve(PROFILE);
    if (path === '/api/inboxes') return Promise.resolve(inboxes);
    return Promise.resolve(null);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Settings — Connected Inboxes', () => {
  it('lists inboxes returned by GET /api/inboxes', async () => {
    routeApiGet([
      { id: 'ib_1', email: 'me@varritech.com', provider: 'gmail', status: 'connected' },
    ]);

    render(<SettingsPage />);

    expect(await screen.findByText('me@varritech.com')).toBeInTheDocument();
    expect(screen.queryByText('No inboxes connected yet.')).not.toBeInTheDocument();
    expect(mocks.apiGet).toHaveBeenCalledWith('/api/inboxes');
  });

  it('maps a warming inbox to a connected (green) state', async () => {
    routeApiGet([
      { id: 'ib_2', email: 'warm@varritech.com', provider: 'gmail', status: 'warming' },
    ]);

    render(<SettingsPage />);

    expect(await screen.findByText('warm@varritech.com')).toBeInTheDocument();
    // status line should read "<provider> · Connected", not Error, for a warming mailbox
    expect(
      screen.getByText((_, el) => el?.textContent === 'gmail · Connected')
    ).toBeInTheDocument();
  });

  it('shows the empty state when GET /api/inboxes returns none', async () => {
    routeApiGet([]);

    render(<SettingsPage />);

    expect(await screen.findByText('No inboxes connected yet.')).toBeInTheDocument();
  });

  it('Add Inbox → Connect actually calls POST /api/inboxes (was a no-op)', async () => {
    routeApiGet([]);
    mocks.apiPost.mockResolvedValue({ authUrl: null }); // avoid real navigation in test

    render(<SettingsPage />);
    await screen.findByText('No inboxes connected yet.');

    fireEvent.click(screen.getByText('+ Add Inbox'));
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() =>
      expect(mocks.apiPost).toHaveBeenCalledWith('/api/inboxes', { provider: 'gmail' })
    );
  });
});
