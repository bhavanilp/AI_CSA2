import axios from 'axios';
import OpenAI from 'openai';
import { config } from '../config/index';
import logger from '../utils/logger';

let openaiClient: OpenAI | null = null;

export const initializeOpenAI = (): void => {
  if (config.llm.provider === 'openai') {
    openaiClient = new OpenAI({
      apiKey: config.llm.openai.api_key,
    });
    logger.info('OpenAI client initialized');
    return;
  }

  if (config.llm.provider === 'ollama') {
    logger.info(`Ollama provider configured at ${config.llm.ollama.api_url}`);
    return;
  }

  throw new Error(`Unsupported LLM provider: ${config.llm.provider}`);
};

export const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    throw new Error('OpenAI not initialized');
  }
  return openaiClient;
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    if (config.llm.provider === 'ollama') {
      const response = await axios.post(
        `${config.llm.ollama.api_url}/api/embeddings`,
        {
          model: config.llm.ollama.embedding_model,
          prompt: text.slice(0, 2000), // cap input to avoid slow embeddings
        },
        { timeout: 30000 },
      );
      return response.data.embedding;
    }

    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: config.llm.openai.embedding_model,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error(`Embedding generation error: ${error}`);
    throw error;
  }
};

export const generateAnswer = async (
  systemPrompt: string,
  userQuery: string,
  context: string
): Promise<{ answer: string; confidence: number }> => {
  try {
    let answer = '';

    if (config.llm.provider === 'ollama') {
      // Keep the Ollama prompt short to minimise input token processing time.
      // Full system prompt + large context causes multi-minute timeouts on local LLMs.
      const prompt =
        context.trim().length > 0
          ? `You are a concise support assistant. Use ONLY the context below.\nContext:\n${context}\nQuestion: ${userQuery}\nAnswer briefly:`
          : `${systemPrompt}\nQuestion: ${userQuery}\nAnswer briefly:`;

      const response = await axios.post(
        `${config.llm.ollama.api_url}/api/generate`,
        {
          model: config.llm.ollama.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 200,
            top_k: 40,
            top_p: 0.9,
          },
        },
        { timeout: 180000 },
      );
      answer = (response.data.response || '').trim();
      logger.info(`LLM response: "${answer.slice(0, 120)}..."`);
    } else {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: config.llm.openai.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Context:\n${context}\n\nQuery: ${userQuery}`,
          },
        ],
        temperature: 0.7,
        max_tokens: config.rag.max_context_tokens,
      });

      answer = response.choices[0].message.content || '';
    }

    const confidence = answer.length > 10 && answer.length < 500 ? 0.8 : 0.2;
    return { answer, confidence };
  } catch (error) {
    logger.error(`Answer generation error: ${error}`);
    throw error;
  }
};

export const detectKeywords = (text: string, keywords: string[]): boolean => {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
};
