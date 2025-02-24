import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { webpageSchema } from "@shared/schema";
import * as cheerio from "cheerio";
import axios from "axios";

// Language-specific transformation patterns
const languagePatterns: Record<string, { patterns: Array<{from: string, to: string}>, endings: string[] }> = {
  swedish: {
    patterns: [
      { from: 'th', to: 't' },
      { from: 'ch', to: 'k' },
      { from: 'sh', to: 'sj' },
      { from: 'w', to: 'v' },
      { from: 'oo', to: 'å' },
      { from: 'ee', to: 'i' },
      { from: 'ck', to: 'k' }
    ],
    endings: ['en', 'et', 'ar', 'or', 'er']
  },
  norwegian: {
    patterns: [
      { from: 'th', to: 't' },
      { from: 'ch', to: 'k' },
      { from: 'sh', to: 'sj' },
      { from: 'w', to: 'v' },
      { from: 'oo', to: 'ø' },
      { from: 'ee', to: 'i' }
    ],
    endings: ['en', 'et', 'ene', 'er', 'ene']
  },
  danish: {
    patterns: [
      { from: 'th', to: 't' },
      { from: 'ch', to: 'k' },
      { from: 'sh', to: 'sj' },
      { from: 'w', to: 'v' },
      { from: 'oo', to: 'å' },
      { from: 'ee', to: 'i' }
    ],
    endings: ['en', 'et', 'ene', 'er', 'erne']
  },
  german: {
    patterns: [
      { from: 'th', to: 't' },
      { from: 'sh', to: 'sch' },
      { from: 'w', to: 'v' },
      { from: 'oo', to: 'u' },
      { from: 'ee', to: 'ie' }
    ],
    endings: ['en', 'er', 'es', 'e', 'ung']
  },
  dutch: {
    patterns: [
      { from: 'th', to: 't' },
      { from: 'sh', to: 'sch' },
      { from: 'oo', to: 'oe' },
      { from: 'ee', to: 'ie' }
    ],
    endings: ['en', 'je', 'tje', 'pje', 'heid']
  },
  french: {
    patterns: [
      { from: 'th', to: 't' },
      { from: 'oo', to: 'ou' },
      { from: 'ee', to: 'é' },
      { from: 'k', to: 'que' }
    ],
    endings: ['e', 'es', 'ent', 'ement', 'tion']
  },
  spanish: {
    patterns: [
      { from: 'th', to: 't' },
      { from: 'sh', to: 'ch' },
      { from: 'oo', to: 'u' },
      { from: 'ee', to: 'í' }
    ],
    endings: ['o', 'a', 'os', 'as', 'ción']
  },
  italian: {
    patterns: [
      { from: 'th', to: 't' },
      { from: 'oo', to: 'u' },
      { from: 'ee', to: 'i' },
      { from: 'k', to: 'c' }
    ],
    endings: ['o', 'a', 'i', 'e', 'zione']
  }
};

async function translateText(text: string, language: string): Promise<string> {
  const langConfig = languagePatterns[language] || languagePatterns.swedish;

  function transform(word: string): string {
    let transformed = word.toLowerCase();

    // Apply language-specific patterns
    langConfig.patterns.forEach(({ from, to }) => {
      transformed = transformed.replace(new RegExp(from, 'g'), to);
    });

    // Add language-specific endings
    if (Math.random() < 0.3) {
      const ending = langConfig.endings[Math.floor(Math.random() * langConfig.endings.length)];
      transformed += ending;
    }

    // Preserve original capitalization
    if (word[0] === word[0].toUpperCase()) {
      transformed = transformed.charAt(0).toUpperCase() + transformed.slice(1);
    }

    return transformed;
  }

  // Split the text into words while preserving punctuation and spaces
  return text.replace(/\b\w+\b/g, (word) => {
    // Randomly decide whether to translate this word (50% chance)
    if (Math.random() < 0.5 && word.length > 2) {
      const translatedWord = transform(word);
      // Wrap the translation in a span with the original word as a title
      return `<span class="swedish-text" title="Original: ${word}">${translatedWord}</span>`;
    }
    return word;
  });
}

