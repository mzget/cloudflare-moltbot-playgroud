import { z } from 'zod';

export const analysisSearchSchema = z.object({
  symbol: z.string().optional(),
  tab: z.enum(['dossier', 'overview', 'report', 'dcf-model', 'stock-thesis']).default('dossier').catch('dossier'),
});

export const financeSearchSchema = z.object({
  tab: z.enum(['dashboard', 'transactions', 'budgets', 'wallets']).default('dashboard').catch('dashboard'),
  wallet: z.string().transform((v) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : 'all')).default('all').catch('all'),
});

export type FinanceSearch = z.infer<typeof financeSearchSchema>;
export type FinanceTab = FinanceSearch['tab'];

export const generalSearchSchema = z.object({
  symbol: z.string().optional(),
  tab: z.string().optional(),
});

