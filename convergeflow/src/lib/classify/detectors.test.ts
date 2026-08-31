import { describe, it, expect } from 'vitest';
import { isAutoReply, autoReplyReason } from './detectors';
import type { EmailHeaders } from '@/lib/imap/client';

function headers(overrides: Partial<EmailHeaders> = {}): EmailHeaders {
  return {
    subject: '',
    from: '',
    to: '',
    messageId: '',
    ...overrides,
  };
}

describe('isAutoReply', () => {
  describe('header-based detection', () => {
    it('detects Auto-Submitted: auto-replied', () => {
      expect(isAutoReply(headers({ 'auto-submitted': 'auto-replied' }), '')).toBe(true);
    });

    it('detects X-Autoreply: yes', () => {
      expect(isAutoReply(headers({ 'x-autoreply': 'yes' }), '')).toBe(true);
    });

    it('detects Precedence: auto_reply', () => {
      expect(isAutoReply(headers({ precedence: 'auto_reply' }), '')).toBe(true);
    });

    it('detects Precedence: bulk', () => {
      expect(isAutoReply(headers({ precedence: 'bulk' }), '')).toBe(true);
    });

    it('detects X-Auto-Response-Suppress: OOF', () => {
      expect(isAutoReply(headers({ 'x-auto-response-suppress': 'OOF' }), '')).toBe(true);
    });

    it('does not flag normal headers', () => {
      expect(isAutoReply(headers({ subject: 'Hey, let us chat' }), '')).toBe(false);
    });
  });

  describe('subject-based detection', () => {
    it('detects "Automatic reply:" prefix', () => {
      expect(isAutoReply(headers({ subject: 'Automatic reply: Your email' }), '')).toBe(true);
    });

    it('detects "Out of Office" subject', () => {
      expect(isAutoReply(headers({ subject: 'Out of Office: Back Monday' }), '')).toBe(true);
    });

    it('detects "Vacation responder" subject', () => {
      expect(isAutoReply(headers({ subject: 'Vacation Responder' }), '')).toBe(true);
    });

    it('detects "Re: Out of Office" subject', () => {
      expect(isAutoReply(headers({ subject: 'Re: Out of Office' }), '')).toBe(true);
    });

    it('does not flag normal subjects', () => {
      expect(isAutoReply(headers({ subject: 'Re: Quick question' }), '')).toBe(false);
    });
  });

  describe('body-based detection', () => {
    it('detects "I am currently out of the office"', () => {
      expect(isAutoReply(headers(), 'I am currently out of the office until Monday.')).toBe(true);
    });

    it('detects "I will be back on"', () => {
      expect(isAutoReply(headers(), 'Thank you for your email. I will be back on July 25th.')).toBe(true);
    });

    it('detects "This is an automated reply"', () => {
      expect(isAutoReply(headers(), 'This is an automated reply. I am away from my desk.')).toBe(true);
    });

    it('detects "limited access to email"', () => {
      expect(isAutoReply(headers(), 'I have limited access to email and will respond upon my return.')).toBe(true);
    });

    it('does not flag normal body text', () => {
      expect(isAutoReply(headers(), 'Hey, thanks for reaching out. Let us schedule a call.')).toBe(false);
    });

    it('only checks first 500 chars', () => {
      const prefix = 'a'.repeat(600);
      const body = prefix + '\nI am currently out of the office.';
      expect(isAutoReply(headers(), body)).toBe(false);
    });
  });

  describe('bounce/daemon detection', () => {
    it('detects mailer-daemon from address', () => {
      expect(isAutoReply(headers({ from: 'mailer-daemon@google.com' }), '')).toBe(true);
    });

    it('detects postmaster from address', () => {
      expect(isAutoReply(headers({ from: 'postmaster@example.com' }), '')).toBe(true);
    });

    it('detects mailer-daemon in return-path', () => {
      expect(isAutoReply(headers({ 'return-path': '<mailer-daemon@example.com>' }), '')).toBe(true);
    });
  });

  describe('real-world OOO examples', () => {
    it('detects Google Workspace OOO', () => {
      const h = headers({
        subject: 'Vacation: John is out of office',
        'auto-submitted': 'auto-replied',
        'x-autorespond': 'yes',
      });
      const body = "I'm currently out of the office with limited access to email. I'll respond to your message when I return.";
      expect(isAutoReply(h, body)).toBe(true);
    });

    it('detects Outlook OOO', () => {
      const h = headers({
        subject: 'Automatic reply: Meeting follow-up',
      });
      const body = 'Thank you for your email. I am out of the office and will return on Monday, July 28.';
      expect(isAutoReply(h, body)).toBe(true);
    });

    it('does not flag a real human reply', () => {
      const h = headers({
        subject: 'Re: Quick question about ConvergeFlow',
        from: 'prospect@acme.com',
      });
      const body = 'Hey, this sounds interesting. Can we hop on a call Thursday at 2pm?';
      expect(isAutoReply(h, body)).toBe(false);
    });
  });
});

describe('autoReplyReason', () => {
  it('returns reason for auto-reply', () => {
    const reason = autoReplyReason(
      headers({ 'auto-submitted': 'auto-replied' }),
      '',
    );
    expect(reason).toBe('auto-reply headers detected');
  });

  it('returns null for normal email', () => {
    const reason = autoReplyReason(
      headers({ subject: 'Hey!' }),
      'Let us chat soon.',
    );
    expect(reason).toBeNull();
  });
});
