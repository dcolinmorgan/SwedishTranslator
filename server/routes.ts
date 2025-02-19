import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { webpageSchema } from "@shared/schema";
import * as cheerio from "cheerio";
import axios from "axios";

async function translateText(text: string): Promise<string> {
  // Mock translation for now - would use Google Translate API in production
  return `${text} (på svenska)`;
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
      return res.status(400).json({ error: "Invalid input" });
    }

    try {
      const { url, translationPercentage } = result.data;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Get all text nodes
      const textNodes = $("p, h1, h2, h3, h4, h5, h6, span, div").contents().filter(function(this: any) {
        return this.type === 'text' && this.data.trim().length > 0;
      });

      // Calculate how many nodes to translate
      const nodesToTranslate = Math.floor(textNodes.length * (translationPercentage / 100));

      // Randomly select nodes to translate
      const indices = new Set();
      while (indices.size < nodesToTranslate) {
        indices.add(Math.floor(Math.random() * textNodes.length));
      }

      // Translate selected nodes
      for (let i = 0; i < textNodes.length; i++) {
        if (indices.has(i)) {
          const node = textNodes[i];
          const originalText = $(node).text().trim();
          const translatedText = await translateText(originalText);

          await storage.saveTranslation({
            originalText,
            translatedText,
            url
          });

          $(node).replaceWith(translatedText);
        }
      }

      res.json({ html: $.html() });
    } catch (error) {
      res.status(500).json({ error: "Failed to translate webpage" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}