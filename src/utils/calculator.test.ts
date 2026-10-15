import { describe, it, expect } from 'vitest';
import {
  calculateWeightedRating,
  aggregateDailyScores,
  calculateMonthlyAverages,
  toLocalDateString,
  createIsoFromLocalDate,
  getScoreColor,
  getMoodHeatmapColor,
} from './calculator';




describe('calculateWeightedRating', () => {
  it('correctly calculates the exact 14 categories from the Google Sheet example', () => {
    // Values from the user's Google Sheet:
    // Weights sum to 95.
    // Scores: 8, 8, 4, 8, 6, 9, 9, 9, 8, 8, 10, 8, 8, 1
    // Sum(weight * score) = 8*8 + 8*8 + 2*4 + 4*8 + 6*6 + 8*9 + 9*9 + 9*9 + 8*8 + 5*8 + 10*10 + 8*8 + 9*8 + 1*1
    // = 64 + 64 + 8 + 32 + 36 + 72 + 81 + 81 + 64 + 40 + 100 + 64 + 72 + 1 = 779
    // Final score = 779 / 95 = 8.20
    const inputs = [
      { itemId: '1', name: 'Relación con mi superior', weight: 8, score: 8 },
      { itemId: '2', name: 'Tareas que realizo', weight: 8, score: 8 },
      { itemId: '3', name: 'Compromiso con la visión de la organización', weight: 2, score: 4 },
      { itemId: '4', name: 'Espacio físico de trabajo', weight: 4, score: 8 },
      { itemId: '5', name: 'Cultura de la organización', weight: 6, score: 6 },
      { itemId: '6', name: 'Relación con mis compañeros', weight: 8, score: 9 },
      { itemId: '7', name: 'Relación con mis pares', weight: 9, score: 9 },
      { itemId: '8', name: 'Equipo generado', weight: 9, score: 9 },
      { itemId: '9', name: 'Proyección dentro del puesto', weight: 8, score: 8 },
      { itemId: '10', name: 'Aprendizaje contínuo', weight: 5, score: 8 },
      { itemId: '11', name: 'Balance vida personal / laboral', weight: 10, score: 10 },
      { itemId: '12', name: 'Movilidad casa / oficina', weight: 8, score: 8 },
      { itemId: '13', name: 'Salario', weight: 9, score: 8 },
      { itemId: '14', name: 'Aprendizaje formal', weight: 1, score: 1 },
    ];

    const result = calculateWeightedRating(inputs);

    expect(result.totalWeight).toBe(95);
    expect(result.finalScore).toBe(8.20);
    // Row 10: Balance vida personal / laboral (weight 10, score 10) -> contribution = 100 / 95 = 1.05
    const balanceItem = result.items.find((i) => i.itemId === '11');
    expect(balanceItem?.contribution).toBe(1.05);
    // Row 1: Relación con mi superior (weight 8, score 8) -> contribution = 64 / 95 = 0.67
    const superiorItem = result.items.find((i) => i.itemId === '1');
    expect(superiorItem?.contribution).toBe(0.67);
  });

  it('handles edge case when all weights are 0', () => {
    const inputs = [
      { itemId: '1', name: 'Test 1', weight: 0, score: 5 },
      { itemId: '2', name: 'Test 2', weight: 0, score: 8 },
    ];

    const result = calculateWeightedRating(inputs);
    expect(result.totalWeight).toBe(0);
    expect(result.finalScore).toBe(0);
  });
});

describe('aggregateDailyScores', () => {
  it('correctly aggregates multiple evaluations on the same day into an arithmetic average', () => {
    const evals = [
      {
        id: 'eval-1',
        topicId: 'topic-daily-mood',
        date: '2026-10-12T09:00:00.000Z',
        items: [],
        totalWeight: 10,
        finalScore: 7,
        notes: 'Mañana tranquila',
        createdAt: 1000,
      },
      {
        id: 'eval-2',
        topicId: 'topic-daily-mood',
        date: '2026-10-12T20:30:00.000Z',
        items: [],
        totalWeight: 10,
        finalScore: 8,
        notes: 'Buena tarde de entrenamiento',
        createdAt: 2000,
      },
    ];

    const aggregated = aggregateDailyScores(evals);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].averageScore).toBe(7.5);
    expect(aggregated[0].count).toBe(2);
    expect(aggregated[0].entries).toHaveLength(2);
    expect(aggregated[0].notes).toEqual(['Mañana tranquila', 'Buena tarde de entrenamiento']);
  });

  it('handles multiple distinct dates and sorts them chronologically', () => {
    const evals = [
      {
        id: 'eval-2',
        topicId: 'topic-daily-mood',
        date: '2026-10-14T10:00:00.000Z',
        items: [],
        totalWeight: 10,
        finalScore: 9,
        createdAt: 2000,
      },
      {
        id: 'eval-1',
        topicId: 'topic-daily-mood',
        date: '2026-10-10T08:00:00.000Z',
        items: [],
        totalWeight: 10,
        finalScore: 6,
        createdAt: 1000,
      },
    ];

    const aggregated = aggregateDailyScores(evals);
    expect(aggregated).toHaveLength(2);
    expect(aggregated[0].dateStr).toBe('2026-10-10');
    expect(aggregated[0].averageScore).toBe(6);
    expect(aggregated[1].dateStr).toBe('2026-10-14');
    expect(aggregated[1].averageScore).toBe(9);
  });
});

