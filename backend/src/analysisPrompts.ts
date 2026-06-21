import { Env } from './index';

export const DEFAULT_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';

export interface MarketStatsData {
  symbol: string;
  price: number | null;
  market_cap: number | null;
  revenues: number | null;
  revenue_1y_growth: number | null;
  revenue_3y_cagr: number | null;
  revenue_5y_cagr: number | null;
  gross_profit_margin: number | null;
  operating_margin: number | null;
  ev_ebit: number | null;
  ev_sales: number | null;
  p_ocf: number | null;
  p_fcf: number | null;
  capex_to_ocf: number | null;
  rd_to_revenue: number | null;
  debt_equity: number | null;
  p_e: number | null;
  fcf_margin: number | null;
  total_cash: number | null;
  net_debt: number | null;
  total_debt: number | null;
  dividend_yield: number | null;
  updated_at: string | null;
}

export function formatMetricsForPrompt(stats: MarketStatsData): string {
  return [
    'ราคาปัจจุบัน (Price): ' + (stats.price ?? 'N/A') + ' USD',
    'มูลค่าตลาด (Market Cap): ' + (stats.market_cap ? (stats.market_cap / 1e6).toFixed(2) + ' Million USD' : 'N/A'),
    'รายได้ (Revenues): ' + (stats.revenues ? (stats.revenues / 1e6).toFixed(2) + ' Million USD' : 'N/A'),
    'การเติบโตรายได้ 1 ปี (Revenue 1Y Growth): ' + (stats.revenue_1y_growth !== null ? (stats.revenue_1y_growth * 100).toFixed(2) + '%' : 'N/A'),
    'CAGR รายได้ 3 ปี (Revenue 3Y CAGR): ' + (stats.revenue_3y_cagr !== null ? (stats.revenue_3y_cagr * 100).toFixed(2) + '%' : 'N/A'),
    'CAGR รายได้ 5 ปี (Revenue 5Y CAGR): ' + (stats.revenue_5y_cagr !== null ? (stats.revenue_5y_cagr * 100).toFixed(2) + '%' : 'N/A'),
    'อัตรากำไรขั้นต้น (Gross Profit Margin): ' + (stats.gross_profit_margin !== null ? (stats.gross_profit_margin * 100).toFixed(2) + '%' : 'N/A'),
    'อัตรากำไรจากการดำเนินงาน (Operating Margin): ' + (stats.operating_margin !== null ? (stats.operating_margin * 100).toFixed(2) + '%' : 'N/A'),
    'FCF Margin: ' + (stats.fcf_margin !== null ? (stats.fcf_margin * 100).toFixed(2) + '%' : 'N/A'),
    'P/E Ratio: ' + (stats.p_e ?? 'N/A'),
    'P/OCF Ratio: ' + (stats.p_ocf ?? 'N/A'),
    'P/FCF Ratio: ' + (stats.p_fcf ?? 'N/A'),
    'EV/EBIT Ratio: ' + (stats.ev_ebit !== null ? stats.ev_ebit.toFixed(2) : 'N/A'),
    'EV/Sales Ratio: ' + (stats.ev_sales ?? 'N/A'),
    'Debt/Equity Ratio: ' + (stats.debt_equity ?? 'N/A'),
    'หนี้สินรวม (Total Debt): ' + (stats.total_debt ? (stats.total_debt / 1e6).toFixed(2) + ' Million USD' : 'N/A'),
    'เงินสดรวม (Total Cash): ' + (stats.total_cash ? (stats.total_cash / 1e6).toFixed(2) + ' Million USD' : 'N/A'),
    'หนี้สินสุทธิ (Net Debt): ' + (stats.net_debt ? (stats.net_debt / 1e6).toFixed(2) + ' Million USD' : 'N/A'),
    'CapEx to OCF Ratio: ' + (stats.capex_to_ocf !== null ? (stats.capex_to_ocf * 100).toFixed(2) + '%' : 'N/A'),
    'R&D to Revenue: ' + (stats.rd_to_revenue !== null ? (stats.rd_to_revenue * 100).toFixed(2) + '%' : 'N/A'),
    'อัตราเงินปันผลตอบแทน (Dividend Yield): ' + (stats.dividend_yield !== null ? (stats.dividend_yield * 100).toFixed(2) + '%' : 'N/A')
  ].join('\n');
}

