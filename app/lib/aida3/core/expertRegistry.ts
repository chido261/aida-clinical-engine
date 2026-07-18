import type { Aida3Expert } from "./expert";

export class Aida3ExpertRegistry {
  private readonly experts = new Map<string, Aida3Expert>();

  register(expert: Aida3Expert) {
    if (this.experts.has(expert.id)) {
      throw new Error(`AIDA3_EXPERT_ALREADY_REGISTERED:${expert.id}`);
    }
    this.experts.set(expert.id, expert);
    return this;
  }

  get(expertId: string) {
    return this.experts.get(expertId) ?? null;
  }

  list() {
    return [...this.experts.keys()];
  }
}

