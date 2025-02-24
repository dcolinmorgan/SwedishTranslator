import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  translationPercentage: integer("translation_percentage").notNull().default(30),
  lastUrl: text("last_url"),
  language: text("language").notNull().default("swedish"),
});

export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text").notNull(),
  url: text("url").notNull()
});

export const insertPreferencesSchema = createInsertSchema(userPreferences).pick({
  translationPercentage: true,
  lastUrl: true,
  language: true
});

export const webpageSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  translationPercentage: z.number().min(0).max(100),
  language: z.string()
});

export type InsertPreferences = z.infer<typeof insertPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type Translation = typeof translations.$inferSelect;