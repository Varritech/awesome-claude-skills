export interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  videoUrl: string;
  category: string;
  order: number;
}

export const tutorials: Tutorial[] = [
  {
    id: "account-setup",
    title: "Setting Up Your Account",
    description:
      "A complete walkthrough of the ConvergeFlow onboarding flow: creating your account, verifying your email, and navigating the dashboard for the first time.",
    duration: "3:45",
    thumbnail: "https://placehold.co/640x360/1a1a1f/ffffff?text=Account+Setup",
    videoUrl: "coming-soon",
    category: "getting-started",
    order: 1,
  },
  {
    id: "domain-connection",
    title: "Connecting Your Domain",
    description:
      "Learn how to add SPF, DKIM, and DMARC DNS records to your domain so your emails land in the inbox, not spam.",
    duration: "5:12",
    thumbnail: "https://placehold.co/640x360/1a1a1f/ffffff?text=Domain+Connection",
    videoUrl: "coming-soon",
    category: "inbox-setup",
    order: 2,
  },
  {
    id: "inbox-warmup",
    title: "How Inbox Warmup Works",
    description:
      "Understand ConvergeFlow's 14-day warmup process, what it does behind the scenes, and how to monitor your deliverability score.",
    duration: "4:30",
    thumbnail: "https://placehold.co/640x360/1a1a1f/ffffff?text=Inbox+Warmup",
    videoUrl: "coming-soon",
    category: "inbox-setup",
    order: 3,
  },
  {
    id: "first-campaign",
    title: "Launching Your First Campaign",
    description:
      "Step-by-step guide to importing leads, choosing a writing style, reviewing AI-generated email sequences, and launching your first cold email campaign.",
    duration: "7:20",
    thumbnail: "https://placehold.co/640x360/1a1a1f/ffffff?text=First+Campaign",
    videoUrl: "coming-soon",
    category: "campaigns",
    order: 4,
  },
  {
    id: "reading-analytics",
    title: "Reading Your Campaign Analytics",
    description:
      "How to interpret open rates, reply rates, and interested rates. Learn what each metric means and what action to take to improve your numbers.",
    duration: "6:05",
    thumbnail: "https://placehold.co/640x360/1a1a1f/ffffff?text=Analytics",
    videoUrl: "coming-soon",
    category: "campaigns",
    order: 5,
  },
  {
    id: "reply-management",
    title: "Managing Replies and Interested Leads",
    description:
      "See how to use the Replies dashboard to triage incoming responses, mark leads as interested, and hand off warm prospects to your sales process.",
    duration: "4:50",
    thumbnail: "https://placehold.co/640x360/1a1a1f/ffffff?text=Reply+Management",
    videoUrl: "coming-soon",
    category: "campaigns",
    order: 6,
  },
];
