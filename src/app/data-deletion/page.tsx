import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Data Deletion Instructions — ConvergeFlow',
  description: 'How to delete your ConvergeFlow account and associated data.',
};

const CONTACT_EMAIL = 'support@convergeflow.com';

export default function DataDeletionPage() {
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
        <h1 className="text-[36px] font-bold tracking-tight font-heading text-white mb-6">
          Data Deletion Instructions
        </h1>

        <p className="mb-8">
          You can delete your ConvergeFlow account and all associated personal
          data at any time. Choose the method that fits your situation.
        </p>

        <Section title="Option 1 — Delete from inside the app (fastest)">
          <ol className="list-decimal pl-6 space-y-2">
            <li>Sign in at <Link href="/login" className="text-cf-orange underline">convergeflow.com/login</Link>.</li>
            <li>Go to <strong>Settings → Account</strong>.</li>
            <li>Click <strong>Delete account</strong>.</li>
            <li>Confirm. Your account, inboxes, campaigns, and lead lists are removed within 30 days.</li>
          </ol>
        </Section>

        <Section title="Option 2 — Email request">
          <p>
            Send an email to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-cf-orange underline">
              {CONTACT_EMAIL}
            </a>{' '}
            from the address associated with your account, with the subject{' '}
            <strong>&ldquo;Delete my account&rdquo;</strong>. We will verify
            ownership and complete deletion within 30 days, and reply with
            confirmation.
          </p>
        </Section>

        <Section title="Option 3 — Facebook-sourced data">
          <p>
            If you signed in with Facebook and want to remove only the data we
            received from Facebook (your Facebook ID and the email/name we
            received via OAuth):
          </p>
          <ol className="list-decimal pl-6 mt-3 space-y-2">
            <li>
              Revoke ConvergeFlow access at{' '}
              <a
                href="https://www.facebook.com/settings?tab=applications"
                target="_blank"
                rel="noreferrer"
                className="text-cf-orange underline"
              >
                facebook.com/settings → Apps and Websites
              </a>
              .
            </li>
            <li>
              Email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-cf-orange underline">
                {CONTACT_EMAIL}
              </a>{' '}
              with the subject{' '}
              <strong>&ldquo;Facebook data deletion request&rdquo;</strong> and
              include the Facebook account email you used.
            </li>
            <li>
              We delete all Facebook-sourced identifiers within 30 days and
              email confirmation.
            </li>
          </ol>
        </Section>

        <Section title="What gets deleted">
          <ul className="list-disc pl-6 space-y-2">
            <li>Account profile and authentication identifiers.</li>
            <li>Connected inbox OAuth tokens and SMTP credentials.</li>
            <li>Uploaded lead lists.</li>
            <li>Drafted, sent, and queued messages.</li>
            <li>Reply, open, and click tracking records.</li>
          </ul>
        </Section>

        <Section title="What is retained">
          <p>
            We retain only what is legally required: billing records and
            invoices (held for 7 years for tax compliance), and aggregated,
            anonymized usage analytics that cannot identify you.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-cf-orange underline">
              {CONTACT_EMAIL}
            </a>
            . We respond within 2 business days.
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-white/5 text-sm text-white/50 flex gap-6">
          <Link href="/" className="hover:text-white">Home</Link>
          <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white">Terms of Service</Link>
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
