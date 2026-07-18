import { prisma } from "@/app/lib/prisma";
import type { CulinaryMemory, StoredRecipeOption } from "../experts/chef";

type Metadata = Record<string, unknown> & { aida3?: { culinaryOptions?: StoredRecipeOption[] } };

function parseMetadata(value: string | null | undefined): Metadata {
  if (!value) return {};
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed as Metadata : {}; }
  catch { return {}; }
}

export class PrismaCulinaryMemory implements CulinaryMemory {
  async saveOptions(conversationId: string, options: StoredRecipeOption[]) {
    const current = await prisma.conversationContext.findUnique({ where: { userId: conversationId }, select: { metadataJson: true } });
    const metadata = parseMetadata(current?.metadataJson);
    const existing = metadata.aida3?.culinaryOptions ?? [];
    const merged = new Map(existing.map(option => [option.id, option]));
    for (const option of options) merged.set(option.id, option);
    const metadataJson = JSON.stringify({ ...metadata, aida3: { ...metadata.aida3, culinaryOptions: [...merged.values()] } });
    await prisma.conversationContext.upsert({ where: { userId: conversationId },
      create: { userId: conversationId, metadataJson }, update: { metadataJson } });
  }

  async getOption(conversationId: string, recipeId: string) {
    return (await this.listOptions(conversationId)).find(option => option.id === recipeId) ?? null;
  }

  async listOptions(conversationId: string) {
    const current = await prisma.conversationContext.findUnique({ where: { userId: conversationId }, select: { metadataJson: true } });
    return parseMetadata(current?.metadataJson).aida3?.culinaryOptions ?? [];
  }
}
