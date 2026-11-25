import { ToolLoopAgent, tool, isStepCount, type InferAgentUIMessage } from 'ai';
import { z } from 'zod';

export interface PosAgentContext {
  apiBaseUrl: string;
  authToken?: string;
  locationId?: string;
  modelId?: string;
}

async function fetchPosApi(
  path: string,
  ctx: PosAgentContext
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (ctx.authToken) {
    headers['Authorization'] = `Bearer ${ctx.authToken}`;
  }
  if (ctx.locationId) {
    headers['X-Location-Id'] = ctx.locationId;
  }

  const url = `${ctx.apiBaseUrl.replace(/\/+$/, '')}${path}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      error: `POS API request failed with status ${response.status}`,
      details: text || response.statusText,
    };
  }

  return response.json();
}

export function createPosAgent(ctx: PosAgentContext) {
  const modelId = ctx.modelId || 'google/gemini-3.8-flash';

  return new ToolLoopAgent({
    model: modelId,
    stopWhen: isStepCount(6),
    instructions: [
      'You are the GroceryPro AI POS & Inventory Assistant.',
      'Help store cashiers, managers, and admins look up products, check stock balances, review low-stock alerts, and inspect sales/dashboard reports.',
      'Always use your tools to fetch live store data before answering questions about inventory, prices, stock levels, or sales.',
      'Present numbers, SKUs, and product names clearly. If the POS backend returns 401 Unauthorized, let the user know they need to be signed in to access live store data.',
    ].join(' '),
    tools: {
      searchProducts: tool({
        description:
          'Search products in the GroceryPro catalog by name (English or Sinhala), SKU, or barcode.',
        inputSchema: z.object({
          search: z.string().optional().describe('Product name, SKU, or barcode query'),
          pageSize: z.number().int().min(1).max(50).optional().describe('Max results to return (default 15)'),
        }),
        execute: async ({ search, pageSize = 15 }) => {
          const params = new URLSearchParams({ page: '1', pageSize: String(pageSize) });
          if (search) params.set('search', search);
          return fetchPosApi(`/products?${params.toString()}`, ctx);
        },
      }),

      getStockBalances: tool({
        description:
          'Get current stock balances for products at the active store location.',
        inputSchema: z.object({
          search: z.string().optional().describe('Filter by product name or SKU'),
          lowStockOnly: z.boolean().optional().describe('Set true to return only low-stock items'),
        }),
        execute: async ({ search, lowStockOnly = false }) => {
          const params = new URLSearchParams({ lowStockOnly: String(lowStockOnly) });
          if (search) params.set('search', search);
          return fetchPosApi(`/inventory/balances?${params.toString()}`, ctx);
        },
      }),

      getLowStockAlerts: tool({
        description:
          'Get all products currently at or below their reorder level that need restocking.',
        inputSchema: z.object({}),
        execute: async () => fetchPosApi('/inventory/low-stock', ctx),
      }),

      getDashboardStats: tool({
        description:
          'Get today and overall store KPIs (sales, orders, revenue, low-stock counts). Requires Manager or Admin role.',
        inputSchema: z.object({}),
        execute: async () => fetchPosApi('/reports/dashboard', ctx),
      }),

      getProductSalesReport: tool({
        description:
          'Get product-wise sales performance for a date range (ISO date strings YYYY-MM-DD). Requires Manager or Admin role.',
        inputSchema: z.object({
          from: z.string().optional().describe('Start date (YYYY-MM-DD), defaults to 30 days ago'),
          to: z.string().optional().describe('End date (YYYY-MM-DD), defaults to today'),
        }),
        execute: async ({ from, to }) => {
          const params = new URLSearchParams();
          if (from) params.set('from', from);
          if (to) params.set('to', to);
          const qs = params.toString();
          return fetchPosApi(`/reports/product-sales${qs ? `?${qs}` : ''}`, ctx);
        },
      }),
    },
  });
}

export type PosAgentUIMessage = InferAgentUIMessage<ReturnType<typeof createPosAgent>>;
