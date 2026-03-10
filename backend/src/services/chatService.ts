import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { generateEmbedding, generateAnswer, detectKeywords } from './llmService';
import { queryVectors } from '../config/vectorDb';
import { config } from '../config/index';
import logger from '../utils/logger';

export interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
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
  sources: Array<{
    source_id: string;
    name: string;
    url?: string;
  }>;
  should_escalate: boolean;
  escalation_reason?: string;
  used_vector_store: boolean;
  vector_store_note?: string;
}

export const processChat = async (req: ChatRequest): Promise<ChatResponse> => {
  try {
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

    let usedVectorStore = false;
    let vectorStoreNote: string | undefined;

    const systemPromptForContext = `You are a concise customer support assistant. Answer based only on the provided context.`;
    const fallbackSystemPrompt = `You are a helpful customer support assistant. Answer clearly and concisely.`;

    try {
      if (!shouldEscalate && shouldUseVectorStore && contextChunks.length > 0) {
        const result = await generateAnswer(systemPromptForContext, req.message, contextChunks);
        answer = result.answer;
        confidence = result.confidence;
        usedVectorStore = true;

        if (confidence < config.rag.confidence_threshold) {
          shouldEscalate = true;
          escalationReason = 'confidence_low';
        }
      } else if (!shouldEscalate) {
        const fallbackResult = await generateAnswer(fallbackSystemPrompt, req.message, '');
        answer = `_Note: This answer does not use vector store context._\n\n${fallbackResult.answer}`;
        confidence = Math.max(0.5, fallbackResult.confidence);
        usedVectorStore = false;
        vectorStoreNote = 'No relevant vector-store content matched the question.';
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
      usedVectorStore = false;
      vectorStoreNote = 'LLM error; no vector context used.';
    }

    // 6. Prepare response with sources
    const sources = relevantChunks.slice(0, 5).map((chunk: any) => ({
      source_id: chunk.metadata.source_id,
      name: chunk.metadata.source_name,
      url: chunk.metadata.source_url,
      score: chunk.score,
    }));

    const messageId = uuidv4();

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
        sources,
      },
    ];

    await query(
      `INSERT INTO conversations (id, organization_id, session_id, messages, message_count, was_escalated, escalation_reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
       messages = array_append(conversations.messages, $4[2]),
       message_count = conversations.message_count + 1,
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
