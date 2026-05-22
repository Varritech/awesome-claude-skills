/**
 * Email merge tag resolver.
 *
 * Resolves {{tag}} placeholders in email templates with lead and sender data.
 * Unresolved tags are left as-is.
 */

import type { Lead } from "@/lib/schemas/lead";

export interface SenderContext {
  name: string;
  company: string;
}

const ALL_TAGS = [
  "{{firstName}}",
  "{{lastName}}",
  "{{company}}",
  "{{title}}",
  "{{industry}}",
  "{{location}}",
  "{{senderName}}",
  "{{senderCompany}}",
  "{{currentDate}}",
  "{{customSubdomain}}",
] as const;

export type MergeTag = (typeof ALL_TAGS)[number];

/**
 * Resolve all merge tags in a template string.
 *
 * @param template - The email template containing {{tag}} placeholders.
 * @param lead     - The recipient lead data.
 * @param sender   - The sender name + company.
 * @param extra    - Optional extra values (e.g. customSubdomain).
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

export function resolveMergeTags(
  template: string,
  lead: Partial<Lead>,
  sender: SenderContext,
  extra?: { customSubdomain?: string }
): string {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const replacements: Record<MergeTag, string> = {
    "{{firstName}}": escapeHtml(lead.firstName ?? ""),
    "{{lastName}}": escapeHtml(lead.lastName ?? ""),
    "{{company}}": escapeHtml(lead.company ?? ""),
    "{{title}}": escapeHtml(lead.title ?? ""),
    "{{industry}}": escapeHtml(lead.industry ?? ""),
    "{{location}}": escapeHtml(lead.location ?? ""),
    "{{senderName}}": escapeHtml(sender.name),
    "{{senderCompany}}": escapeHtml(sender.company),
    "{{currentDate}}": escapeHtml(currentDate),
    "{{customSubdomain}}": escapeHtml(extra?.customSubdomain ?? ""),
  };

  let result = template;
  for (const [tag, value] of Object.entries(replacements) as [MergeTag, string][]) {
    result = result.split(tag).join(value);
  }
  return result;
}

/**
 * Return a list of all merge tags found in a template string.
 */
export function extractMergeTags(template: string): MergeTag[] {
  return ALL_TAGS.filter((tag) => template.includes(tag));
}

/**
 * Preview merge tags with sample data for display in the composer UI.
 */
export function previewMergeTags(template: string): string {
  return resolveMergeTags(
    template,
    {
      firstName: "Jane",
      lastName: "Smith",
      company: "Acme Corp",
      title: "VP of Marketing",
      industry: "SaaS",
      location: "San Francisco, CA",
    },
    { name: "Your Name", company: "Your Company" },
    { customSubdomain: "yourapp" }
  );
}
