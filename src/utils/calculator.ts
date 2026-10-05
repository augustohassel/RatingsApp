import { EvaluationItemValue } from '../types';

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
