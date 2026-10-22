import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Custo do scrypt reduzido só nos testes: verificação continua exercitada,
    // sem pagar ~100ms por login em testes de limite de tentativas.
    env: { EP_SCRYPT_N: '4096' },
  },
});
