import { processChat, getConversation } from '../src/services/chatService';
import { query } from '../src/config/database';
import { generateEmbedding, generateAnswer, detectKeywords } from '../src/services/llmService';
import { queryVectors } from '../src/config/vectorDb';

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../src/services/llmService', () => ({
  generateEmbedding: jest.fn(),
  generateAnswer: jest.fn(),
  detectKeywords: jest.fn(),
}));

jest.mock('../src/config/vectorDb', () => ({
  queryVectors: jest.fn(),
}));

jest.mock('../src/config/index', () => ({
  config: {
    rag: {
      retrieval_top_k: 5,
      confidence_threshold: 0.7,
    },
  },
}));

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedGenerateEmbedding = generateEmbedding as jest.MockedFunction<typeof generateEmbedding>;
const mockedGenerateAnswer = generateAnswer as jest.MockedFunction<typeof generateAnswer>;
const mockedDetectKeywords = detectKeywords as jest.MockedFunction<typeof detectKeywords>;
const mockedQueryVectors = queryVectors as jest.MockedFunction<typeof queryVectors>;

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockedDetectKeywords.mockReturnValue(false);
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT config FROM escalation_rules')) {
        return { rows: [{ config: { keywords: ['refund'] } }], rowCount: 1 } as any;
      }
      if (sql.includes('INSERT INTO conversations')) {
        return { rows: [], rowCount: 1 } as any;
      }
      if (sql.includes('FROM conversations WHERE id = $1')) {
        return {
          rows: [
            {
              id: 'conv-1',
              session_id: 'sess-1',
              user_email: null,
              user_name: null,
              messages: [{ role: 'user', content: 'hello' }],
              message_count: 1,
              was_escalated: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });
  });

  it('uses vector store when relevant chunks exceed threshold', async () => {
    mockedQueryVectors.mockResolvedValue([
      {
        id: 'vec-1',
        score: 0.82,
        metadata: {
          source_id: 'src-1',
          source_name: 'Hyderabad Wiki',
          source_url: 'https://en.wikipedia.org/wiki/Hyderabad',
          chunk_text: 'Hyderabad is known for Charminar and rich history.',
        },
      },
    ] as any);
    mockedGenerateAnswer.mockResolvedValue({ answer: 'Hyderabad is known for Charminar.', confidence: 0.9 } as any);

    const result = await processChat({
      conversation_id: 'conv-1',
      user_id: 'sess-1',
      message: 'What is Hyderabad known for?',
      organization_id: 'default',
    });

    expect(result.used_vector_store).toBe(true);
    expect(result.vector_store_note).toBeUndefined();
    expect(result.content).toContain('Charminar');
    expect(typeof result.response_time_sec).toBe('number');
    expect(result.response_time_sec).toBeGreaterThanOrEqual(0);
    expect(typeof result.confidence_reason).toBe('string');
    expect(result.confidence_reason.length).toBeGreaterThan(0);
    expect(result.sources).toHaveLength(1);
    expect(mockedGenerateAnswer).toHaveBeenCalledWith(
      expect.stringContaining('provided context'),
      'What is Hyderabad known for?',
      expect.stringContaining('[Source 1]')
    );
  });

  it('falls back to general LLM answer when vector results are below threshold', async () => {
    mockedQueryVectors.mockResolvedValue([
      {
        id: 'vec-2',
        score: 0.47,
        metadata: {
          source_id: 'src-2',
          source_name: 'Bapatla Wiki',
          chunk_text: 'Bapatla is a town in Andhra Pradesh.',
        },
      },
    ] as any);
    mockedGenerateAnswer.mockResolvedValue({ answer: 'Paris.', confidence: 0.8 } as any);

    const result = await processChat({
      conversation_id: 'conv-2',
      user_id: 'sess-2',
      message: 'What is the capital of France?',
      organization_id: 'default',
    });

    expect(result.used_vector_store).toBe(false);
    expect(result.vector_store_note).toBe('No relevant vector-store content matched the question.');
    expect(result.content).toContain('This answer does not use vector store context');
    expect(result.content).toContain('Paris.');
    expect(typeof result.response_time_sec).toBe('number');
    expect(result.response_time_sec).toBeGreaterThanOrEqual(0);
    expect(result.confidence_reason).toContain('No relevant vector-store evidence');
  });

  it('returns timeout-safe messaging when the LLM call fails', async () => {
    mockedQueryVectors.mockResolvedValue([] as any);
    mockedGenerateAnswer.mockRejectedValue({ code: 'ETIMEDOUT', message: 'timeout while waiting' });

    const result = await processChat({
      conversation_id: 'conv-3',
      user_id: 'sess-3',
      message: 'Tell me something',
      organization_id: 'default',
    });

    expect(result.used_vector_store).toBe(false);
    expect(result.vector_store_note).toBe('LLM error; no vector context used.');
    expect(result.content).toContain('taking too long to respond');
    expect(result.confidence).toBe(0);
    expect(result.confidence_reason).toContain('LLM error/timeout');
  });

  it('flags escalation when a keyword rule matches', async () => {
    mockedQueryVectors.mockResolvedValue([] as any);
    mockedDetectKeywords.mockReturnValue(true);

    const result = await processChat({
      conversation_id: 'conv-4',
      user_id: 'sess-4',
      message: 'I need a refund right now',
      organization_id: 'default',
    });

    expect(result.should_escalate).toBe(true);
    expect(result.escalation_reason).toBe('keyword_match');
  });

  it('returns a stored conversation transcript by id', async () => {
    const conversation = await getConversation('conv-1');
    expect(conversation.id).toBe('conv-1');
    expect(conversation.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });
});