export function getLynchPrompt(symbol: string, metricsStr: string, frameworkContent: string) {
  return {
    system: 'คุณคือผู้เชี่ยวชาญการวิเคราะห์หุ้นสไตล์ Peter Lynch โดยมีกรอบความคิดดังนี้:\n' + frameworkContent + '\n\nจงวิเคราะห์ข้อมูลทางการเงินของหุ้น ' + symbol + ' และจำแนกหุ้นออกเป็น 1 ใน 6 กลุ่ม (Slow Growers, Stalwarts, Fast Growers, Cyclicals, Turnarounds, Asset Plays) พร้อมระบุเหตุผลการวิเคราะห์ และระบุเรื่องราว (Story) ของหุ้นนี้ใน 2 ประโยค\n\nคำสั่ง: ตอบในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\n{\n  "category": "ระบุกลุ่มหุ้น",\n  "story": "เรื่องราวของหุ้นใน 2 ประโยคเป็นภาษาไทย",\n  "peg_pegy_analysis": "วิเคราะห์มูลค่าโดยคำนวณ PEG หรือ PEGY ประกอบตัวเลขทางการเงิน",\n  "reasoning": "อธิบายเหตุผลการวิเคราะห์กลุ่มหุ้นโดยอิงจากตัวเลขการเงินอย่างละเอียด"\n}',
    prompt: 'ข้อมูลทางการเงินของหุ้น ' + symbol + ':\n' + metricsStr
  };
}

export function getHelmerPrompt(symbol: string, metricsStr: string, frameworkContent: string, step1Output: string) {
  return {
    system: 'คุณคือผู้เชี่ยวชาญด้านกลยุทธ์ธุรกิจและวิเคราะห์ความได้เปรียบด้วยกรอบ Hamilton Helmer 7 Powers โดยมีกรอบความคิดดังนี้:\n' + frameworkContent + '\n\nผลวิเคราะห์ก่อนหน้า:\n' + step1Output + '\n\nจงประเมินความได้เปรียบในการแข่งขันของบริษัท ' + symbol + ' ว่ามี Power ในข้อใดบ้างใน 7 Powers (Scale Economies, Network Economics, Counter-Positioning, Switching Costs, Branding, Cornered Resource, Process Power)\n\nคำสั่ง: ตอบในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\n{\n  "powers_identified": [\n    {\n      "power_name": "ชื่อของ Power",\n      "benefit": "ผลประโยชน์เชิงตัวเลขหรือการเงินที่บริษัทได้รับ",\n      "barrier": "ปราการที่ป้องกันไม่ให้คู่แข่งเลียนแบบหรือแซงหน้าได้",\n      "evidence": "หลักฐานหรือข้อมูลของบริษัทที่สนับสนุนข้อนี้"\n    }\n  ],\n  "overall_power_strength": "ความแข็งแกร่งโดยรวมของบริษัท (แข็งแกร่งมาก/ปานกลาง/อ่อนแอ/ไม่มี)",\n  "synthesis": "วิเคราะห์ภาพรวมการแข่งขันของบริษัท"\n}',
    prompt: 'ข้อมูลทางการเงินของหุ้น ' + symbol + ':\n' + metricsStr
  };
}

export function getBuffettPrompt(symbol: string, metricsStr: string, frameworkContent: string, previousStepsOutput: string) {
  return {
    system: 'คุณคือผู้เชี่ยวชาญการลงทุนเน้นคุณค่าสไตล์ Warren Buffett โดยมีกรอบความคิดดังนี้:\n' + frameworkContent + '\n\nผลวิเคราะห์ก่อนหน้า:\n' + previousStepsOutput + '\n\nจงวิเคราะห์คูเมืองทางเศรษฐกิจ (Moat Type และ Moat Durability) และความคุ้มค่าทางการเงิน รวมถึงกำไรของผู้บริหาร (Owner\'s Earnings) ของบริษัท ' + symbol + ' และวิเคราะห์ความPredictableของกำไร\n\nคำสั่ง: ตอบในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\n{\n  "moat_type": "ประเภทคูเมือง (เช่น Brand, Network Effect, Switching Costs, Cost Advantage, Regulatory)",\n  "moat_durability": "ความทนทานของคูเมือง (ยั่งยืนสูง/ปานกลาง/สั้น)",\n  "financial_quality": "ประเมินความสามารถในการทำกำไรและคุณภาพของงบการเงิน (ROE, ROIC, หนี้สิน)",\n  "owners_earnings_analysis": "วิเคราะห์กระแสเงินสดและกำไรของเจ้าของ",\n  "predictability": "ความน่าเชื่อถือและความสม่ำเสมอของผลประกอบการ (1-5)"\n}',
    prompt: 'ข้อมูลทางการเงินของหุ้น ' + symbol + ':\n' + metricsStr
  };
}

