import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Privacy Policy — ConvergeFlow',
  description: 'How ConvergeFlow collects, uses, and protects your data.',
};

const LAST_UPDATED = 'June 15, 2026';
const CONTACT_EMAIL = 'support@convergeflow.com';
const COMPANY = 'Varritech Inc.';
const COMPANY_ADDRESS = '21 5th Ave, New York, NY 10175, United States';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cf-page">
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-cf-orange to-cf-orange-dark flex items-center justify-center">
              <LogoIcon size={18} className="text-white" />
            </div>
            <span className="text-[20px] font-bold tracking-tight italic font-heading">
              ConvergeFlow
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 text-[15px] leading-7 text-white/80">
        <h1 className="text-[36px] font-bold tracking-tight font-heading text-white mb-2">
          Privacy Policy
        </h1>
        <p className="text-white/50 mb-10">Last updated: {LAST_UPDATED}</p>

        <Section title="1. Who we are">
          <p>
            ConvergeFlow is a cold-email automation platform operated by {COMPANY},
            located at {COMPANY_ADDRESS}. References to &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;ConvergeFlow&rdquo; in this policy mean{' '}
            {COMPANY}.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p>We collect the following categories of information:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Account data</strong>: name, email address, profile photo,
              and authentication identifiers from providers you connect
              (Clerk, Google, Facebook, Microsoft, etc.).
            </li>
            <li>
              <strong>Inbox data</strong>: when you connect a Gmail, Outlook, or
              SMTP inbox, we store OAuth tokens or SMTP credentials needed to
              send mail on your behalf. We do not read your inbox beyond
              detecting replies to messages we sent.
            </li>
            <li>
              <strong>Campaign data</strong>: lead lists you upload, drafted
              messages, send status, opens, clicks, and replies.
            </li>
            <li>
              <strong>Billing data</strong>: handled by Stripe. We retain only
              the customer ID, subscription status, and last-four card digits.
            </li>
            <li>
              <strong>Usage data</strong>: standard logs (IP, user agent,
              timestamps) used for security and product analytics.
            </li>
          </ul>
        </Section>

        <Section title="3. How we use information">
          <ul className="list-disc pl-6 space-y-2">
            <li>To send cold-email campaigns you configure.</li>
            <li>To draft message variants using LLM providers (Ollama Cloud, OpenAI).</li>
            <li>To track deliverability, replies, and unsubscribes.</li>
            <li>To bill you for paid plans.</li>
            <li>To respond to support requests.</li>
            <li>To detect abuse and prevent spam.</li>
          </ul>
        </Section>

        <Section title="4. How we share information">
          <p>We share data only with sub-processors needed to operate the service:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li><strong>Clerk</strong> — authentication and session management.</li>
            <li><strong>Google Cloud / Firebase</strong> — database, storage, hosting.</li>
            <li><strong>Vercel</strong> — application hosting.</li>
            <li><strong>Stripe</strong> — payment processing.</li>
            <li><strong>Resend</strong> — email sending, domain authentication, deliverability webhooks.</li>
            <li><strong>Ollama Cloud, OpenAI</strong> — message drafting and embeddings.</li>
            <li><strong>Sentry</strong> — error monitoring.</li>
          </ul>
          <p className="mt-3">
            We do not sell your personal information. We do not share lead lists
            or message content with third parties for marketing.
          </p>
        </Section>

        <Section title="5. Data retention">
          <p>
            Account, campaign, and inbox data are retained for the life of your
            account. When you delete your account, we remove personal data
            within 30 days, except where retention is legally required (for
            example, billing records held for 7 years).
          </p>
        </Section>

        <Section title="6. Your rights">
          <p>
            You may access, correct, export, or delete your data at any time from
            Settings → Account, or by emailing{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-cf-orange underline">
              {CONTACT_EMAIL}
            </a>
            . If you are a resident of the EU, UK, or California, you also have
            rights under GDPR, UK-GDPR, and CCPA respectively, including the
            right to lodge a complaint with your data protection authority.
          </p>
        </Section>

        <Section title="7. Facebook Login data">
          <p>
            When you sign in with Facebook, we receive your name, email, and
            Facebook user ID through OAuth. We use this data only to create and
            authenticate your ConvergeFlow account. We do not post to Facebook,
            read your friends list, or store any other Facebook data. You can
            revoke access at{' '}
            <a
              href="https://www.facebook.com/settings?tab=applications"
              target="_blank"
              rel="noreferrer"
              className="text-cf-orange underline"
            >
              facebook.com/settings → Apps and Websites
            </a>{' '}
            at any time. To request deletion of Facebook-sourced data, see our{' '}
            <Link href="/data-deletion" className="text-cf-orange underline">
              Data Deletion Instructions
            </Link>
            .
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            Data is encrypted in transit (TLS 1.2+) and at rest. OAuth refresh
            tokens are stored encrypted. Access is restricted via least-privilege
            IAM and audited.
          </p>
        </Section>

        <Section title="9. Children">
          <p>
            ConvergeFlow is not directed at children under 16, and we do not
            knowingly collect data from anyone under that age.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will
            be announced via email or in-app notice at least 14 days before
            taking effect.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions about this policy? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-cf-orange underline">
              {CONTACT_EMAIL}
            </a>
            , or write to {COMPANY}, {COMPANY_ADDRESS}.
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-white/5 text-sm text-white/50 flex gap-6">
          <Link href="/" className="hover:text-white">Home</Link>
          <Link href="/terms" className="hover:text-white">Terms of Service</Link>
          <Link href="/data-deletion" className="hover:text-white">Data Deletion</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[20px] font-semibold text-white mb-3 font-heading">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
