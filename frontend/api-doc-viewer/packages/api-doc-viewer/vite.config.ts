/**
 * Copyright 2024-2025 NetCracker Technology Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import react from '@vitejs/plugin-react';
import path from "path";
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { esmExternalRequirePlugin } from 'rolldown/plugins';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    /* Vite 8 bundles with rolldown, which deliberately leaves an external dependency as a
       literal require() rather than converting it to an import - the two have different
       semantics, and require() is undefined in environments like Cloudflare Workers. It then
       injects a helper that THROWS when that require is reached in a browser:

         Uncaught Error: Calling `require` for "react" in an environment that
         doesn't expose the `require` function

       This library is consumed by ui, which bundles it, so the throw surfaces in ui's app
       bundle regardless of which vite ui itself uses - a vite 4 build of ui shows the same
       rolldown error. See rolldown-vite issues #223 and #596.

       react/react-dom MOVE here from build.rollupOptions.external rather than being listed
       in both: top-level external takes precedence, and a module named in both stays a raw
       require(). The rewrite only applies to ESM output, which is what lib.formats gives. */
    esmExternalRequirePlugin({
      external: ['react', 'react-dom'],
    }),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    sourcemap: true,
    outDir: './dist',
    minify: false,
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
      /* Vite 8 names library CSS after the entry, so this emitted index.css where every
         earlier version emitted style.css. That filename is part of the published
         contract - package.json exports "./dist/style.css", and ui imports it from
         GraphQlOperationViewer.tsx and JsonSchemaViewer.tsx - so it is pinned here
         rather than renamed downstream. */
      cssFileName: 'style',
    },
  },
  resolve: {
    alias: {
      // Cross-package aliases (external dependencies)
      '@netcracker/qubership-apihub-api-state-model': path.resolve(__dirname, '../api-state-model/src'),
      '@netcracker/qubership-apihub-api-data-model': path.resolve(__dirname, '../api-data-model/src'),
      '@netcracker/qubership-apihub-next-data-model': path.resolve(__dirname, '../next-data-model/src'),
      '@netcracker/qubership-apihub-samples': path.resolve(__dirname, '../samples/src'),
      '@apihub/api-data-model': path.resolve(__dirname, '../api-data-model/src'),
      '@apihub/next-data-model': path.resolve(__dirname, '../next-data-model/src'),
    }
  }
})
