import {
  EvaluationItemValue,
  EvaluationEntry,
  DailyAggregatedScore,
  MonthlyAverage,
} from '../types';

export interface RawItemInput {
  itemId: string;
  name: string;
  explanation?: string;
  weight: number;
  score: number;
}

export interface CalculationResult {
  totalWeight: number;
  finalScore: number;
  items: EvaluationItemValue[];
}

/**
 * Calculates weighted ratings exactly matching the Google Sheet formula:
 * TotalWeight = Sum(weight_i)
 * Percentage_i = (weight_i / TotalWeight) * 100
 * Contribution_i = (weight_i / TotalWeight) * score_i
 * FinalScore = Sum(Contribution_i)
 */
export function calculateWeightedRating(inputs: RawItemInput[]): CalculationResult {
  const totalWeight = inputs.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  if (totalWeight === 0) {
    const items: EvaluationItemValue[] = inputs.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      explanation: item.explanation,
      weight: Number(item.weight) || 0,
      percentage: 0,
      score: Number(item.score) || 0,
      contribution: 0,
    }));

    return {
      totalWeight: 0,
      finalScore: 0,
      items,
    };
  }

  const items: EvaluationItemValue[] = inputs.map((item) => {
    const weight = Number(item.weight) || 0;
    const score = Number(item.score) || 0;
    const percentage = (weight / totalWeight) * 100;
    const contribution = (weight / totalWeight) * score;

    return {
      itemId: item.itemId,
      name: item.name,
      explanation: item.explanation,
      weight,
      percentage: Math.round(percentage * 100) / 100, // 2 decimals
      score,
      contribution: Math.round(contribution * 100) / 100, // 2 decimals
    };
  });

  const sumWeightedScores = inputs.reduce((sum, item) => {
    return sum + (Number(item.weight) || 0) * (Number(item.score) || 0);
  }, 0);

  const rawFinalScore = sumWeightedScores / totalWeight;
  const finalScore = Math.round(rawFinalScore * 100) / 100;

  return {
    totalWeight,
    finalScore,
    items,
  };
}

/**
 * Returns a color palette / sentiment based on score (1 to 10)
 */
export function getScoreColor(score: number): {
  text: string;
  bg: string;
  border: string;
  ring: string;
  gradient: string;
} {
  if (score >= 8.0) {
    return {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      ring: 'stroke-emerald-400',
      gradient: 'from-emerald-500 to-teal-400',
    };
  }
  if (score >= 6.5) {
    return {
      text: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      ring: 'stroke-indigo-400',
      gradient: 'from-indigo-500 to-cyan-400',
    };
  }
  if (score >= 5.0) {
    return {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      ring: 'stroke-amber-400',
      gradient: 'from-amber-500 to-yellow-400',
    };
  }
  return {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    ring: 'stroke-rose-400',
    gradient: 'from-rose-500 to-red-400',
  };
}

export const MONTH_NAMES_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

/**
 * Format any date input into YYYY-MM-DD using local timezone
 */
export function toLocalDateString(dateInput: string | Date | number): string {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Aggregates evaluations by day, computing the arithmetic mean for multiple entries on the same day.
 * Preserves all original entries, exact timestamps, and notes.
 */
export function aggregateDailyScores(evaluations: EvaluationEntry[]): DailyAggregatedScore[] {
  const map = new Map<string, EvaluationEntry[]>();

  for (const entry of evaluations) {
    const key = toLocalDateString(entry.date);
    const existing = map.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }

  const result: DailyAggregatedScore[] = [];

  for (const [dateStr, entries] of map.entries()) {
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstDate = new Date(entries[0].date);
    const scores = entries.map((e) => e.finalScore);
    const sum = scores.reduce((a, b) => a + b, 0);
    const averageScore = Math.round((sum / scores.length) * 100) / 100;
    const notes = entries
      .map((e) => e.notes?.trim())
      .filter((n): n is string => Boolean(n));

    result.push({
      dateStr,
      date: firstDate,
      day: firstDate.getDate(),
      month: firstDate.getMonth(),
      year: firstDate.getFullYear(),
      averageScore,
      count: entries.length,
      entries,
      notes,
    });
  }

  return result.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

/**
 * Computes monthly averages (0 = Ene, ..., 11 = Dic) for a given year based on daily aggregated scores.
 */
export function calculateMonthlyAverages(
  dailyAggregations: DailyAggregatedScore[],
  year: number
): MonthlyAverage[] {
  const yearDailyScores = dailyAggregations.filter((d) => d.year === year);

  return MONTH_NAMES_ES.map((monthName, monthIndex) => {
    const monthDays = yearDailyScores.filter((d) => d.month === monthIndex);
    if (monthDays.length === 0) {
      return {
        monthIndex,
        monthName,
        averageScore: null,
        count: 0,
      };
    }

    const sumDailyScores = monthDays.reduce((sum, d) => sum + d.averageScore, 0);
    const averageScore = Math.round((sumDailyScores / monthDays.length) * 100) / 100;

    return {
      monthIndex,
      monthName,
      averageScore,
      count: monthDays.length,
    };
  });
}

/**
 * Returns thermal heatmap color styling for Mood Wrapped cells
 */
export function getMoodHeatmapColor(score: number | null): {
  bg: string;
  text: string;
  border: string;
  hex: string;
} {
  if (score === null || score === undefined) {
    return {
      bg: 'bg-slate-900/40',
      text: 'text-slate-600',
      border: 'border-slate-800/40',
      hex: '#0f172a',
    };
  }

  if (score >= 8.5) {
    return {
      bg: 'bg-emerald-500',
      text: 'text-white font-bold',
      border: 'border-emerald-400',
      hex: '#10b981',
    };
  }
  if (score >= 7.0) {
    return {
      bg: 'bg-emerald-600/90',
      text: 'text-white font-semibold',
      border: 'border-emerald-500',
      hex: '#059669',
    };
  }
  if (score >= 5.5) {
    return {
      bg: 'bg-amber-500',
      text: 'text-slate-950 font-bold',
      border: 'border-amber-400',
      hex: '#f59e0b',
    };
  }
  if (score >= 4.0) {
    return {
      bg: 'bg-orange-500',
      text: 'text-white font-semibold',
      border: 'border-orange-400',
      hex: '#f97316',
    };
  }
  return {
    bg: 'bg-rose-500',
    text: 'text-white font-bold',
    border: 'border-rose-400',
    hex: '#f43f5e',
  };
}

