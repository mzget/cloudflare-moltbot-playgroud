const SYSTEM_PROMPT_BASE =
  "คุณคือ Oaktree AI ผู้ช่วยวิเคราะห์ข้อมูลการลงทุนแบบเน้นคุณค่า (Value Investing) ตามหลักการลงทุนของ Warren Buffett, Charlie Munger, Howard Marks, Benjamin Graham, Peter Lynch และ Seth Klarman\n" +
  "หน้าที่ของคุณคือให้คำแนะนำ วิเคราะห์หุ้น พอร์ตการลงทุน และตอบคำถามด้านการลงทุนอย่างกระชับ ชัดเจน มีเหตุผลทางธุรกิจและหลักการลงทุนรองรับ\n" +
  "กฎข้อสำคัญอย่างยิ่ง:\n" +
  "1. ตอบคำถามเป็นภาษาไทยให้จบครบถ้วนในข้อความเดียวอย่างเป็นธรรมชาติ\n" +
  "2. ห้ามสร้างแท็กคำสั่งฟังก์ชัน เช่น <|tool_call|> หรือ SQL โค้ดหลอก ให้ตอบข้อมูลจากบริบทที่มีให้หรือความรู้ที่มีทันที\n" +
  "3. ใช้ markdown จัดหัวข้อ ตาราง หรือ bullet points ให้อ่านง่าย สวยงาม และน่าติดตาม\n";

const isNonEmptyArray = (v: unknown): v is any[] => Array.isArray(v) && v.length > 0;

/** Pure: build the dynamic portfolio/watchlist context appended to the system prompt. */
export function buildDataContext(holdings: unknown, watchlist: unknown): string {
  const portfolioPart = isNonEmptyArray(holdings)
    ? "\n\n[ข้อมูลพอร์ตการลงทุนปัจจุบันของผู้ใช้ (User's Current Portfolio)]:\n" +
      JSON.stringify(holdings.map((h: any) => ({
        symbol: h.symbol,
        shares: h.shares,
        avg_cost: h.avg_cost,
        current_price: h.current_price,
        current_value: h.current_value,
        unrealized_gain_loss_pct: h.unrealized_gain_loss_pct,
        target_weight: h.target_weight,
        thesis: h.thesis,
        category: h.category
      })), null, 2)
    : "";

  const watchlistPart = isNonEmptyArray(watchlist)
    ? "\n\n[ข้อมูลหุ้นใน Watchlist ของผู้ใช้ (User's Watchlist)]:\n" +
      JSON.stringify(watchlist.map((w: any) => ({
        symbol: w.symbol,
        name: w.name,
        sector: w.sector,
        current_price: w.current_price,
        target_price: w.target_price,
        thesis: w.thesis
      })), null, 2)
    : "";

  return portfolioPart + watchlistPart;
}

export const buildSystemPrompt = (dataContext: string): string => SYSTEM_PROMPT_BASE + dataContext;

