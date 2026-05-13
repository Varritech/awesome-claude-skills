/**
 * RAG Retriever — Phase 1 (in-process cosine similarity).
 *
 * Knowledge base chunks are embedded once and cached in memory per cold start.
 * Queries embed the input text and return the top-k most similar chunks.
 *
 * Phase 2 migration: replace cache + cosine with Pinecone.query().
 */

import { KNOWLEDGE_BASE, type KnowledgeChunk } from './knowledge-base';
import { embed, embedBatch, cosineSimilarity } from './embeddings';

interface IndexedChunk {
  chunk: KnowledgeChunk;
  embedding: number[];
}

// In-memory cache — survives for the lifetime of the serverless function instance.
let _index: IndexedChunk[] | null = null;
let _indexing = false;

async function getIndex(): Promise<IndexedChunk[]> {
  if (_index) return _index;
  if (_indexing) {
    // Spin-wait for concurrent cold starts (rare in serverless)
    await new Promise((r) => setTimeout(r, 200));
    return _index ?? [];
  }

  _indexing = true;
  const texts = KNOWLEDGE_BASE.map((c) => c.text);
  const embeddings = await embedBatch(texts);
  _index = KNOWLEDGE_BASE.map((chunk, i) => ({ chunk, embedding: embeddings[i]! }));
  _indexing = false;
  return _index;
}

export interface RetrievalResult {
  chunk: KnowledgeChunk;
  score: number;
}

/**
 * Retrieve the top-k knowledge base chunks most relevant to the query.
 * Optionally filter to specific frameworks or industries.
 */
export async function retrieve(
  query: string,
  opts: {
    topK?: number;
    frameworks?: KnowledgeChunk['framework'][];
    industry?: string;
    types?: KnowledgeChunk['type'][];
  } = {}
): Promise<RetrievalResult[]> {
  const { topK = 6, frameworks, industry, types } = opts;

  const [queryEmbedding, index] = await Promise.all([embed(query), getIndex()]);

  let candidates = index;

  if (frameworks?.length) {
    candidates = candidates.filter((c) => frameworks.includes(c.chunk.framework));
  }
  if (industry) {
    const norm = industry.toLowerCase();
    candidates = candidates.filter(
      (c) =>
        !c.chunk.industry ||
        c.chunk.industry.toLowerCase().includes(norm) ||
        c.chunk.tags.some((t) => t.includes(norm))
    );
  }
  if (types?.length) {
    candidates = candidates.filter((c) => types.includes(c.chunk.type));
  }

  return candidates
    .map((c) => ({ chunk: c.chunk, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Retrieve chunks specifically for a given email position in the sequence.
 * Returns the right mix of rules + template + industry example.
 */
export async function retrieveForEmail(
  emailNumber: 1 | 2 | 3 | 4 | 5,
  context: { industry: string; niche?: string }
): Promise<RetrievalResult[]> {
  const queryMap: Record<number, string> = {
    1: 'rapport building no ask trust email 1 cold outreach',
    2: 'case study credibility soft CTA email 2 cold outreach',
    3: 'value content insight embedded CTA email 3 cold outreach',
    4: 'direct ask no apology follow up email 4 cold outreach',
    5: 'break-up final email close file cold outreach',
  };

  const query = `${queryMap[emailNumber]} ${context.industry} ${context.niche ?? ''}`;
  return retrieve(query, { topK: 8, industry: context.industry });
}
