import React from 'react';
import { getScoreColor } from '../../utils/calculator';

interface CircularGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showSubtext?: boolean;
  subtext?: string;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({
  score,
  size = 110,
  strokeWidth = 9,
  showSubtext = true,
  subtext = 'Nota Final',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(10, score));
  const strokeDashoffset = circumference - (clampedScore / 10) * circumference;
  const colors = getScoreColor(score);

  return (
    <div className="flex flex-col items-center justify-center relative">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800/80 fill-transparent"
        />
        {/* Active progress track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${colors.ring} fill-transparent transition-all duration-300 ease-out`}
          style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
        />
      </svg>
      {/* Centered content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
        <span className={`text-2xl font-black tracking-tight tabular-nums ${colors.text}`}>
          {score.toFixed(2)}
        </span>
        {showSubtext && (
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};
