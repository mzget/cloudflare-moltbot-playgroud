export interface ArmFundamentalBrief {
  symbol: string;
  business_model: string;
  moat: string;
  competitors: string[];
  guidance: {
    revenue_target: string;
    margin_target: string;
    timeframe: string;
    key_assumptions: string;
  };
  key_risks: string[];
  thesis_kpis: string[];
  as_of_date: string;
  notebook_id: string;
  source_count: number;
}

export interface SemiAnalysisThemeContext {
  notebook_id: string;
  theme_name: string;
  industry_dynamics: string;
  supply_chain_bottlenecks: string;
  competitive_landscape: string;
  macro_trends: string;
  symbols: string[];
}

export const armFundamentalSeed: ArmFundamentalBrief = {
  symbol: "ARM",
  business_model:
    "Semiconductor intellectual property (IP) architecture licensing and royalty collection per chip shipped. Core compute IP for mobile, datacenter, and edge computing.",
  moat: "Pervasive instruction set architecture (ISA) software ecosystem, extensive developer mindshare, high switching costs for EDA tooling, compiler chains, and OS kernel optimizations.",
  competitors: [
    "RISC-V ecosystem",
    "x86 (Intel/AMD)",
    "Custom internal ASICs"
  ],
  guidance: {
    revenue_target: "Mid-20s % revenue CAGR through FY27",
    margin_target: "Operating margin expanding to >45%",
    timeframe: "FY25-FY27",
    key_assumptions:
      "v9 architecture transition, CSS (Compute Subsystem) adoption, datacenter penetration"
  },
  key_risks: [
    "SoftBank ownership concentration overhang",
    "RISC-V open architecture gaining traction in low-power and automotive IoT",
    "China joint-venture license fee collection risks and geopolitics"
  ],
  thesis_kpis: [
    "v9 architecture adoption rate (2x royalty rate vs v8)",
    "CSS (Compute Subsystem) revenue contribution share",
    "Datacenter and cloud market share gains"
  ],
  as_of_date: "2026-07-29",
  notebook_id: "notebook_arm_q1fy27",
  source_count: 3
};

export const semiAnalysisThemeSeed: SemiAnalysisThemeContext = {
  notebook_id: "theme_semianalysis_01",
  theme_name: "SemiAnalysis AI & Compute Dynamics",
  industry_dynamics:
    "Massive hyperscaler capital expenditure transitioning from general-purpose CPUs to specialized accelerated computing. Power and thermal constraints driving demand for energy-efficient architectures.",
  supply_chain_bottlenecks:
    "Advanced packaging (CoWoS), high-bandwidth memory (HBM3e/HBM4) allocations, leading-edge foundry EUV wafer capacity at TSMC.",
  competitive_landscape:
    "Custom silicon initiatives by CSPs (Google TPU, AWS Graviton/Trainium, Microsoft Maia) accelerating, alongside NVIDIA CUDA platform lock-in.",
  macro_trends:
    "Global data center power grid saturation, edge AI compute deployment, sovereign AI infrastructure investments.",
  symbols: ["ARM", "NVDA", "AVGO", "TSM"]
};