export async function registerRoutes(app: Express) {
  app.get("/api/preferences", async (_req, res) => {
    const preferences = await storage.getPreferences();
    res.json(preferences);
  });

  app.post("/api/preferences", async (req, res) => {
    const prefs = req.body;
    const updated = await storage.updatePreferences(prefs);
    res.json(updated);
  });

  app.post("/api/translate", async (req, res) => {
    const result = webpageSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Invalid input:", result.error);
      return res.status(400).json({ error: "Invalid input", details: result.error });
    }

    try {
      const { url, translationPercentage, language } = result.data;
      console.log(`Fetching URL: ${url} with translation percentage: ${translationPercentage}%`);

      // Add browser-like headers
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cookie': req.headers.cookie || '', // Forward any cookies from the client
          'Referer': url, // Add referrer for better site compatibility
        },
        timeout: 10000, // 10 second timeout
        maxRedirects: 5, // Allow redirects for login pages
        withCredentials: true, // Important for maintaining session
      });

      const $ = cheerio.load(response.data);

      // Add our custom styles for translated text
      $('head').append(`
        <style>
          .swedish-text {
            color: #2563eb;
            position: relative;
            background-color: rgba(37, 99, 235, 0.1);
            padding: 0 2px;
            border-radius: 2px;
            cursor: help;
            text-decoration: underline dotted #2563eb;
            text-underline-offset: 2px;
          }

          .swedish-text:hover::after {
            content: attr(title);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background-color: #2563eb;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
            white-space: nowrap;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
        </style>
      `);

      // Modify all links to work with our internal routing
      $('a').each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        if (href) {
          try {
            // Convert relative URLs to absolute
            const absoluteUrl = new URL(href, url).href;
            $link.attr('data-original-href', absoluteUrl);
            $link.addClass('translated-link');
          } catch (e) {
            // If URL parsing fails, skip this link
            console.log('Skipping invalid URL:', href);
          }
        }
      });

      // Add script to handle link clicks
      $('body').append(`
        <script>
          document.addEventListener('click', function(e) {
            if (e.target.closest('.translated-link')) {
              e.preventDefault();
              const originalHref = e.target.closest('.translated-link').dataset.originalHref;
              if (originalHref) {
                window.parent.postMessage({ type: 'NAVIGATE', url: originalHref }, '*');
              }
            }
          });
        </script>
      `);

      // Only select paragraph content for translation, excluding headlines and navigation
      const textNodes = $("p, article p, .article-body p, .content p, .story-body p").contents().filter(function() {
        return this.type === 'text' && this.data.trim().length > 0;
      });

      console.log(`Found ${textNodes.length} text nodes to potentially translate`);

      // Calculate how many nodes to translate
      const nodesToTranslate = Math.floor(textNodes.length * (translationPercentage / 100));
      console.log(`Will translate ${nodesToTranslate} nodes`);

      // Randomly select nodes to translate
      const indices = new Set<number>();
      while (indices.size < nodesToTranslate) {
        indices.add(Math.floor(Math.random() * textNodes.length));
      }

      // Translate selected nodes
      let translatedCount = 0;
      for (let i = 0; i < textNodes.length; i++) {
        if (indices.has(i)) {
          const node = textNodes[i];
          const originalText = $(node).text().trim();

          if (originalText.length > 0) {
            const translatedText = await translateText(originalText, language);
            await storage.saveTranslation({
              originalText,
              translatedText,
              url
            });

            $(node).replaceWith(translatedText);
            translatedCount++;
          }
        }
      }

      console.log(`Successfully translated ${translatedCount} text nodes`);

      // Forward cookies from the response back to the client
      if (response.headers['set-cookie']) {
        res.set('Set-Cookie', response.headers['set-cookie']);
      }

      res.json({ html: $.html() });
    } catch (error: any) {
      console.error('Translation error:', error);

      // Handle specific error cases
      if (error.response?.status === 403) {
        return res.status(403).json({
          error: "Access Denied",
          details: "This website doesn't allow automated access. Try one of these test URLs instead:",
          testUrls: [
            "https://example.com",
            "https://www.w3.org/",
            "https://www.webscraper.io/test-sites/e-commerce/allinone"
          ]
        });
      }

      res.status(500).json({
        error: "Failed to translate webpage",
        details: error.message || 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}