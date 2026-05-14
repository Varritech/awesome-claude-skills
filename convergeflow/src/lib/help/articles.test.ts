import { describe, it, expect } from "vitest";
import { articles, searchArticles, getArticleBySlug, ArticleCategory } from "./articles";

describe("articles data", () => {
  it("contains at least 8 articles", () => {
    expect(articles.length).toBeGreaterThanOrEqual(8);
  });

  it("each article has required fields", () => {
    for (const article of articles) {
      expect(article.id).toBeTruthy();
      expect(article.slug).toBeTruthy();
      expect(article.title).toBeTruthy();
      expect(article.category).toBeTruthy();
      expect(article.content).toBeTruthy();
      expect(Array.isArray(article.tags)).toBe(true);
    }
  });

  it("covers all 4 categories", () => {
    const categories = new Set(articles.map((a) => a.category));
    const expected: ArticleCategory[] = [
      "getting-started",
      "inbox-setup",
      "campaigns",
      "troubleshooting",
    ];
    for (const cat of expected) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it("slugs are unique", () => {
    const slugs = articles.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("searchArticles", () => {
  it("returns all articles when query is empty", () => {
    expect(searchArticles("").length).toBe(articles.length);
  });

  it("returns matching articles by title", () => {
    const results = searchArticles("domain");
    expect(results.length).toBeGreaterThan(0);
    // Every result should match
    for (const r of results) {
      const matchesTitle = r.title.toLowerCase().includes("domain");
      const matchesContent = r.content.toLowerCase().includes("domain");
      const matchesTags = r.tags.some((t) => t.toLowerCase().includes("domain"));
      expect(matchesTitle || matchesContent || matchesTags).toBe(true);
    }
  });

  it("returns matching articles by content", () => {
    const results = searchArticles("inbox");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns matching articles by tag", () => {
    const results = searchArticles("warmup");
    expect(results.length).toBeGreaterThan(0);
  });

  it("is case-insensitive", () => {
    const lower = searchArticles("campaign");
    const upper = searchArticles("CAMPAIGN");
    expect(lower.length).toBe(upper.length);
  });

  it("returns empty array for unmatched query", () => {
    const results = searchArticles("xyznonexistent123");
    expect(results.length).toBe(0);
  });
});

describe("getArticleBySlug", () => {
  it("returns an article by slug", () => {
    const first = articles[0];
    const found = getArticleBySlug(first.slug);
    expect(found).toBeDefined();
    expect(found?.id).toBe(first.id);
  });

  it("returns undefined for unknown slug", () => {
    expect(getArticleBySlug("does-not-exist")).toBeUndefined();
  });
});
