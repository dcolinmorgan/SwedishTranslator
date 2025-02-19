import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { webpageSchema } from "@shared/schema";
import * as cheerio from "cheerio";
import axios from "axios";

async function translateText(text: string): Promise<string> {
  // Mock translation for now - would use Google Translate API in production
  // This is a simple mock dictionary for demonstration
  const translations: Record<string, string> = {
    'the': 'den',
    'hello': 'hej',
    'world': 'världen',
    'welcome': 'välkommen',
    'to': 'till',
    'page': 'sida',
    'this': 'denna',
    'is': 'är',
    'a': 'en',
    'test': 'test',
    'website': 'webbplats',
    'thank': 'tack',
    'you': 'du',
    'for': 'för',
    'visiting': 'besöker',
  };

  // Split the text into words while preserving punctuation and spaces
  return text.replace(/\b\w+\b/g, (word) => {
    const lowerWord = word.toLowerCase();
    if (translations[lowerWord]) {
      // Wrap the Swedish translation in a span with the original word as a title
      return `<span class="swedish-text" title="Original: ${word}">${translations[lowerWord]}</span>`;
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
      const { url, translationPercentage } = result.data;
      console.log(`Fetching URL: ${url} with translation percentage: ${translationPercentage}%`);

      // Add browser-like headers
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000, // 10 second timeout
      });

      const $ = cheerio.load(response.data);

      // Add our custom styles for Swedish text
      $('head').append(`
        <style>
          .swedish-text {
            color: #2563eb;
            background-color: rgba(37, 99, 235, 0.1);
            padding: 0 2px;
            border-radius: 2px;
            cursor: help;
            text-decoration: underline dotted #2563eb;
            text-underline-offset: 2px;
          }
        </style>
      `);

      // Get all text nodes
      const textNodes = $("p, h1, h2, h3, h4, h5, h6, span, div").contents().filter(function(this: any) {
        return this.type === 'text' && this.data.trim().length > 0;
      });

      console.log(`Found ${textNodes.length} text nodes to potentially translate`);

      // Calculate total text content length
      let totalLength = 0;
      const nodesToProcess: { node: any; text: string; length: number }[] = [];
      
      textNodes.each(function() {
        const text = $(this).text().trim();
        const length = text.length;
        if (length > 0) {
          nodesToProcess.push({ node: this, text, length });
          totalLength += length;
        }
      });

      // Calculate target length to translate
      const targetLength = Math.floor(totalLength * (translationPercentage / 100));
      let currentLength = 0;
      let translatedCount = 0;

      console.log(`Total text length: ${totalLength}, Target length to translate: ${targetLength}`);

      // Translate nodes until we reach the target percentage
      for (const { node, text } of nodesToProcess) {
        if (currentLength >= targetLength) break;

        const translatedText = await translateText(text);
        await storage.saveTranslation({
          originalText: text,
          translatedText,
          url
        });

        $(node).replaceWith(translatedText);
        currentLength += text.length;
        translatedCount++;
      }

      const actualPercentage = (currentLength / totalLength) * 100;
      console.log(`Successfully translated ${translatedCount} text nodes (${actualPercentage.toFixed(1)}% of content)`);

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
