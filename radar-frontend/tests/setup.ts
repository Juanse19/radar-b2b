import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock 'server-only' — this guard is only meaningful in Next.js server context,
// not in a Node.js Vitest environment.
vi.mock('server-only', () => ({}));
