import { defineConfig } from 'vite';

export default defineConfig({
  base: '/cities_and_lights/',
    build: {
    outDir: 'docs', // <--- This is the magic change
  }
});
