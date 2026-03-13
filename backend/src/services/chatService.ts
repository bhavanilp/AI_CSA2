import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { generateEmbedding, generateAnswer, generateAnswerStream, detectKeywords } from './llmService';
import { queryVectors } from '../config/vectorDb';
import { config } from '../config/index';
import logger from '../utils/logger';

export interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
  confidence?: number;
  confidence_reason?: string;
  response_time_sec?: number;
  sources?: Array<{
    source_id: string;
    name: string;
    url?: string;
    relevance_score?: number;
  }>;
}

export interface ChatRequest {
  conversation_id: string;
  user_id: string;
  message: string;
  organization_id: string;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  role: 'bot';
  content: string;
  confidence: number;
  confidence_reason: string;
  response_time_sec: number;
  sources: Array<{
    source_id: string;
    name: string;
    url?: string;
    score?: number;
    confidence_min?: number;
    confidence_max?: number;
    match_count?: number;
  }>;
  should_escalate: boolean;
  escalation_reason?: string;
  used_vector_store: boolean;
  vector_store_note?: string;
}

type RetrievedChunk = {
  score?: number;
  metadata?: {
    source_id?: string;
    source_name?: string;
    source_url?: string;
    [key: string]: any;
  };
};

const dedupeSourcesByUrlWithConfidenceRange = (chunks: RetrievedChunk[]) => {
  const grouped = new Map<
    string,
    {
      source_id: string;
      name: string;
      url?: string;
      confidence_min: number;
      confidence_max: number;
      match_count: number;
    }
  >();

  for (const chunk of chunks) {
    const metadata = chunk.metadata || {};
    const score = typeof chunk.score === 'number' ? chunk.score : 0;
    const normalizedUrl = typeof metadata.source_url === 'string' ? metadata.source_url.trim() : '';
    const sourceId = typeof metadata.source_id === 'string' ? metadata.source_id : 'unknown-source';
    const sourceName = typeof metadata.source_name === 'string' ? metadata.source_name : 'Source';
    const dedupeKey = normalizedUrl || sourceId;

    const existing = grouped.get(dedupeKey);
    if (!existing) {
      grouped.set(dedupeKey, {
        source_id: sourceId,
        name: sourceName,
        url: normalizedUrl || undefined,
        confidence_min: score,
        confidence_max: score,
        match_count: 1,
      });
      continue;
    }

    existing.confidence_min = Math.min(existing.confidence_min, score);
    existing.confidence_max = Math.max(existing.confidence_max, score);
    existing.match_count += 1;
  }

  return Array.from(grouped.values()).sort((a, b) => b.confidence_max - a.confidence_max);
};

/**
 * Compute a meaningful answer confidence score from available signals:
 * 1. Average cosine-similarity of the retrieved vector chunks  (primary signal)
 * 2. Hedge-phrase penalty — when the LLM says "I don't know / cannot / etc."
 * 3. Very-short-answer penalty — extremely short replies are usually non-answers
 *
 * Returns a value in [0, 1].
 */
const HEDGE_PHRASES = [
  "i don't know", "i do not know", "i'm not sure", "i am not sure",
  "i cannot", "i can't", "not enough information", "no information",
  "unable to find", "context does not", "context doesn't",
  "not mentioned", "not provided", "not available", "no context",
  "cannot answer", "can't answer", "don't have", "do not have",
  "based on the context provided, i", "the context does not contain",
];

