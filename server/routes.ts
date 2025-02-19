import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { webpageSchema } from "@shared/schema";
import * as cheerio from "cheerio";
import axios from "axios";

async function translateText(text: string): Promise<string> {
  // Mock translation for now - would use Google Translate API in production
  // Wrap the Swedish translation in an italic tag with a special class
  return `<i class="swedish-text" title="Original: ${text}">${text} (på svenska)</i>`;
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

      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Add our custom styles for Swedish text
      $('head').append(`
        <style>
          .swedish-text {
            font-style: italic;
            color: #2563eb;
            background-color: rgba(37, 99, 235, 0.1);
            padding: 0 2px;
            border-radius: 2px;
            cursor: help;
          }
        </style>
      `);

      // Get all text nodes
      const textNodes = $("p, h1, h2, h3, h4, h5, h6, span, div").contents().filter(function(this: any) {
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
            const translatedText = await translateText(originalText);
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
      res.json({ html: $.html() });
    } catch (error) {
      console.error('Translation error:', error);
      res.status(500).json({ 
        error: "Failed to translate webpage",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}