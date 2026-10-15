import { describe, it, expect } from 'vitest';
import { parseQuickMoodCommand } from './commandParser';

describe('parseQuickMoodCommand', () => {
  it('detects simple "hoy me siento un 8"', () => {
    const result = parseQuickMoodCommand('hoy me siento un 8');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(8);
    expect(result.notes).toBeUndefined();
  });

  it('detects "me siento 7.5" with decimal', () => {
    const result = parseQuickMoodCommand('me siento 7.5');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(7.5);
    expect(result.notes).toBeUndefined();
  });

  it('detects "hoy me siento un 8.5: excelente reunión con el equipo"', () => {
    const result = parseQuickMoodCommand('hoy me siento un 8.5: excelente reunión con el equipo');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(8.5);
    expect(result.notes).toBe('excelente reunión con el equipo');
  });

  it('detects "mi estado de ánimo hoy es 6"', () => {
    const result = parseQuickMoodCommand('mi estado de ánimo hoy es 6');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(6);
  });

  it('detects "estado de animo: 9 - muy productivo"', () => {
    const result = parseQuickMoodCommand('estado de animo: 9 - muy productivo');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(9);
    expect(result.notes).toBe('muy productivo');
  });

  it('detects "sensación del día 7.5"', () => {
    const result = parseQuickMoodCommand('sensación del día 7.5');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(7.5);
  });

  it('detects "sensacion de hoy 8 - cansado pero bien"', () => {
    const result = parseQuickMoodCommand('sensacion de hoy 8 - cansado pero bien');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(8);
    expect(result.notes).toBe('cansado pero bien');
  });

  it('detects "nota de hoy 9: muy productivo"', () => {
    const result = parseQuickMoodCommand('nota de hoy 9: muy productivo');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(9);
    expect(result.notes).toBe('muy productivo');
  });

  it('detects "nota 10"', () => {
    const result = parseQuickMoodCommand('nota 10');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(10);
  });

  it('detects "check-in 8: día regular"', () => {
    const result = parseQuickMoodCommand('check-in 8: día regular');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(8);
    expect(result.notes).toBe('día regular');
  });

  it('detects "hoy un 7"', () => {
    const result = parseQuickMoodCommand('hoy un 7');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(7);
  });

  it('rejects scores outside 1-10 range', () => {
    expect(parseQuickMoodCommand('hoy me siento un 0').isMatch).toBe(false);
    expect(parseQuickMoodCommand('hoy me siento un 11').isMatch).toBe(false);
    expect(parseQuickMoodCommand('nota 0').isMatch).toBe(false);
    expect(parseQuickMoodCommand('nota 12').isMatch).toBe(false);
  });

  it('rejects general sentences that are not quick commands', () => {
    expect(parseQuickMoodCommand('Hola, ¿cómo estás?').isMatch).toBe(false);
    expect(parseQuickMoodCommand('Quiero evaluar mi jornada laboral').isMatch).toBe(false);
    expect(parseQuickMoodCommand('').isMatch).toBe(false);
    expect(parseQuickMoodCommand('   ').isMatch).toBe(false);
  });
});

