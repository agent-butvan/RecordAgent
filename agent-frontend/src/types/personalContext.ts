export interface PersonalContextSettings {
  enabled: boolean;
  profile: string;
  source: 'explicit' | 'legacy' | 'empty';
  estimatedTokens: number;
  profileTokenBudget: number;
  memoryTokenBudget: number;
  totalTokenBudget: number;
  maxProfileChars: number;
}
