import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Until this file existed the site served no robots.txt at all, so /robots.txt
 * answered 404 and every well-behaved fetcher had to infer its permissions
 * from that. Search crawlers read a 404 as "allowed"; the assistant fetchers
 * that open a link on a reader's behalf are stricter, and several of them
 * decline a page whose robots.txt is anything other than a clean 2xx allow.
 * That is the difference between "the site is down" and "the assistant would
 * not open it", which is what a reader actually sees.
 *
 * So the answer is now given explicitly, and given twice: once to the wildcard
 * and once to each assistant agent by name, so that permission never depends
 * on a client's wildcard handling or on a future platform-level default.
 */

/** Assistant and answer-engine agents, named so none of them has to guess. */
const ASSISTANT_AGENTS = [
  // Anthropic — ClaudeBot indexes, Claude-User fetches a link a reader pasted.
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  // OpenAI
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  // Perplexity
  'PerplexityBot',
  'Perplexity-User',
  // The rest of the field
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'meta-externalagent',
  'Amazonbot',
  'Bytespider',
  'CCBot',
  'cohere-ai',
  'DuckAssistBot',
  'MistralAI-User',
  'YouBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: ASSISTANT_AGENTS, allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
