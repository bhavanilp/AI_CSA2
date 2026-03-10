import { Pinecone } from '@pinecone-database/pinecone';
import { config } from './index';
import logger from '../utils/logger';

let pineconeClient: Pinecone;
let localVectors: Array<{
  id: string;
  values: number[];
  metadata: Record<string, any>;
}> = [];

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
    logger.info('Using local in-memory vector store');
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