export function getMungerPrompt(symbol: string, metricsStr: string, frameworkContent: string, previousStepsOutput: string) {
  return {
    system: 'คุณคือผู้เชี่ยวชาญการลงทุนสไตล์ Charlie Munger โดยมีกรอบความคิดดังนี้:\n' + frameworkContent + '\n\nผลวิเคราะห์ก่อนหน้า:\n' + previousStepsOutput + '\n\nจงประเมินการลงทุนของหุ้น ' + symbol + ' โดยใช้จิตวิทยาและการคิดย้อนกลับ (Inversion) เป็นหลัก เพื่อตอบว่า \'อะไรที่จะทำให้การลงทุนนี้ล้มเหลวหรือสูญเสียเงินต้นอย่างถาวร?\' และวิเคราะห์โครงสร้างจูงใจ (Incentives)\n\nคำสั่ง: ตอบในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\n{\n  "inversion_risks": ["ความเสี่ยงที่จะทำให้ล้มเหลวข้อ 1", "ความเสี่ยงข้อ 2"],\n  "incentives_analysis": "วิเคราะห์ความสอดคล้องของผลประโยชน์ระหว่างผู้บริหารและผู้ถือหุ้น",\n  "pre_mortem_scenario": "เหตุการณ์สมมติในอีก 2 ปีข้างหน้าถ้าบริษัทเจ๊งหรือราคาตก 50% จะมีสาเหตุหลักจากอะไร",\n  "simplicity_check": "ความเรียบง่ายของโมเดลธุรกิจ ผ่าน/ไม่ผ่าน เพราะอะไร"\n}',
    prompt: 'ข้อมูลทางการเงินของหุ้น ' + symbol + ':\n' + metricsStr
  };
}

export function getMarksPrompt(symbol: string, metricsStr: string, frameworkContent: string, previousStepsOutput: string) {
  return {
    system: 'คุณคือผู้เชี่ยวชาญการประเมินวัฏจักรตลาดและความเสี่ยงสไตล์ Howard Marks โดยมีกรอบความคิดดังนี้:\n' + frameworkContent + '\n\nผลวิเคราะห์ก่อนหน้า:\n' + previousStepsOutput + '\n\nจงประเมินความเสี่ยงและระดับวัฏจักรปัจจุบันของบริษัท ' + symbol + ' ความเสี่ยงของโอกาสเกิด Permanent Capital Loss และระดับ Margin of Safety\n\nคำสั่ง: ตอบในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\n{\n  "cycle_position": "ประเมินตำแหน่งของบริษัทและอุตสาหกรรมในวัฏจักร (ต้น/กลาง/ปลายวัฏจักร)",\n  "capital_loss_risk": "ความเสี่ยงในการสูญเสียเงินต้นถาวร (สูง/ปานกลาง/ต่ำ) พร้อมเหตุผล",\n  "margin_of_safety_evaluation": "ประเมินว่าราคาปัจจุบันมี Margin of Safety เพียงพอหรือไม่",\n  "market_complacency": "ระดับความคาดหวังในแง่ดีเกินไปของตลาดในหุ้นตัวนี้ (สูง/ปกติ/ต่ำ)"\n}',
    prompt: 'ข้อมูลทางการเงินของหุ้น ' + symbol + ':\n' + metricsStr
  };
}

export function getGreenblattPrompt(symbol: string, metricsStr: string, frameworkContent: string, previousStepsOutput: string) {
  return {
    system: 'คุณคือผู้เชี่ยวชาญสูตรมหัศจรรย์สไตล์ Joel Greenblatt โดยมีกรอบความคิดดังนี้:\n' + frameworkContent + '\n\nผลวิเคราะห์ก่อนหน้า:\n' + previousStepsOutput + '\n\nจงคำนวณและประเมิน Return on Capital (ROC) และ Earnings Yield (EY) ของบริษัท ' + symbol + ' รวมถึงวิเคราะห์ความเสี่ยงของการเป็นกับดักมูลค่า (Value Trap)\n\nคำสั่ง: ตอบในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\n{\n  "roc_evaluation": "ประเมินความสามารถในการทำกำไรเทียบกับทุน (Return on Capital)",\n  "earnings_yield_evaluation": "ประเมินความถูกเทียบกับมูลค่าของกิจการ (Earnings Yield)",\n  "value_trap_check": "วิเคราะห์ว่าราคาที่ถูกนั้นเป็นกับดักมูลค่าหรือไม่ (มีความเสี่ยงตกต่ำเชิงโครงสร้างหรือไม่)",\n  "magic_formula_verdict": "ผ่านเกณฑ์สูตรมหัศจรรย์ในมุมมองของคุณหรือไม่ (ผ่าน/ไม่ผ่าน) เพราะเหตุใด"\n}',
    prompt: 'ข้อมูลทางการเงินของหุ้น ' + symbol + ':\n' + metricsStr
  };
}

