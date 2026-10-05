import { describe, it, expect } from 'vitest';
import { calculateWeightedRating } from './calculator';

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
