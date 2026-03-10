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
}

export const processChat = async (req: ChatRequest): Promise<ChatResponse> => {
  try {
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

    logger.info(`Retrieved ${retrievedChunks.length} chunks for query`);

    // 3. Build context from retrieved chunks
    const contextChunks = retrievedChunks
      .slice(0, 5)
      .map((chunk: any, idx: number) => `[Source ${idx + 1}]: ${chunk.metadata.chunk_text || ''}`)
      .join('\n\n');

    logger.info(`Context built with ${retrievedChunks.slice(0, 5).length} chunks, total length: ${contextChunks.length}`);

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

    if (!shouldEscalate && contextChunks.length > 0) {
      const systemPrompt = `You are a helpful and knowledgeable customer support AI assistant. 
Answer questions based on the provided context below.
Be direct, specific, and accurate in your responses.
If the context contains the answer, provide it clearly and concisely.
If you cannot find the answer in the context, say "I don't have that information available."

Context:
${contextChunks}`;

      const result = await generateAnswer(systemPrompt, req.message, '');
      answer = result.answer;
      confidence = result.confidence;

      // Check if confidence is too low
      if (confidence < config.rag.confidence_threshold) {
        shouldEscalate = true;
        escalationReason = 'confidence_low';
      }
    } else if (!shouldEscalate) {
      answer = `I couldn't find information about that. Let me connect you with a support agent.`;
      confidence = 0.3;
      shouldEscalate = true;
      escalationReason = 'confidence_low';
    }

    // 6. Prepare response with sources
    const sources = retrievedChunks.slice(0, 5).map((chunk: any) => ({
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
