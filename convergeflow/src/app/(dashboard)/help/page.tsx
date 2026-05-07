"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";
import {
  MailIcon,
  PhoneIcon,
  MessageCircleIcon,
  ChevronDownIcon,
} from "@/components/icons";

const contactMethods = [
  {
    icon: MessageCircleIcon,
    label: "WhatsApp",
    description: "Chat with us live",
    action: "Open WhatsApp",
    accent: "bg-green-600",
    href: "https://wa.me/19175551234",
    target: "_blank",
  },
  {
    icon: MailIcon,
    label: "Email Support",
    description: "support@convergeflow.io",
    action: "Send Email",
    accent: "bg-cf-orange",
    href: "mailto:support@convergeflow.io",
    target: "_self",
  },
  {
    icon: PhoneIcon,
    label: "Book a Call",
    description: "15 min with our team",
    action: "Schedule",
    accent: "bg-cf-indigo",
    href: "https://cal.com/varritech/convergeflow-intro",
    target: "_blank",
  },
];

const faqs = [
  {
    question: "How do I connect my email inbox?",
    answer:
      "Go to Settings > Connected Inboxes and click '+ Add Inbox'. We support Gmail, Outlook, and custom SMTP. Most setups take under 2 minutes.",
  },
  {
    question: "Can I customize the email templates?",
    answer:
      "Yes! Go to Email Styles to choose from our 4 writing personas. You can also customize each template to match your voice and brand.",
  },
  {
    question: "How does lead scoring work?",
    answer:
      "We analyze signals like company size, recent activity, and industry fit. Scores update automatically as new data becomes available.",
  },
  {
    question: "What happens when someone replies?",
    answer:
      "You'll get a notification and see the reply in your Recent Replies on the dashboard. Interested leads are highlighted automatically.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes, you can cancel from Settings > Plan & Billing. Your access continues until the end of your billing period. No cancellation fees.",
  },
];

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Need Help?</h1>
        <p className="text-[13px] text-white/25 mt-1">
          We&apos;re here when you need us
        </p>
      </div>

      {/* Contact cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {contactMethods.map((method) => {
          const Icon = method.icon;
          return (
            <Card key={method.label} className="flex flex-col items-center text-center">
              <div
                className={`w-12 h-12 rounded-[var(--radius-icon)] ${method.accent} flex items-center justify-center mb-3`}
              >
                <Icon size={20} className="text-white" />
              </div>
              <h3 className="text-[14px] font-bold font-heading">{method.label}</h3>
              <p className="text-[12px] text-white/25 mt-1">
                {method.description}
              </p>
              <a href={method.href} target={method.target} rel="noopener noreferrer" className="mt-4 px-5 py-2 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/50 hover:bg-white/[0.08] transition-colors font-medium">
                {method.action}
              </a>
            </Card>
          );
        })}
      </div>

      {/* FAQ accordion */}
      <Card className="mb-5">
        <p className="text-sm font-bold mb-4 font-heading">Frequently Asked Questions</p>
        <div className="flex flex-col">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`py-3.5 ${
                i < faqs.length - 1 ? "border-b border-white/[0.04]" : ""
              }`}
            >
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="text-[13px] font-medium pr-4">{faq.question}</span>
                <ChevronDownIcon
                  size={16}
                  className={`text-white/20 shrink-0 transition-transform ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openFaq === i && (
                <p className="text-[12px] text-white/35 mt-2 leading-relaxed">
                  {faq.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* OpenClaw upsell */}
      <Card variant="orange" className="flex items-center justify-between gap-5 max-md:flex-col max-md:text-center">
        <div>
          <h3 className="text-lg font-bold tracking-tight font-heading">
            Need more than email?
          </h3>
          <p className="text-[13px] text-white/30">
            OpenClaw gives you AI-powered outreach across every channel - email, SMS, social, and more.
          </p>
        </div>
        <Button variant="mint" className="shrink-0" onClick={() => window.open("https://openclaw.io", "_blank")}>
          Learn More
        </Button>
      </Card>
    </>
  );
}
