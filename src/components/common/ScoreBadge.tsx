import React from 'react';
import { getScoreColor } from '../../utils/calculator';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, size = 'md', showLabel = false }) => {
  const colors = getScoreColor(score);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-sm px-2.5 py-1 font-semibold',
    lg: 'text-lg px-3.5 py-1.5 font-bold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses[size]}`}
    >
      <span className="tabular-nums">{score.toFixed(2)}</span>
      {showLabel && <span className="text-[10px] uppercase tracking-wider opacity-75">/ 10</span>}
    </span>
  );
};
