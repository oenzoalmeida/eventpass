import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sem globals do Vitest, a Testing Library não limpa o DOM sozinha entre testes.
afterEach(() => cleanup());
