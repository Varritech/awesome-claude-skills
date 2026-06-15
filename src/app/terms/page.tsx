import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Terms of Service — ConvergeFlow',
  description: 'Terms governing your use of ConvergeFlow.',
};

const LAST_UPDATED = 'June 15, 2026';
const CONTACT_EMAIL = 'support@convergeflow.com';
const COMPANY = 'Varritech Inc.';
const COMPANY_ADDRESS = '21 5th Ave, New York, NY 10175, United States';

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-white/50 mb-10">Last updated: {LAST_UPDATED}</p>

        <Section title="1. Acceptance of terms">
          <p>
            By creating an account or using ConvergeFlow (the &ldquo;Service&rdquo;),
            you agree to these Terms of Service and our{' '}
            <Link href="/privacy" className="text-cf-orange underline">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the Service. {COMPANY} provides
            the Service from {COMPANY_ADDRESS}.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 18 years old and authorized to bind any company
            you sign up on behalf of. The Service is for business use only.
          </p>
        </Section>

        <Section title="3. Account responsibilities">
          <ul className="list-disc pl-6 space-y-2">
            <li>You are responsible for safeguarding your login credentials.</li>
            <li>You are responsible for all activity on your account.</li>
            <li>
              You must promptly notify us of any unauthorized access at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-cf-orange underline">
                {CONTACT_EMAIL}
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section title="4. Acceptable use">
          <p>You agree NOT to use the Service to:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Send unsolicited bulk mail in violation of CAN-SPAM, GDPR, CASL, or any other applicable anti-spam law.</li>
            <li>Send messages to recipients who have not provided a lawful basis for contact.</li>
            <li>Send content that is unlawful, defamatory, harassing, fraudulent, or infringes intellectual property rights.</li>
            <li>Send phishing, malware, or any deceptive content.</li>
            <li>Scrape, reverse engineer, or attempt to bypass rate limits or security controls.</li>
            <li>Resell or sublicense the Service without our written consent.</li>
          </ul>
          <p className="mt-3">
            We may suspend or terminate accounts found in violation, and we
            cooperate with mailbox providers (Gmail, Microsoft, etc.) on abuse
            reports.
          </p>
        </Section>

        <Section title="5. Subscription and billing">
          <ul className="list-disc pl-6 space-y-2">
            <li>Paid plans are billed in advance through Stripe.</li>
            <li>Plans renew automatically until cancelled.</li>
            <li>You may cancel at any time from Settings → Billing; access continues until the end of the current billing period.</li>
            <li>Fees are non-refundable except where required by law.</li>
            <li>We may change pricing with 30 days&rsquo; notice.</li>
          </ul>
        </Section>

        <Section title="6. Email deliverability">
          <p>
            ConvergeFlow provides tools to help your messages reach the inbox
            but cannot guarantee delivery, open rates, or replies. Inbox
            providers may filter, defer, or reject messages at their sole
            discretion. You are responsible for your own sender reputation.
          </p>
        </Section>

        <Section title="7. Intellectual property">
          <p>
            The Service, including all software, designs, and content we
            create, is owned by {COMPANY} and protected by intellectual
            property laws. You retain ownership of the content you upload
            (lead lists, message templates) and grant us a non-exclusive
            license to process it to provide the Service.
          </p>
        </Section>

        <Section title="8. Disclaimer of warranties">
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, express or
            implied, including merchantability, fitness for a particular
            purpose, and non-infringement.
          </p>
        </Section>

        <Section title="9. Limitation of liability">
          <p>
            To the maximum extent permitted by law, {COMPANY}&rsquo;s total
            liability for any claim arising from your use of the Service is
            limited to the amount you paid us in the 12 months preceding the
            claim. We are not liable for lost profits, lost data, or
            consequential damages.
          </p>
        </Section>

        <Section title="10. Indemnification">
          <p>
            You agree to indemnify and hold {COMPANY} harmless from any claim
            arising from your use of the Service in violation of these Terms,
            including claims from message recipients.
          </p>
        </Section>

        <Section title="11. Termination">
          <p>
            We may suspend or terminate your account for breach of these Terms.
            You may delete your account at any time. Sections 7, 8, 9, 10, and
            13 survive termination.
          </p>
        </Section>

        <Section title="12. Changes to terms">
          <p>
            We may update these Terms from time to time. Material changes will
            be announced via email or in-app notice at least 14 days before
            taking effect. Continued use after that date constitutes
            acceptance.
          </p>
        </Section>

        <Section title="13. Governing law">
          <p>
            These Terms are governed by the laws of the State of New York,
            without regard to conflict-of-law rules. Exclusive jurisdiction
            and venue lie in the state and federal courts located in New York
            County, NY.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            Questions about these Terms? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-cf-orange underline">
              {CONTACT_EMAIL}
            </a>
            , or write to {COMPANY}, {COMPANY_ADDRESS}.
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-white/5 text-sm text-white/50 flex gap-6">
          <Link href="/" className="hover:text-white">Home</Link>
          <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
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
