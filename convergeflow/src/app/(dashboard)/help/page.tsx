"use client";

import { useState, useMemo } from "react";
import { Card, Button } from "@/components/ui";
import { MailIcon, PhoneIcon, MessageCircleIcon } from "@/components/icons";
import { articles, searchArticles, type Article, type ArticleCategory } from "@/lib/help/articles";

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

const categoryLabels: Record<ArticleCategory, string> = {
  "getting-started": "Getting Started",
  "inbox-setup": "Inbox Setup",
  campaigns: "Campaigns",
  troubleshooting: "Troubleshooting",
};

const categoryIcons: Record<ArticleCategory, string> = {
  "getting-started": "🚀",
  "inbox-setup": "📬",
  campaigns: "📢",
  troubleshooting: "🔧",
};

function sanitizeHtml(html: string): string {
  // Allow only safe inline/block tags, strip everything else
  return html.replace(/<(?!\/?(?:b|strong|i|em|code|pre|ul|ol|li|p|h[1-6]|br|a|span)\b)[^>]*>/gi, '');
}

function applyInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderMarkdown(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      if (line.startsWith("# "))
        return `<h1 class="text-[18px] font-bold mt-6 mb-2 font-heading">${applyInline(line.slice(2))}</h1>`;
      if (line.startsWith("## "))
        return `<h2 class="text-[15px] font-bold mt-5 mb-1.5 font-heading text-white/80">${applyInline(line.slice(3))}</h2>`;
      if (line.startsWith("### "))
        return `<h3 class="text-[13px] font-bold mt-4 mb-1 font-heading text-white/70">${applyInline(line.slice(4))}</h3>`;
      if (line.startsWith("- "))
        return `<li class="text-[13px] text-white/55 leading-relaxed ml-4 list-disc">${applyInline(line.slice(2))}</li>`;
      const numbered = line.match(/^(\d+)\.\s(.+)/);
      if (numbered)
        return `<li class="text-[13px] text-white/55 leading-relaxed ml-4 list-decimal">${applyInline(numbered[2])}</li>`;
      if (line.trim() === "") return `<br />`;
      return `<p class="text-[13px] text-white/55 leading-relaxed">${applyInline(line)}</p>`;
    })
    .join("");
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ArticleCategory | "all">("all");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const filteredArticles = useMemo(() => {
    let results = searchQuery ? searchArticles(searchQuery) : articles;
    if (activeCategory !== "all") {
      results = results.filter((a) => a.category === activeCategory);
    }
    return results;
  }, [searchQuery, activeCategory]);

  const allCategories: (ArticleCategory | "all")[] = [
    "all",
    "getting-started",
    "inbox-setup",
    "campaigns",
    "troubleshooting",
  ];

  if (selectedArticle) {
    return (
      <>
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setSelectedArticle(null)}
            className="flex items-center gap-2 text-[13px] text-white/35 hover:text-white/60 transition-colors mb-4"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Help Center
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 uppercase tracking-wide">
              {categoryLabels[selectedArticle.category]}
            </span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight font-heading">
            {selectedArticle.title}
          </h1>
        </div>
        <Card className="mb-5">
          <article dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(selectedArticle.content)) }} />
        </Card>
        <div className="flex flex-wrap gap-2">
          {selectedArticle.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/30"
            >
              {tag}
            </span>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Help Center</h1>
        <p className="text-[13px] text-white/25 mt-1">
          Guides, tutorials, and support for ConvergeFlow
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setActiveCategory("all");
          }}
          className="w-full bg-cf-card rounded-[14px] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-cf-orange"
        />
      </div>

      <div className="flex gap-4">
        {/* Category sidebar */}
        <aside className="hidden md:flex flex-col gap-1 w-[180px] shrink-0">
          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left text-[13px] transition-colors ${
                activeCategory === cat
                  ? "bg-cf-orange/10 text-cf-orange font-medium"
                  : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"
              }`}
            >
              {cat !== "all" && (
                <span className="text-[14px]">{categoryIcons[cat as ArticleCategory]}</span>
              )}
              <span>{cat === "all" ? "All Articles" : categoryLabels[cat as ArticleCategory]}</span>
            </button>
          ))}
          <div className="border-t border-white/[0.04] mt-2 pt-2">
            <a
              href="/help/tutorials"
              className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] text-white/40 hover:bg-white/[0.04] hover:text-white/60 transition-colors"
            >
              <span className="text-[14px]">🎬</span>
              <span>Video Tutorials</span>
            </a>
          </div>
        </aside>

        {/* Article list */}
        <div className="flex-1 min-w-0">
          {filteredArticles.length === 0 ? (
            <Card className="text-center py-10">
              <p className="text-[14px] text-white/40 mb-1">No articles found</p>
              <p className="text-[12px] text-white/20">
                Try a different search term or{" "}
                <button
                  type="button"
                  className="text-cf-orange hover:underline"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                  }}
                >
                  clear filters
                </button>
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredArticles.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => setSelectedArticle(article)}
                  className="w-full text-left"
                >
                  <Card className="hover:!bg-cf-elevated transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-white/35 uppercase tracking-wide">
                            {categoryLabels[article.category]}
                          </span>
                        </div>
                        <p className="text-[14px] font-bold font-heading">{article.title}</p>
                        <p className="text-[12px] text-white/30 mt-1">
                          {article.content
                            .replace(/#+\s/g, "")
                            .split("\n")
                            .find((l) => l.trim().length > 20) ?? ""}
                        </p>
                      </div>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-white/15 shrink-0 mt-1"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contact methods */}
      <div className="mt-8 mb-3">
        <p className="text-[13px] text-white/25 mb-3">Still need help?</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <p className="text-[12px] text-white/25 mt-1">{method.description}</p>
                <a
                  href={method.href}
                  target={method.target}
                  rel="noopener noreferrer"
                  className="mt-4 px-5 py-2 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/50 hover:bg-white/[0.08] transition-colors font-medium"
                >
                  {method.action}
                </a>
              </Card>
            );
          })}
        </div>
      </div>

      {/* OpenClaw upsell */}
      <Card
        variant="orange"
        className="flex items-center justify-between gap-5 max-md:flex-col max-md:text-center mt-5"
      >
        <div>
          <h3 className="text-lg font-bold tracking-tight font-heading">Need more than email?</h3>
          <p className="text-[13px] text-white/30">
            OpenClaw gives you AI-powered outreach across every channel - email, SMS, social, and
            more.
          </p>
        </div>
        <Button
          variant="mint"
          className="shrink-0"
          onClick={() => window.open("https://openclaw.io", "_blank")}
        >
          Learn More
        </Button>
      </Card>
    </>
  );
}