const computeAnswerConfidence = (params: {
  usedVectorStore: boolean;
  relevantChunks: Array<{ score?: number }>;
  answer: string;
  escalated: boolean;
}): { confidence: number; reason: string } => {
  const { usedVectorStore, relevantChunks, answer, escalated } = params;

  if (escalated) {
    return {
      confidence: 0.0,
      reason: 'Escalation triggered by policy/rule; confidence forced to 0.',
    };
  }

  if (!usedVectorStore) {
    return {
      confidence: 0.5,
      reason: 'No relevant vector-store evidence; baseline confidence applied.',
    };
  }

  // 1. Average cosine similarity of relevant chunks (already filtered to >= 0.6)
  const scores = relevantChunks
    .map((c) => (typeof c.score === 'number' ? c.score : 0))
    .filter((s) => s > 0);
  const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0.6;

  // 2. Hedge penalty
  const lowerAnswer = answer.toLowerCase();
  const hasHedge = HEDGE_PHRASES.some((p) => lowerAnswer.includes(p));
  const hedgePenalty = hasHedge ? 0.3 : 0;

  // 3. Very-short-answer penalty (< 30 chars is almost certainly a non-answer)
  const len = answer.trim().length;
  const lengthPenalty = len < 30 ? 0.2 : len < 60 ? 0.08 : 0;

  const confidence = Math.max(0.0, Math.min(1.0, avgScore - hedgePenalty - lengthPenalty));
  const reasonParts = [`avg similarity ${avgScore.toFixed(2)}`];
  if (hasHedge) reasonParts.push('hedge phrase penalty 0.30');
  if (lengthPenalty > 0) reasonParts.push(`short-answer penalty ${lengthPenalty.toFixed(2)}`);
  if (!hasHedge && lengthPenalty === 0) reasonParts.push('no major penalties');

  return {
    confidence,
    reason: reasonParts.join('; '),
  };
};

export const processChat = async (req: ChatRequest): Promise<ChatResponse> => {
  try {
    const requestStartMs = Date.now();
    const MIN_VECTOR_RELEVANCE_SCORE = 0.60;

    // Get or create conversation
    let conversationId = req.conversation_id;
    if (!conversationId) {
      conversationId = uuidv4();
    }

    // 1. Generate embedding for user query
    const queryEmbedding = await generateEmbedding(req.message);

    // 2. Retrieve relevant chunks from vector database
    const retrievedChunks = await queryVectors(queryEmbedding, config.rag.retrieval_top_k, {
      organization_id: req.organization_id,
    });

    const relevantChunks = retrievedChunks.filter(
      (chunk: any) => typeof chunk.score === 'number' && chunk.score >= MIN_VECTOR_RELEVANCE_SCORE
    );
    const shouldUseVectorStore = relevantChunks.length > 0;

    logger.info(
      `Retrieved ${retrievedChunks.length} chunks for query, ${relevantChunks.length} passed relevance threshold ${MIN_VECTOR_RELEVANCE_SCORE}`
    );

    // 3. Build context from retrieved chunks.
    // Limit to 3 chunks, each capped at 400 chars to keep Ollama input tokens small.
    const MAX_CHUNK_CHARS = 400;
    const contextChunks = relevantChunks
      .slice(0, 3)
      .map((chunk: any, idx: number) => {
        const text = (chunk.metadata.chunk_text || '').slice(0, MAX_CHUNK_CHARS);
        return `[Source ${idx + 1}]: ${text}`;
      })
      .join('\n\n');

    logger.info(
      `Context built with ${Math.min(relevantChunks.length, 3)} chunks (~${contextChunks.length} chars total)`,
    );

    // 4. Check for escalation keywords
    const escalationRulesResult = await query(
      `SELECT config FROM escalation_rules WHERE organization_id = $1 AND rule_type = 'keyword' AND enabled = true`,
      [req.organization_id]
    );

    let shouldEscalate = false;
    let escalationReason: string | undefined;

    if (escalationRulesResult.rows.length > 0) {
      const rule = escalationRulesResult.rows[0];
      const keywords = rule.config.keywords || [];
      if (detectKeywords(req.message, keywords)) {
        shouldEscalate = true;
        escalationReason = 'keyword_match';
      }
    }

    // 5. Generate answer using LLM
    let answer = '';
    let confidence = 0;
    let confidenceReason = 'No confidence signal available.';

    let usedVectorStore = false;
    let vectorStoreNote: string | undefined;

    const systemPromptForContext = `You are a concise customer support assistant. Answer based only on the provided context.`;
    const fallbackSystemPrompt = `You are a helpful customer support assistant. Answer clearly and concisely.`;

    try {
      if (!shouldEscalate && shouldUseVectorStore && contextChunks.length > 0) {
        const result = await generateAnswer(systemPromptForContext, req.message, contextChunks);
        answer = result.answer;
        usedVectorStore = true;
        const computed = computeAnswerConfidence({
          usedVectorStore: true,
          relevantChunks,
          answer,
          escalated: false,
        });
        confidence = computed.confidence;
        confidenceReason = computed.reason;

        if (confidence < config.rag.confidence_threshold) {
          shouldEscalate = true;
          escalationReason = 'confidence_low';
          confidenceReason = `${confidenceReason}; below threshold ${config.rag.confidence_threshold.toFixed(2)}.`;
        }
      } else if (!shouldEscalate) {
        const fallbackResult = await generateAnswer(fallbackSystemPrompt, req.message, '');
        answer = `_Note: This answer does not use vector store context._\n\n${fallbackResult.answer}`;
        usedVectorStore = false;
        vectorStoreNote = 'No relevant vector-store content matched the question.';
        const computed = computeAnswerConfidence({
          usedVectorStore: false,
          relevantChunks: [],
          answer: fallbackResult.answer,
          escalated: false,
        });
        confidence = computed.confidence;
        confidenceReason = computed.reason;
      }
    } catch (llmError: any) {
      const isTimeout =
        llmError?.code === 'ECONNABORTED' ||
        llmError?.code === 'ETIMEDOUT' ||
        (llmError?.message || '').toLowerCase().includes('timeout');
      logger.error(`LLM call failed: ${llmError}`);
      answer = isTimeout
        ? 'The AI model is taking too long to respond. Please try again in a moment.'
        : 'An error occurred while generating the answer. Please try again.';
      confidence = 0;
      confidenceReason = 'LLM error/timeout; confidence forced to 0.';
      usedVectorStore = false;
      vectorStoreNote = 'LLM error; no vector context used.';
    }

    if (shouldEscalate && confidence === 0 && !confidenceReason.includes('Escalation')) {
      confidenceReason = 'Escalated response; confidence forced to 0.';
    }

    // 6. Prepare response with sources
    const sources = dedupeSourcesByUrlWithConfidenceRange(relevantChunks.slice(0, 5));

    const messageId = uuidv4();
    const responseTimeSec = Number(((Date.now() - requestStartMs) / 1000).toFixed(3));

    // 7. Store conversation in database
    const messages: Message[] = [
      {
        role: 'user',
        content: req.message,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'bot',
        content: answer,
        timestamp: new Date().toISOString(),
        confidence,
        confidence_reason: confidenceReason,
        response_time_sec: responseTimeSec,
        sources,
      },
    ];

    await query(
      `INSERT INTO conversations (id, organization_id, session_id, messages, message_count, was_escalated, escalation_reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
       messages = conversations.messages || $4,
       message_count = conversations.message_count + COALESCE(array_length($4, 1), 0),
       was_escalated = $6,
       escalation_reason = COALESCE($7, escalation_reason),
       updated_at = NOW()`,
      [conversationId, req.organization_id, req.user_id, messages, messages.length, shouldEscalate, escalationReason]
    );

    return {
      conversation_id: conversationId,
      message_id: messageId,
      role: 'bot',
      content: answer,
      confidence,
      confidence_reason: confidenceReason,
      response_time_sec: responseTimeSec,
      sources,
      should_escalate: shouldEscalate,
      escalation_reason: escalationReason,
      used_vector_store: usedVectorStore,
      vector_store_note: vectorStoreNote,
    };
  } catch (error) {
    logger.error(`Chat processing error: ${error}`);
    throw error;
  }
};

