export interface PersonalContextSettings {
  enabled: boolean;
  maintenanceEnabled: boolean;
  profile: string;
  source: 'explicit' | 'legacy' | 'empty';
  revision: string;
  estimatedTokens: number;
  profileTokenBudget: number;
  memoryTokenBudget: number;
  totalTokenBudget: number;
  maxProfileChars: number;
}

export type ProfileChangeOperation = 'ADD' | 'UPDATE' | 'DELETE';

export interface ProfileChange {
  operation: ProfileChangeOperation;
  section: string;
  before: string;
  after: string;
  reason: string;
  sourceIds: string[];
  confidence: number;
}

export interface ProfileProposal {
  id: string;
  baseRevision: string;
  createdAt: string;
  summary: string;
  proposedProfile: string;
  changes: ProfileChange[];
}

export interface ProfileMaintenanceStatus {
  enabled: boolean;
  currentRevision: string;
  lastCheckedAt: string | null;
  lastResult: 'never_checked' | 'no_evidence' | 'no_changes' | 'proposal_ready' | 'accepted' | 'rejected' | 'profile_too_large' | 'failed';
  pendingProposal: ProfileProposal | null;
}
