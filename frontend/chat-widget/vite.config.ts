import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'AICSAWidget',
      formats: ['umd'],
      fileName: (format) => `aicsa-widget.${format === 'umd' ? 'js' : 'mjs'}`,
    },
    rollupOptions: {
      output: {
        globals: {
          axios: 'axios',
        },
      },
    },
  },
});
