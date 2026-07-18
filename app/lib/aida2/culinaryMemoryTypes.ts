export type Aida2CulinaryMemory = {
  target: string | null;
  requestedCount: number;
  deliveredCount: number;
  selectedOption: number | null;
  options: Array<{
    index: number;
    title: string;
    ingredients: Array<{ name: string; amount: string }>;
    steps: string[];
  }>;
  updatedAt: string;
};
