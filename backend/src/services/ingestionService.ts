import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { generateEmbedding } from './llmService';
import { upsertVectors } from '../config/vectorDb';
import { config } from '../config/index';
import logger from '../utils/logger';

const cleanText = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .replace(/[\t\n\r]+/g, ' ')
    .trim();

const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
  const words = text.split(' ');
  const chunks: string[] = [];
  const step = Math.max(1, chunkSize - overlap);

  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ').trim();
    if (chunk.length > 120) {
      chunks.push(chunk);
    }
  }

  return chunks;
};

const extractWikipediaContent = ($: cheerio.CheerioAPI): string => {
  // Remove unwanted elements
  $('script, style, noscript, iframe, svg, .mw-editsection, .navbox, .infobox, .reference, sup.reference').remove();
  
  const contentBlocks: string[] = [];
  
  // Extract main title
  const title = $('#firstHeading').text().trim();
  if (title) {
    contentBlocks.push(`Title: ${title}`);
  }
  
  // Extract intro paragraph
  const intro = $('#mw-content-text .mw-parser-output > p').first().text().trim();
  if (intro && intro.length > 50) {
    contentBlocks.push(intro);
  }
  
  // Extract all content including sections
  $('#mw-content-text .mw-parser-output').find('h1, h2, h3, h4, p, li, table').each((_idx, el) => {
    const $el = $(el);
    const tagName = el.tagName.toLowerCase();
    
    if (tagName.match(/^h[1-4]$/)) {
      // Section headers
      const headerText = cleanText($el.text().replace(/\[edit\]/g, ''));
      if (headerText && headerText.length > 2) {
        contentBlocks.push(`\n${headerText}:`);
      }
    } else if (tagName === 'p') {
      // Paragraphs
      const paraText = cleanText($el.text());
      if (paraText && paraText.length > 40) {
        contentBlocks.push(paraText);
      }
    } else if (tagName === 'li') {
      // List items
      const liText = cleanText($el.text());
      if (liText && liText.length > 20) {
        contentBlocks.push(`- ${liText}`);
      }
    } else if (tagName === 'table') {
      // Extract key info from tables (like infoboxes)
      $el.find('tr').each((_i, row) => {
        const $row = $(row);
        const header = cleanText($row.find('th').text());
        const data = cleanText($row.find('td').text());
        if (header && data && data.length > 3 && data.length < 200) {
          contentBlocks.push(`${header}: ${data}`);
        }
      });
    }
  });
  
  return contentBlocks.join(' ');
};

const fetchPageText = async (url: string): Promise<string> => {
  const isWikipedia = url.includes('wikipedia.org');
  const targets = [url, `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`];

  for (const target of targets) {
    try {
      const response = await axios.get(target, {
        timeout: 30000,
        maxRedirects: 5,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,text/plain',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const isHtml = /<html|<body|<p|<h1|<h2/i.test(body);

      if (isHtml) {
        const $ = cheerio.load(body);
        
        // Special handling for Wikipedia
        if (isWikipedia && target === url) {
          const wikiContent = extractWikipediaContent($);
          if (wikiContent.length > 500) {
            logger.info(`Extracted ${wikiContent.length} characters from Wikipedia page`);
            return wikiContent;
          }
        }
        
        // Generic HTML extraction
        $('script, style, noscript, iframe, svg').remove();

        const textBlocks: string[] = [];
        $('h1, h2, h3, h4, p, li').each((_idx, el) => {
          const text = cleanText($(el).text());
          if (text.length > 30) {
            textBlocks.push(text);
          }
        });

        const fullText = cleanText(textBlocks.join(' '));
        if (fullText.length > 200) {
          return fullText;
        }
      } else {
        const markdownLikeText = cleanText(
          body
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/`[^`]*`/g, ' ')
            .replace(/[#>*_\-]/g, ' ')
        );

        if (markdownLikeText.length > 200) {
          return markdownLikeText;
        }
      }
    } catch (error) {
      logger.warn(`Failed to fetch from ${target}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  throw new Error('Unable to extract enough text from URL');
};
export const ingestWebsite = async (
  organizationId: string,
  url: string,
  sourceName?: string
): Promise<{ sourceId: string; chunkCount: number; url: string }> => {
  const sourceId = uuidv4();
  const resolvedName = sourceName || new URL(url).hostname;

  logger.info(`Starting ingestion for ${url}`);

  const fullText = await fetchPageText(url);
  logger.info(`Extracted ${fullText.length} characters of text from ${url}`);

  const chunks = chunkText(fullText, config.rag.chunk_size, config.rag.chunk_overlap).slice(0, 50);

  const vectors = [] as Array<{
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }>;

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const embedding = await generateEmbedding(chunk);
    vectors.push({
      id: `${sourceId}-${i + 1}`,
      values: embedding,
      metadata: {
        organization_id: organizationId,
        source_id: sourceId,
        source_name: resolvedName,
        source_url: url,
        chunk_index: i + 1,
        chunk_text: chunk,
      },
    });
  }

  await upsertVectors(vectors);

  logger.info(`Ingestion complete for ${url}. Chunks: ${vectors.length}`);

  return {
    sourceId,
    chunkCount: vectors.length,
    url,
  };
};
