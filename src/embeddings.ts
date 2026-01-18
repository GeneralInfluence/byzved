/**
 * Send a prompt to OpenAI API and return the answer
 * @param prompt The prompt string
 * @returns The model's answer or error message
 */
export async function sendPromptToOpenAI(prompt: string): Promise<string> {
  if (!openaiClient) {
    logger.error('OpenAI client not initialized.');
    return 'OpenAI client not initialized.';
  }
  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that answers questions about Telegram group data.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 512,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    logger.error('Error sending prompt to OpenAI:', error);
    return 'Error communicating with OpenAI API.';
  }
}
import { ConversationRecord } from './types.js';
/**
 * Format Telegram messages into a prompt for OpenAI
 * @param messages Array of ConversationRecord
 * @param userQuestion The user's question
 * @returns Formatted prompt string
 */
export function buildOpenAIPrompt(messages: ConversationRecord[], userQuestion: string): string {
  const context = messages
    .map(msg => {
      const user = msg.user_name || msg.user_first_name || 'User';
      const group = msg.group_id ? `Group/Channel ID: ${msg.group_id}` : '';
      return `[${msg.timestamp}] ${user} (${group}): ${msg.text}`;
    })
    .join('\n');
  return (
    `Context (recent messages with user and group info):\n${context}\n\n` +
    `Question: ${userQuestion}\n` +
    `Answer (reference the users and context above in your response):`
  );
}
/**
 * Embeddings module for generating vector embeddings
 * Supports OpenAI and Google Gemini APIs
 * Falls back gracefully if neither API key is available
 *
 * Priority order:
 * 1. OpenAI (1536-dimensional vectors)
 * 2. Google Gemini (768-dimensional vectors)
 * 3. None (messages ingested without embeddings)
 */

import { EmbeddingResult } from './types.js';
import { logger } from './logger.js';

let openaiClient: any = null;
let geminiClient: any = null;
let embeddingsAvailable = false;
let embeddingsProvider: 'openai' | 'gemini' | null = null;

/**
 * Initialize embeddings with available providers
 * @param openaiKey Optional OpenAI API key
 * @param geminiKey Optional Google Gemini API key
 * @throws No error thrown; gracefully falls back to null provider
 */
export async function initEmbeddings(
  openaiKey?: string,
  geminiKey?: string
): Promise<void> {
  try {
    // Try OpenAI first (highest priority)
    if (openaiKey) {
      try {
        const { OpenAI } = await import('openai');
        openaiClient = new OpenAI({ apiKey: openaiKey });
        embeddingsAvailable = true;
        embeddingsProvider = 'openai';
        logger.info('✅ OpenAI embeddings initialized');
        return;
      } catch (error) {
        logger.warn('Failed to initialize OpenAI:', error instanceof Error ? error.message : String(error));
      }
    }

    // Fall back to Gemini
    if (geminiKey) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        geminiClient = new GoogleGenerativeAI(geminiKey);
        embeddingsAvailable = true;
        embeddingsProvider = 'gemini';
        logger.info('✅ Google Gemini embeddings initialized');
        return;
      } catch (error) {
        logger.warn('Failed to initialize Gemini:', error instanceof Error ? error.message : String(error));
      }
    }

    // No provider available
    logger.warn(
      '⚠️  No embedding provider configured (OpenAI or Gemini API keys missing). Messages will be ingested without vector embeddings.'
    );
    embeddingsAvailable = false;
    embeddingsProvider = null;
  } catch (error) {
    logger.error('Unexpected error during embeddings initialization:', error);
    embeddingsAvailable = false;
    embeddingsProvider = null;
  }
}

/**
 * Generate embedding for a text string using OpenAI
 * @param text Text to embed
 * @returns Vector embedding or null on error
 * @private
 */
async function generateOpenAIEmbedding(text: string): Promise<number[] | null> {
  if (!openaiClient) {
    return null;
  }

  try {
    const response = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0]?.embedding || null;
  } catch (error) {
    logger.error('Error generating OpenAI embedding:', error);
    return null;
  }
}

