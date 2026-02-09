export enum SoundType {
  ENVIRONMENT = 'Environment',
  STRUCTURE = 'Structure/Impact', // Low frequency dominance
  VOICE = 'Voice/High Freq'
}

export enum SafetyLevel {
  SAFE = 'SAFE',
  WARNING = 'WARNING',
  DANGER = 'DANGER'
}

export interface AudioEvent {
  id: string;
  timestamp: number; // Absolute timestamp (Date.now())
  relativeTime: number; // Seconds from start of recording
  db: number;
  type: SoundType;
}

export interface AudioStats {
  current: number;
  max: number;
  min: number;
  avg: number;
}