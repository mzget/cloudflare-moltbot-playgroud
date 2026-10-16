export const nvdaFundamentalMock = {
  symbol: "NVDA",
  business_model: "GPU accelerated computing platform and CUDA ecosystem for AI training and inference.",
  moat: "CUDA software ecosystem lock-in, networking stack (InfiniBand/NVLink), fast innovation cadence.",
  competitors: ["AMD (ROCm)", "Custom ASICs (TPU/Trainium)", "Intel"],
  guidance: {
    revenue_target: "35B+ quarterly revenue",
    margin_target: "Gross margin 75%",
    timeframe: "FY26 Q3",
    key_assumptions: "Blackwell architecture ramp and supply expansion"
  },
  key_risks: ["Supply chain bottlenecks at TSMC CoWoS", "China export control tightening", "Hyperscaler Capex digestion"],
  thesis_kpis: ["Datacenter segment revenue growth", "Gross margin stability >72%", "Networking revenue attach rate"],
  as_of_date: "2026-08-28",
  notebook_id: "notebook_nvda_q2fy26",
  source_count: 5
};

export const staleFundamentalMock = {
  symbol: "INTC",
  business_model: "Integrated Device Manufacturer (IDM) providing x86 CPUs and foundry services.",
  moat: "Legacy x86 software compatibility, high volume manufacturing capabilities.",
  competitors: ["AMD", "NVIDIA", "ARM licensees", "TSMC"],
  guidance: {
    revenue_target: "Flat to slightly up YoY",
    margin_target: "Gross margins near 38%",
    timeframe: "FY25",
    key_assumptions: "18A process node customer commitments"
  },
  key_risks: ["Foundry segment cash burn", "Loss of datacenter CPU share to AMD and ARM", "Execution delays on advanced packaging"],
  thesis_kpis: ["Intel 18A node progress and tape-outs", "Datacenter revenue decline moderation"],
  as_of_date: "2025-11-15", // More than 90 days ago
  notebook_id: "notebook_intc_legacy",
  source_count: 2
};

export const sampleMarketStats = {
  symbol: "ARM",
  price: 142.50,
  market_cap: 148000000000,
  revenues: 3233000000,
  revenue_1y_growth: 0.28,
  revenue_3y_cagr: 0.22,
  revenue_5y_cagr: 0.18,
  gross_profit_margin: 0.96,
  operating_margin: 0.44,
  ev_ebit: 65.4,
  ev_sales: 42.1,
  p_ocf: 58.2,
  p_fcf: 62.0,
  capex_to_ocf: 0.05,
  rd_to_revenue: 0.38,
  debt_equity: 0.12,
  p_e: 78.5,
  fcf_margin: 0.41,
  total_cash: 2100000000,
  net_debt: -1800000000,
  total_debt: 300000000,
  dividend_yield: 0.0,
  updated_at: "2026-10-15T10:00:00Z"
};