export function getSynthesisPrompt(symbol: string, metricsStr: string, allStepsOutput: string) {
  return {
    system: 'คุณคือหัวหน้านักวิเคราะห์การลงทุนสไตล์ Value Investing ที่มีความลึกซึ้งและรอบคอบ จงประมวลผลการวิเคราะห์ในขั้นตอน 1 ถึง 6 สำหรับบริษัท ' + symbol + ' แล้วสรุปผลลัพธ์และคะแนนความเชื่อมั่น\n\nคำสั่ง: ตอบในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\n{\n  "scores": {\n    "peter_lynch": 10,\n    "hamilton_helmer": 10,\n    "warren_buffett": 10,\n    "charlie_munger": 10,\n    "howard_marks": 10,\n    "joel_greenblatt": 10\n  },\n  "conviction_level": "High หรือ Medium หรือ Low",\n  "key_strengths": ["จุดเด่นข้อ 1", "จุดเด่นข้อ 2"],\n  "key_risks": ["ความเสี่ยงสำคัญข้อ 1", "ความเสี่ยงข้อ 2"],\n  "investment_thesis": "บทสรุปข้อเสนอแนะการลงทุนเชิงเปรียบเทียบในภาษาไทยยาว 3-4 ประโยค"\n}',
    prompt: 'ข้อมูลของ ' + symbol + ' และผลการวิเคราะห์ 6 ขั้นตอนก่อนหน้า:\n' + allStepsOutput
  };
}

export function getFinalReportPrompt(symbol: string, metricsStr: string, synthesisOutput: string, allStepsOutput: string) {
  return {
    system: 'คุณคือทีมวิเคราะห์การลงทุน Oaktree Agent จงเขียนรายงานการวิเคราะห์เชิงลึกแบบพรีเมียม (Premium Deep Analysis Report) เป็นภาษาไทยเพื่อส่งให้ผู้ถือหุ้นใหญ่ รายงานต้องอิงตามกรอบของปรมาจารย์เน้นคุณค่าทั้ง 6 คน\n\nหัวข้อรายงานที่ต้องครอบคลุมใน Markdown:\n# รายงานการวิเคราะห์การลงทุนเชิงลึก: ' + symbol + '\n\n## 1. บทสรุปการวิเคราะห์เชิงรับ (Executive Summary)\n(สรุปสั้นๆ Conviction Level, เรื่องราวของหุ้น และประเด็นสำคัญสูงสุด)\n\n## 2. การจำแนกประเภทและเรื่องราวของหุ้น (Peter Lynch Framework)\n(ประเภทหุ้น, เรื่องราว, PEG/PEGY)\n\n## 3. ปราการทางยุทธศาสตร์และการแข่งขัน (Hamilton Helmer 7 Powers)\n(ความได้เปรียบเชิงโครงสร้างของธุรกิจและพลังการต่อรอง)\n\n## 4. คูเมืองและคุณภาพทางการเงินของกิจการ (Warren Buffett Framework)\n(ประเภทคูเมือง, ความสม่ำเสมอของงบการเงิน, กระแสเงินสดกระทำการของเจ้าของ)\n\n## 5. การจำลองความคิดและการวิเคราะห์เชิงกลับ (Charlie Munger Framework)\n(การประเมินการคิดย้อนกลับ Inversion ปัจจัยที่จะทำให้การลงทุนนี้ล้มเหลวและจิตวิทยาแรงจูงใจ)\n\n## 6. วัฏจักรความกลัวและความโลภกับการประเมินความเสี่ยง (Howard Marks Framework)\n(ประเมินวัฏจักร, ความเสี่ยงในการสูญเสียเงินต้นถาวร และ Margin of Safety)\n\n## 7. คะแนนคุณภาพและความถูกของธุรกิจ (Joel Greenblatt Magic Formula)\n(ประเมิน ROC, Earnings Yield และความเสี่ยง Value Trap)\n\n## 8. ตารางคะแนนรวมและบทสรุปเพื่อการตัดสินใจ (Meta-Synthesis & Recommendation)\n(ตารางคะแนนประเมินแต่ละท่าน 1-10 คะแนน และคำแนะนำขั้นสุดท้ายสำหรับการลงทุน)\n\nจงเขียนรายงานนี้ให้ออกมามีความเป็นวิชาชีพสูง ละเอียด ลึกซึ้ง และประทับใจผู้อ่านตั้งแต่วินาทีแรก ใช้ภาษาไทยที่ถูกต้อง สวยงาม และกระชับ\n\nคำสั่ง: ผลลัพธ์ของคุณในขั้นตอนนี้ต้องเป็นเนื้อหา Markdown ของรายงานวิเคราะห์ภาษาไทยเท่านั้น ไม่ต้องเขียนข้อความหรืออธิบายอื่นใดเพิ่มเติม',
    prompt: 'ผลสรุปสังเคราะห์การวิเคราะห์:\n' + synthesisOutput + '\n\nผลวิเคราะห์รวมขั้นตอนก่อนหน้า:\n' + allStepsOutput
  };
}