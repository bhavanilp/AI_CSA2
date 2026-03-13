import { Pinecone } from '@pinecone-database/pinecone';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from './index';
import logger from '../utils/logger';

let pineconeClient: Pinecone;
let localVectors: Array<{
  id: string;
  values: number[];
  metadata: Record<string, any>;
}> = [];

const LOCAL_VECTOR_STORE_PATH = path.resolve(process.cwd(), 'data', 'local-vector-store.json');

type LocalVectorStore = {
  vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }>;
  updated_at: string;
};

const saveLocalVectorStore = async (): Promise<void> => {
  const payload: LocalVectorStore = {
    vectors: localVectors,
    updated_at: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(LOCAL_VECTOR_STORE_PATH), { recursive: true });
  await fs.writeFile(LOCAL_VECTOR_STORE_PATH, JSON.stringify(payload, null, 2), 'utf8');
};

const loadLocalVectorStore = async (): Promise<void> => {
  try {
    const raw = await fs.readFile(LOCAL_VECTOR_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as LocalVectorStore;
    localVectors = Array.isArray(parsed.vectors) ? parsed.vectors : [];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      localVectors = [];
      return;
    }
    throw error;
  }
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const initializePinecone = async (): Promise<void> => {
  if (config.vector_db.provider !== 'pinecone') {
    await loadLocalVectorStore();
    const urls = getIngestedSourceUrls();
    logger.info(`Using local file vector store at ${LOCAL_VECTOR_STORE_PATH}`);
    logger.info(`Loaded ${localVectors.length} vectors and ${urls.length} ingested URLs from local store`);

    if (urls.length > 0) {
      logger.info(`Ingested URLs at startup: ${urls.join(', ')}`);
    }

    return;
  }

  try {
    pineconeClient = new Pinecone({
      apiKey: config.vector_db.pinecone.api_key,
    });

    // Test connection by listing indexes
    const indexes = await pineconeClient.listIndexes();
    const indexNames = indexes.indexes?.map((index) => index.name).join(', ') || 'none';
    logger.info(`Pinecone connected. Indexes: ${indexNames}`);
  } catch (error) {
    logger.error(`Pinecone connection failed: ${error}`);
    throw error;
  }
};

export const getPineconeIndex = () => {
  if (!pineconeClient) {
    throw new Error('Pinecone not initialized');
  }
  return pineconeClient.Index(config.vector_db.pinecone.index_name);
};

export const upsertVectors = async (
  vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }>
): Promise<void> => {
  if (config.vector_db.provider !== 'pinecone') {
    const existingIds = new Set(localVectors.map((item) => item.id));
    for (const vector of vectors) {
      if (existingIds.has(vector.id)) {
        localVectors = localVectors.map((item) => (item.id === vector.id ? vector : item));
      } else {
        localVectors.push(vector);
      }
    }
    await saveLocalVectorStore();
    logger.info(`Upserted ${vectors.length} vectors to local store`);
    return;
  }

  try {
    const index = getPineconeIndex();
    await index.upsert(vectors as any);
    logger.info(`Upserted ${vectors.length} vectors to Pinecone`);
  } catch (error) {
    logger.error(`Upsert error: ${error}`);
    throw error;
  }
};

export const queryVectors = async (
  vector: number[],
  topK: number = 5,
  filter?: Record<string, any>
): Promise<any[]> => {
  if (config.vector_db.provider !== 'pinecone') {
    const matches = localVectors
      .filter((item) => {
        if (!filter) {
          return true;
        }
        return Object.entries(filter).every(([key, value]) => item.metadata?.[key] === value);
      })
      .map((item) => ({
        id: item.id,
        score: cosineSimilarity(vector, item.values),
        metadata: item.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return matches;
  }

  try {
    const index = getPineconeIndex();
    const results = await index.query({
      vector,
      topK,
      includeMetadata: true,
      filter: filter as any,
    });
    return results.matches || [];
  } catch (error) {
    logger.error(`Query error: ${error}`);
    throw error;
  }
};

export const deleteVectors = async (ids: string[]): Promise<void> => {
  if (config.vector_db.provider !== 'pinecone') {
    const idSet = new Set(ids);
    localVectors = localVectors.filter((item) => !idSet.has(item.id));
    await saveLocalVectorStore();
    logger.info(`Deleted ${ids.length} vectors from local store`);
    return;
  }

  try {
    const index = getPineconeIndex();
    await index.deleteMany(ids);
    logger.info(`Deleted ${ids.length} vectors from Pinecone`);
  } catch (error) {
    logger.error(`Delete error: ${error}`);
    throw error;
  }
};

export const deleteVectorsBySourceUrl = async (
  sourceUrl: string,
  organizationId?: string,
): Promise<number> => {
  if (!sourceUrl || !sourceUrl.trim()) {
    return 0;
  }

  const normalizedUrl = sourceUrl.trim();

  if (config.vector_db.provider !== 'pinecone') {
    const beforeCount = localVectors.length;
    localVectors = localVectors.filter((item) => {
      const itemUrl = typeof item.metadata?.source_url === 'string' ? item.metadata.source_url.trim() : '';
      if (itemUrl !== normalizedUrl) {
        return true;
      }

      if (!organizationId) {
        return false;
      }

      return item.metadata?.organization_id !== organizationId;
    });

    const deletedCount = beforeCount - localVectors.length;
    if (deletedCount > 0) {
      await saveLocalVectorStore();
    }

    logger.info(`Deleted ${deletedCount} vectors from local store for URL ${normalizedUrl}`);
    return deletedCount;
  }

  // Pinecone URL-level deletion depends on index filtering capabilities. Try best-effort filter delete.
  try {
    const index = getPineconeIndex() as any;
    const filter: Record<string, any> = {
      source_url: { $eq: normalizedUrl },
    };
    if (organizationId) {
      filter.organization_id = { $eq: organizationId };
    }
    await index.deleteMany(filter);
    logger.info(`Requested Pinecone vector deletion for URL ${normalizedUrl}`);
    return 0;
  } catch (error) {
    logger.error(`Delete-by-URL error: ${error}`);
    throw error;
  }
};

export function getIngestedSourceUrls(): string[] {
  if (config.vector_db.provider === 'pinecone') {
    return [];
  }

  const urls = new Set<string>();
  for (const vector of localVectors) {
    const url = vector.metadata?.source_url;
    if (typeof url === 'string' && url.trim().length > 0) {
      urls.add(url);
    }
  }
  return Array.from(urls).sort();
}
