import axios from 'axios';
import OpenAI from 'openai';
import { config } from '../config/index';
import logger from '../utils/logger';

let openaiClient: OpenAI | null = null;

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

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
  context: string,
  options?: { enableThinking?: boolean },
): Promise<{ answer: string; confidence: number; token_usage?: TokenUsage }> => {
  try {
    let answer = '';
    let tokenUsage: TokenUsage | undefined;

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
          think: options?.enableThinking === true,
          prompt,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 800,
            top_k: 40,
            top_p: 0.9,
          },
        },
        { timeout: 180000 },
      );

      const promptTokens = Number(response.data?.prompt_eval_count) || 0;
      const completionTokens = Number(response.data?.eval_count) || 0;
      const totalTokens = Number(response.data?.eval_count + response.data?.prompt_eval_count) || 0;
      tokenUsage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      };

      // Strip <think>...</think> block — the answer is what follows it
      const rawOllama = (response.data.response || '').trim();
      const thinkClose = rawOllama.indexOf('</think>');
      answer = thinkClose >= 0 ? rawOllama.slice(thinkClose + 8).trimStart() : rawOllama;
      if (!answer && rawOllama.includes('<think>')) {
        // Thinking consumed all tokens — fall back to raw content minus tags
        answer = rawOllama.replace(/<\/?think>/g, '').trim();
      }
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
      tokenUsage = {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      };
    }

    // Return the raw answer; confidence is computed by the caller which has
    // access to vector scores and other context signals.
    return { answer, confidence: 0, token_usage: tokenUsage };
  } catch (error) {
    logger.error(`Answer generation error: ${error}`);
    throw error;
  }
};

/**
 * Stream tokens from the LLM directly into an async generator.
 * Callers iterate `for await (const token of generateAnswerStream(...))`.
 */
export async function* generateAnswerStream(
  systemPrompt: string,
  userQuery: string,
  context: string,
  options?: { enableThinking?: boolean },
): AsyncGenerator<
  | { type: 'thinking' | 'response'; content: string }
  | { type: 'usage'; token_usage: TokenUsage }
> {
  if (config.llm.provider === 'ollama') {
    const prompt =
      context.trim().length > 0
        ? `You are a concise support assistant. Use ONLY the context below.\nContext:\n${context}\nQuestion: ${userQuery}\nAnswer briefly:`
        : `${systemPrompt}\nQuestion: ${userQuery}\nAnswer briefly:`;

    const response = await axios.post(
      `${config.llm.ollama.api_url}/api/generate`,
      {
        model: config.llm.ollama.model,
        think: options?.enableThinking === true,
        prompt,
        stream: true,
        options: {
          temperature: 0.2,
          num_predict: 800,
          top_k: 40,
          top_p: 0.9,
        },
      },
      { responseType: 'stream', timeout: 180000 },
    );

    let buffer = '';
    // Track inline <think> tag state for models that embed thinking in `response`
    let inThinkBlock = false;
    for await (const chunk of response.data) {
      buffer += (chunk as Buffer).toString('utf8');
      // Ollama streams NDJSON — split on newlines
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          // Native Ollama thinking field (qwen3 / thinking-mode models)
          if (parsed.thinking) {
            yield { type: 'thinking', content: parsed.thinking };
          }
          if (parsed.response) {
            // Detect inline <think> tags (models that embed thinking in response)
            let text: string = parsed.response;
            let out = '';
            while (text.length > 0) {
              if (inThinkBlock) {
                const closeIdx = text.indexOf('</think>');
                if (closeIdx >= 0) {
                  yield { type: 'thinking', content: text.slice(0, closeIdx) };
                  inThinkBlock = false;
                  text = text.slice(closeIdx + 8);
                } else {
                  yield { type: 'thinking', content: text };
                  text = '';
                }
              } else {
                const openIdx = text.indexOf('<think>');
                if (openIdx >= 0) {
                  out = text.slice(0, openIdx);
                  if (out) yield { type: 'response', content: out };
                  inThinkBlock = true;
                  text = text.slice(openIdx + 7);
                } else {
                  yield { type: 'response', content: text };
                  text = '';
                }
              }
            }
          }
          if (parsed.done) {
            yield {
              type: 'usage',
              token_usage: {
                prompt_tokens: Number(parsed.prompt_eval_count) || 0,
                completion_tokens: Number(parsed.eval_count) || 0,
                total_tokens: (Number(parsed.prompt_eval_count) || 0) + (Number(parsed.eval_count) || 0),
              },
            };
            return;
          }
        } catch {
          // partial JSON — keep buffering
        }
      }
    }
    // flush remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        if (parsed.thinking) yield { type: 'thinking', content: parsed.thinking };
        if (parsed.response) yield { type: 'response', content: parsed.response };
      } catch {
        // ignore
      }
    }
  } else {
    // OpenAI streaming
    const client = getOpenAIClient();
    const stream = await client.chat.completions.create({
      model: config.llm.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Context:\n${context}\n\nQuery: ${userQuery}` },
      ],
      temperature: 0.7,
      max_tokens: config.rag.max_context_tokens,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield { type: 'response', content: delta };

      if (chunk.usage) {
        yield {
          type: 'usage',
          token_usage: {
            prompt_tokens: chunk.usage.prompt_tokens || 0,
            completion_tokens: chunk.usage.completion_tokens || 0,
            total_tokens: chunk.usage.total_tokens || 0,
          },
        };
      }
    }
  }
}

export const detectKeywords = (text: string, keywords: string[]): boolean => {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
};
