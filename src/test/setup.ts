import { vi } from 'vitest';

vi.mock('../util/logger', () => ({
  initLogger: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  show: vi.fn(),
  dispose: vi.fn(),
}));
