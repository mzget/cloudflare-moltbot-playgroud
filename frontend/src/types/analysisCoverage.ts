export interface AnalysisCoverage {
  report: boolean;
  dcf: boolean;
  thesis: boolean;
  count: number;
}

export type AnalysisCoverageMap = Map<string, AnalysisCoverage>;
