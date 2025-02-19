import { type UserPreferences, type InsertPreferences, type Translation } from "@shared/schema";

export interface IStorage {
  getPreferences(): Promise<UserPreferences>;
  updatePreferences(prefs: InsertPreferences): Promise<UserPreferences>;
  getTranslations(url: string): Promise<Translation[]>;
  saveTranslation(translation: Omit<Translation, "id">): Promise<Translation>;
}

export class MemStorage implements IStorage {
  private preferences: UserPreferences;
  private translations: Map<string, Translation[]>;
  private currentId: number;

  constructor() {
    this.preferences = {
      id: 1,
      translationPercentage: 30,
      lastUrl: null
    };
    this.translations = new Map();
    this.currentId = 1;
  }

  async getPreferences(): Promise<UserPreferences> {
    return this.preferences;
  }

  async updatePreferences(prefs: InsertPreferences): Promise<UserPreferences> {
    this.preferences = {
      ...this.preferences,
      ...prefs
    };
    return this.preferences;
  }

  async getTranslations(url: string): Promise<Translation[]> {
    return this.translations.get(url) || [];
  }

  async saveTranslation(translation: Omit<Translation, "id">): Promise<Translation> {
    const id = this.currentId++;
    const newTranslation = { ...translation, id };
    
    const urlTranslations = this.translations.get(translation.url) || [];
    urlTranslations.push(newTranslation);
    this.translations.set(translation.url, urlTranslations);
    
    return newTranslation;
  }
}

export const storage = new MemStorage();
