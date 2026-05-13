/**
 * Embedding generation via OpenAI text-embedding-3-small.
 * Used to embed knowledge base chunks and prospect context for RAG retrieval.
 *
 * Phase 1: embed on-demand, store in Firebase.
 * Phase 2: migrate to Pinecone when volume warrants it.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return key;
}

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI embeddings error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0]!.embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI embeddings batch error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Cosine similarity between two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export { EMBEDDING_DIM };
