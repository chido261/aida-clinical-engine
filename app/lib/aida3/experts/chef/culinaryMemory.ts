import type { StoredRecipeOption } from "./contracts";

export interface CulinaryMemory {
  saveOptions(conversationId: string, options: StoredRecipeOption[]): Promise<void>;
  getOption(conversationId: string, recipeId: string): Promise<StoredRecipeOption | null>;
}

export class InMemoryCulinaryMemory implements CulinaryMemory {
  private readonly conversations = new Map<string, Map<string, StoredRecipeOption>>();

  async saveOptions(conversationId: string, options: StoredRecipeOption[]) {
    const recipes = this.conversations.get(conversationId) ?? new Map<string, StoredRecipeOption>();
    for (const option of options) recipes.set(option.id, structuredClone(option));
    this.conversations.set(conversationId, recipes);
  }

  async getOption(conversationId: string, recipeId: string) {
    const option = this.conversations.get(conversationId)?.get(recipeId);
    return option ? structuredClone(option) : null;
  }
}