describe('calculateMonthlyAverages', () => {
  it('computes 12 monthly averages and handles months with and without data', () => {
    const dailyScores = [
      {
        dateStr: '2026-01-05',
        date: new Date(2026, 0, 5),
        day: 5,
        month: 0, // Enero
        year: 2026,
        averageScore: 8,
        count: 1,
        entries: [],
        notes: [],
      },
      {
        dateStr: '2026-01-20',
        date: new Date(2026, 0, 20),
        day: 20,
        month: 0, // Enero
        year: 2026,
        averageScore: 6,
        count: 1,
        entries: [],
        notes: [],
      },
      {
        dateStr: '2026-02-14',
        date: new Date(2026, 1, 14),
        day: 14,
        month: 1, // Febrero
        year: 2026,
        averageScore: 9.5,
        count: 1,
        entries: [],
        notes: [],
      },
    ];

    const monthly = calculateMonthlyAverages(dailyScores, 2026);
    expect(monthly).toHaveLength(12);

    // Enero: (8 + 6) / 2 = 7.00
    expect(monthly[0].monthName).toBe('Ene');
    expect(monthly[0].averageScore).toBe(7.0);
    expect(monthly[0].count).toBe(2);

    // Febrero: 9.50
    expect(monthly[1].monthName).toBe('Feb');
    expect(monthly[1].averageScore).toBe(9.5);
    expect(monthly[1].count).toBe(1);

    // Marzo (sin datos): null
    expect(monthly[2].monthName).toBe('Mar');
    expect(monthly[2].averageScore).toBeNull();
    expect(monthly[2].count).toBe(0);
  });
});

describe('createIsoFromLocalDate & toLocalDateString', () => {
  it('preserves the exact local date without timezone backward shift', () => {
    const dateInput = '2026-05-18';
    const isoString = createIsoFromLocalDate(dateInput);

    // When converted back to local date string, it must match the original dateInput exactly
    expect(toLocalDateString(isoString)).toBe(dateInput);
  });

  it('preserves time when timeSource is provided', () => {
    const dateInput = '2026-07-22';
    const timeSource = new Date(2026, 6, 1, 15, 45, 30);
    const isoString = createIsoFromLocalDate(dateInput, timeSource);

    expect(toLocalDateString(isoString)).toBe(dateInput);
    const parsed = new Date(isoString);
    expect(parsed.getHours()).toBe(15);
    expect(parsed.getMinutes()).toBe(45);
    expect(parsed.getSeconds()).toBe(30);
  });

  it('handles non-hyphen dateStr format with fallback to Date.toISOString', () => {
    const fallbackInput = '2026/05/18';
    const iso = createIsoFromLocalDate(fallbackInput);
    expect(typeof iso).toBe('string');
    expect(iso).toContain('2026');
  });
});

describe('Color and Label helpers', () => {
  it('returns appropriate score colors across ranges', () => {
    // >= 8.0
    expect(getScoreColor(9).text).toContain('emerald');
    expect(getScoreColor(9).bg).toContain('emerald');
    expect(getScoreColor(9).border).toContain('emerald');
    expect(getScoreColor(9).ring).toContain('emerald');

    // 6.5 - 7.99
    expect(getScoreColor(7.0).text).toContain('indigo');
    expect(getScoreColor(7.0).bg).toContain('indigo');

    // 5.0 - 6.49
    expect(getScoreColor(5.5).text).toContain('amber');
    expect(getScoreColor(5.5).bg).toContain('amber');

    // < 5.0
    expect(getScoreColor(3.0).text).toContain('rose');
    expect(getScoreColor(3.0).bg).toContain('rose');
  });


  it('returns heatmap styling for Mood Wrapped', () => {
    // null / undefined
    const nullScore = getMoodHeatmapColor(null);
    expect(nullScore.hex).toBe('#0f172a');

    // >= 8.5
    const high = getMoodHeatmapColor(9);
    expect(high.hex).toBe('#10b981');

    // >= 7.0
    const good = getMoodHeatmapColor(7.5);
    expect(good.hex).toBe('#059669');

    // >= 5.5
    const mid = getMoodHeatmapColor(6);
    expect(mid.hex).toBe('#f59e0b');

    // >= 4.0
    const low = getMoodHeatmapColor(4.5);
    expect(low.hex).toBe('#f97316');

    // < 4.0
    const critical = getMoodHeatmapColor(2);
    expect(critical.hex).toBe('#f43f5e');
  });
});



