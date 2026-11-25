import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

function posAgentDevPlugin(): Plugin {
  return {
    name: 'pos-agent-dev-middleware',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const key of ['AI_GATEWAY_API_KEY', 'POS_API_URL', 'VITE_API_URL', 'AI_MODEL']) {
        if (env[key] && !process.env[key]) {
          process.env[key] = env[key];
        }
      }

      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const body = Buffer.concat(chunks);

          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers.set(k, v);
            else if (Array.isArray(v)) headers.set(k, v.join(', '));
          }

          const webRequest = new Request('http://localhost/api/chat', {
            method: 'POST',
            headers,
            body,
          });

          const mod = await server.ssrLoadModule('/api/chat.ts');
          const webResponse: Response = await mod.POST(webRequest);

          res.statusCode = webResponse.status;
          webResponse.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });

          if (!webResponse.body) {
            res.end();
            return;
          }

          const reader = webResponse.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Internal AI agent error',
            })
          );
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), posAgentDevPlugin()],
});