export const getConversation = async (conversationId: string): Promise<any> => {
  try {
    const result = await query(
      `SELECT id, session_id, user_email, user_name, messages, message_count, was_escalated, created_at, updated_at
       FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Conversation not found');
    }

    return result.rows[0];
  } catch (error) {
    logger.error(`Get conversation error: ${error}`);
    throw error;
  }
};

type SSESender = (event: string, data: unknown) => void;

/**
 * Stream the LLM response token-by-token via Server-Sent Events.
 * Caller is responsible for writing SSE headers and calling res.end().
 */
export const processChatStream = async (req: ChatRequest, send: SSESender): Promise<void> => {
  const requestStartMs = Date.now();
  const MIN_VECTOR_RELEVANCE_SCORE = 0.60;

  const conversationId = req.conversation_id || uuidv4();

  // 1. Generate embedding
  const queryEmbedding = await generateEmbedding(req.message);

  // 2. Retrieve relevant chunks
  const retrievedChunks = await queryVectors(queryEmbedding, config.rag.retrieval_top_k, {
    organization_id: req.organization_id,
  });

  const relevantChunks = retrievedChunks.filter(
    (chunk: any) => typeof chunk.score === 'number' && chunk.score >= MIN_VECTOR_RELEVANCE_SCORE
  );
  const shouldUseVectorStore = relevantChunks.length > 0;

  // 3. Build context
  const MAX_CHUNK_CHARS = 400;
  const contextChunks = relevantChunks
    .slice(0, 3)
    .map((chunk: any, idx: number) => {
      const text = (chunk.metadata.chunk_text || '').slice(0, MAX_CHUNK_CHARS);
      return `[Source ${idx + 1}]: ${text}`;
    })
    .join('\n\n');

  // 4. Check escalation keywords
  const escalationRulesResult = await query(
    `SELECT config FROM escalation_rules WHERE organization_id = $1 AND rule_type = 'keyword' AND enabled = true`,
    [req.organization_id]
  );

  let shouldEscalate = false;
  let escalationReason: string | undefined;

  if (escalationRulesResult.rows.length > 0) {
    const rule = escalationRulesResult.rows[0];
    const keywords = rule.config.keywords || [];
    if (detectKeywords(req.message, keywords)) {
      shouldEscalate = true;
      escalationReason = 'keyword_match';
    }
  }

  const sources = dedupeSourcesByUrlWithConfidenceRange(relevantChunks.slice(0, 5));

  // 5. Send metadata before tokens so the UI can prepare
  send('meta', {
    conversation_id: conversationId,
    message_id: uuidv4(),
    should_escalate: shouldEscalate,
    escalation_reason: escalationReason,
    used_vector_store: shouldUseVectorStore,
    vector_store_note: shouldUseVectorStore
      ? undefined
      : 'No relevant vector-store content matched the question.',
    sources,
  });

  // 6. Stream tokens
  let fullAnswer = '';

  if (shouldEscalate) {
    const msg = 'This query requires human support. A support agent will contact you shortly.';
    send('token', { token: msg });
    fullAnswer = msg;
  } else {
    const systemPrompt = shouldUseVectorStore
      ? 'You are a concise customer support assistant. Answer based only on the provided context.'
      : 'You are a helpful customer support assistant. Answer clearly and concisely.';

    const prefix = shouldUseVectorStore ? '' : '_Note: This answer does not use vector store context._\n\n';
    if (prefix) {
      send('token', { token: prefix });
      fullAnswer += prefix;
    }

    try {
      for await (const item of generateAnswerStream(systemPrompt, req.message, contextChunks)) {
        if (item.type === 'thinking') {
          send('think_token', { token: item.content });
        } else {
          fullAnswer += item.content;
          send('token', { token: item.content });
        }
      }
    } catch (llmError: any) {
      const isTimeout =
        llmError?.code === 'ECONNABORTED' ||
        llmError?.code === 'ETIMEDOUT' ||
        (llmError?.message || '').toLowerCase().includes('timeout');
      fullAnswer = isTimeout
        ? 'The AI model is taking too long to respond. Please try again in a moment.'
        : 'An error occurred while generating the answer. Please try again.';
      send('token', { token: fullAnswer });
    }
  }

  const computed = computeAnswerConfidence({
    usedVectorStore: shouldUseVectorStore,
    relevantChunks,
    answer: fullAnswer,
    escalated: shouldEscalate,
  });
  const confidence = computed.confidence;
  const confidenceReason = computed.reason;
  const responseTimeSec = Number(((Date.now() - requestStartMs) / 1000).toFixed(3));

  send('done', {
    confidence,
    confidence_reason: confidenceReason,
    response_time_sec: responseTimeSec,
  });

  // 7. Persist conversation
  const messages: Message[] = [
    { role: 'user', content: req.message, timestamp: new Date().toISOString() },
    {
      role: 'bot',
      content: fullAnswer,
      timestamp: new Date().toISOString(),
      confidence,
      confidence_reason: confidenceReason,
      response_time_sec: responseTimeSec,
      sources,
    },
  ];

  await query(
    `INSERT INTO conversations (id, organization_id, session_id, messages, message_count, was_escalated, escalation_reason, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
     messages = conversations.messages || $4,
     message_count = conversations.message_count + COALESCE(array_length($4, 1), 0),
     was_escalated = $6,
     escalation_reason = COALESCE($7, escalation_reason),
     updated_at = NOW()`,
    [conversationId, req.organization_id, req.user_id, messages, messages.length, shouldEscalate, escalationReason]
  );
};
