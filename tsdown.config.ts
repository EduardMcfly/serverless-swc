import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/**/*.ts', '!src/**/*.spec.ts'],
    format: ['cjs'],
    outDir: 'dist/cjs',
    dts: true,
    clean: true,
    unbundle: true,
    sourcemap: true,
  },
  {
    entry: ['src/**/*.ts', '!src/**/*.spec.ts'],
    format: ['esm'],
    outDir: 'dist/esm',
    dts: true,
    clean: true,
    unbundle: true,
    sourcemap: true,
  },
]);
