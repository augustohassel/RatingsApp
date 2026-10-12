export const DAILY_MOOD_TOPIC_ID = 'topic-daily-mood';

export interface TopicItemDefinition {
  id: string;
  name: string;
  explanation?: string;
  defaultWeight: number; // 1 to 10
}

export interface Topic {
  id: string;
  name: string; // e.g., "Trabajo", "Natación"
  description?: string;
  color: string; // Tailwind color or hex (e.g., "#6366f1")
  icon: string; // Lucide icon name, e.g., "Briefcase", "Activity", "Heart", "Smile"
  items: TopicItemDefinition[];
  isSystem?: boolean; // Protect system topics like daily mood
  createdAt: number;
  updatedAt: number;
}

export interface EvaluationItemValue {
  itemId: string;
  name: string;
  explanation?: string;
  weight: number; // Ponderación / Importancia elegida en ese momento (1-10)
  percentage: number; // Porcentaje sobre el total de pesos (ej: 8.42%)
  score: number; // Valorización nominal (1-10)
  contribution: number; // Aporte ponderado = (percentage / 100) * score
}

export interface EvaluationEntry {
  id: string;
  topicId: string;
  date: string; // ISO date string YYYY-MM-DDTHH:mm:ss
  items: EvaluationItemValue[];
  totalWeight: number; // Suma de valoraciones de categorías (ej: 95)
  finalScore: number; // Promedio ponderado final (ej: 8.20)
  notes?: string; // Comentarios / reflexiones personales
  createdAt: number;
}

export interface DailyAggregatedScore {
  dateStr: string; // 'YYYY-MM-DD'
  date: Date;
  day: number; // 1-31
  month: number; // 0-11
  year: number;
  averageScore: number;
  count: number;
  entries: EvaluationEntry[];
  notes: string[];
}

export interface MonthlyAverage {
  monthIndex: number; // 0 to 11
  monthName: string; // 'Ene', 'Feb', ...
  averageScore: number | null;
  count: number;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  topics: Topic[];
  evaluations: EvaluationEntry[];
}

