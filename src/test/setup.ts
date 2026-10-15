import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock global __APP_VERSION__
(globalThis as unknown as Record<string, unknown>).__APP_VERSION__ = '1.2.0';