/**
 * Generate embedding for a text string using Google Gemini
 * @param text Text to embed
 * @returns Vector embedding or null on error
 * @private
 */
async function generateGeminiEmbedding(text: string): Promise<number[] | null> {
  if (!geminiClient) {
    return null;
  }

  try {
    const model = geminiClient.getGenerativeModel({
      model: 'embedding-001',
    });

    const result = await model.embedContent(text);
    return result.embedding.values || null;
  } catch (error) {
    logger.error('Error generating Gemini embedding:', error);
    return null;
  }
}

/**
 * Generate embedding for a text string
 * Automatically uses configured provider or returns null if unavailable
 * @param text Text to embed
 * @returns Embedding result with embedding vector or null
 */
export async function generateEmbedding(
  text: string
): Promise<EmbeddingResult> {
  if (!embeddingsAvailable) {
    return { text, embedding: null };
  }

  let embedding: number[] | null = null;

  try {
    if (embeddingsProvider === 'openai') {
      embedding = await generateOpenAIEmbedding(text);
    } else if (embeddingsProvider === 'gemini') {
      embedding = await generateGeminiEmbedding(text);
    }
  } catch (error) {
    logger.error('Unexpected error during embedding generation:', error);
  }

  return { text, embedding };
}

/**
 * Check if embeddings are available
 * @returns True if an embedding provider is initialized
 */
export function areEmbeddingsAvailable(): boolean {
  return embeddingsAvailable;
}

/**
 * Get current embeddings provider name
 * @returns Provider name ('OPENAI', 'GEMINI', or 'None')
 */
export function getEmbeddingsProvider(): string {
  return embeddingsProvider ? `${embeddingsProvider.toUpperCase()}` : 'None';
}

/**
 * Batch generate embeddings for multiple texts using OpenAI
 * @param texts Array of texts to embed
 * @returns Array of embedding results
 * @private
 */
async function generateBatchOpenAIEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (!openaiClient) {
    return texts.map((text) => ({ text, embedding: null }));
  }

  try {
    const response = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });

    return texts.map((text, index) => ({
      text,
      embedding: response.data[index]?.embedding || null,
    }));
  } catch (error) {
    logger.error('Error generating batch OpenAI embeddings:', error);
    return texts.map((text) => ({ text, embedding: null }));
  }
}

/**
 * Batch generate embeddings for multiple texts using Gemini
 * @param texts Array of texts to embed
 * @returns Array of embedding results
 * @private
 */
async function generateBatchGeminiEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (!geminiClient) {
    return texts.map((text) => ({ text, embedding: null }));
  }

  try {
    const model = geminiClient.getGenerativeModel({
      model: 'embedding-001',
    });

    const results = await Promise.all(
      texts.map(async (text) => {
        try {
          const result = await model.embedContent(text);
          return result.embedding.values || null;
        } catch (error) {
          logger.debug(`Error embedding text: ${error}`);
          return null;
        }
      })
    );

    return texts.map((text, index) => ({
      text,
      embedding: results[index],
    }));
  } catch (error) {
    logger.error('Error generating batch Gemini embeddings:', error);
    return texts.map((text) => ({ text, embedding: null }));
  }
}

/**
 * Batch generate embeddings for multiple texts
 * Uses configured provider or returns nulls if unavailable
 * @param texts Array of texts to embed
 * @returns Array of embedding results
 */
export async function generateBatchEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (!embeddingsAvailable) {
    return texts.map((text) => ({ text, embedding: null }));
  }

  try {
    if (embeddingsProvider === 'openai') {
      return generateBatchOpenAIEmbeddings(texts);
    } else if (embeddingsProvider === 'gemini') {
      return generateBatchGeminiEmbeddings(texts);
    }
  } catch (error) {
    logger.error('Unexpected error during batch embedding generation:', error);
  }

  return texts.map((text) => ({ text, embedding: null }));
}

