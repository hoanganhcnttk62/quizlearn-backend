import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Helper Levenshtein distance for quick typo heuristic and fallback
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export interface CheckAnswerResult {
  isCorrect: boolean;
  status: "exact" | "typo" | "synonym" | "incorrect";
  score: number; // 0 - 100
  correctTerm: string;
  userAnswer: string;
  suggestedCorrection?: string;
  feedback: string;
}

export interface ProofreadCardItem {
  id: string;
  term: string;
  definition: string;
  termLang?: SupportedLanguage;
  defLang?: SupportedLanguage;
}

export interface ProofreadCardResult {
  cardId: string;
  hasIssue: boolean;
  issueType?: "typo" | "grammar" | "mismatch" | "none";
  suggestedTerm?: string;
  suggestedDefinition?: string;
  feedback?: string;
}

/**
 * Intelligent answer checker with Gemini AI + fallback
 */
export const checkAnswerWithAI = async (
  term: string,
  definition: string,
  userAnswer: string
): Promise<CheckAnswerResult> => {
  const cleanTerm = (term || "").trim();
  const cleanAnswer = (userAnswer || "").trim();
  const cleanDef = (definition || "").trim();

  // Tier 1: Exact match (case-insensitive) - Instant, free!
  if (cleanTerm.toLowerCase() === cleanAnswer.toLowerCase()) {
    return {
      isCorrect: true,
      status: "exact",
      score: 100,
      correctTerm: cleanTerm,
      userAnswer: cleanAnswer,
      feedback: "Chính xác tuyệt đối!",
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback if no API key configured
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    const dist = levenshteinDistance(cleanTerm, cleanAnswer);
    const maxLen = Math.max(cleanTerm.length, cleanAnswer.length);
    if (dist <= 2 && maxLen >= 4) {
      return {
        isCorrect: true,
        status: "typo",
        score: 85,
        correctTerm: cleanTerm,
        userAnswer: cleanAnswer,
        suggestedCorrection: cleanTerm,
        feedback: `Gần đúng! Bạn có thể đã gõ nhầm 1 vài ký tự. Từ đúng là: "${cleanTerm}".`,
      };
    }
    return {
      isCorrect: false,
      status: "incorrect",
      score: 0,
      correctTerm: cleanTerm,
      userAnswer: cleanAnswer,
      suggestedCorrection: cleanTerm,
      feedback: `Chưa chính xác. Đáp án đúng là: "${cleanTerm}".`,
    };
  }

  // Tier 2: Google Gemini verification
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
Bạn là một trợ lý giáo dục chấm điểm từ vựng / thuật ngữ flashcard.
Hãy so sánh câu trả lời của người học với thuật ngữ chuẩn và định nghĩa.

- Thuật ngữ chuẩn: "${cleanTerm}"
- Định nghĩa chuẩn: "${cleanDef}"
- Câu trả lời của người học: "${cleanAnswer}"

Quy tắc đánh giá:
1. "exact": Trùng khớp hoàn toàn (không tính hoa thường, khoảng trắng).
2. "typo": Người học nhớ đúng từ nhưng viết sai 1-2 ký tự (chính tả, lỗi gõ phím, thiếu/thừa ký tự nhỏ). Vẫn tính là isCorrect = true (hoặc chấp nhận được).
3. "synonym": Người học dùng từ đồng nghĩa, hoặc diễn đạt tương đương mang lại đúng nghĩa của thuật ngữ trong ngữ cảnh định nghĩa đã cho. isCorrect = true.
4. "incorrect": Trả lời sai hẳn, lạc đề hoặc không đúng nghĩa. isCorrect = false.

Hãy trả về JSON theo định dạng sau (chú ý: feedback viết bằng tiếng Việt ngắn gọn, khích lệ):
{
  "isCorrect": boolean,
  "status": "exact" | "typo" | "synonym" | "incorrect",
  "score": number, // Thang điểm 0 - 100
  "suggestedCorrection": string, // Từ đúng nếu có lỗi chính tả hoặc từ chuẩn
  "feedback": string // Giải thích ngắn gọn bằng tiếng Việt
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return {
      isCorrect: Boolean(parsed.isCorrect),
      status: parsed.status || (parsed.isCorrect ? "exact" : "incorrect"),
      score: typeof parsed.score === "number" ? parsed.score : parsed.isCorrect ? 100 : 0,
      correctTerm: cleanTerm,
      userAnswer: cleanAnswer,
      suggestedCorrection: parsed.suggestedCorrection || cleanTerm,
      feedback: parsed.feedback || (parsed.isCorrect ? "Đúng rồi!" : `Đáp án đúng là: ${cleanTerm}`),
    };
  } catch (error) {
    console.error("Gemini AI check error:", error);
    // Graceful fallback to Levenshtein distance if API call fails
    const dist = levenshteinDistance(cleanTerm, cleanAnswer);
    const maxLen = Math.max(cleanTerm.length, cleanAnswer.length);
    const isTypo = dist <= 2 && maxLen >= 4;

    return {
      isCorrect: isTypo,
      status: isTypo ? "typo" : "incorrect",
      score: isTypo ? 85 : 0,
      correctTerm: cleanTerm,
      userAnswer: cleanAnswer,
      suggestedCorrection: cleanTerm,
      feedback: isTypo
        ? `Gần đúng! Chú ý chính tả: "${cleanTerm}".`
        : `Chưa chính xác. Đáp án đúng: "${cleanTerm}".`,
    };
  }
};

/**
 * Proofread a batch of cards in a set to find spelling/grammar/mismatch issues
 * @param cards       - Danh sách thẻ cần kiểm tra
 * @param termLang    - Ngôn ngữ chung của Term trong study set (mặc định: "auto")
 * @param defLang     - Ngôn ngữ chung của Definition trong study set (mặc định: "auto")
 */
export const proofreadCardsWithAI = async (
  cards: ProofreadCardItem[],
  termLang: SupportedLanguage = "auto",
  defLang: SupportedLanguage = "auto"
): Promise<ProofreadCardResult[]> => {
  if (!cards || cards.length === 0) {
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return cards.map((c) => ({
      cardId: c.id,
      hasIssue: false,
      feedback: "Chưa cấu hình GEMINI_API_KEY để kiểm tra lỗi thẻ.",
    }));
  }

  const termLangLabel = LANGUAGE_LABELS[termLang] ?? termLang;
  const defLangLabel = LANGUAGE_LABELS[defLang] ?? defLang;

  const isCrossLang = termLang !== "auto" && defLang !== "auto" && termLang !== defLang;

  const languageContext =
    termLang === "auto" && defLang === "auto"
      ? `Tự động nhận diện ngôn ngữ của từng thẻ và kiểm tra theo ngôn ngữ tương ứng.`
      : `Toàn bộ study set được cấu hình: Term bằng **${termLangLabel}**, Definition bằng **${defLangLabel}**.
${
  isCrossLang
    ? `Lưu ý quan trọng: Term (${termLangLabel}) và Definition (${defLangLabel}) cố ý khác ngôn ngữ nhau vì đây là thẻ học từ vựng/dịch nghĩa — ĐÂY LÀ HỢP LỆ, không được coi là mismatch. Chỉ báo mismatch khi hai bên hoàn toàn không liên quan về mặt ngữ nghĩa.`
    : `Term và Definition cùng ngôn ngữ. Kiểm tra chính tả và sự tương thích nghĩa theo ngôn ngữ ${termLangLabel}.`
}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
Bạn là chuyên gia thẩm định và biên tập nội dung flashcard học tập.

### CẤU HÌNH NGÔN NGỮ CỦA STUDY SET:
${languageContext}

### DANH SÁCH THẺ CẦN KIỂM TRA:
${JSON.stringify(cards, null, 2)}

### NHIỆM VỤ - Rà soát từng thẻ theo thứ tự:
1. **Chính tả Term:** Phát hiện typo, lỗi gõ phím, thiếu/thừa ký tự, sai dấu (đặc biệt tiếng Việt: thanh điệu, dấu phụ) theo ngôn ngữ **${termLangLabel !== "Tự động nhận diện" ? termLangLabel : "được nhận diện tự động"}**.
   - Chấp nhận: viết tắt chuyên ngành (HTML, CPU...), tên riêng, thuật ngữ kỹ thuật.
2. **Chính tả & Ngữ pháp Definition:** Kiểm tra theo ngôn ngữ **${defLangLabel !== "Tự động nhận diện" ? defLangLabel : "được nhận diện tự động"}**.
   - Chấp nhận: định nghĩa ngắn gọn, cụm từ, câu rút gọn (đặc thù flashcard).
3. **Tính tương thích (Mismatch):** Chỉ báo lỗi khi nội dung Term và Definition hoàn toàn không liên quan về ngữ nghĩa (ví dụ: Term là "Photosynthesis" nhưng Definition lại là "Thủ đô nước Pháp").

### ĐỊNH DẠNG KẾT QUẢ:
Trả về mảng JSON với đúng số phần tử tương ứng danh sách thẻ:
[
  {
    "cardId": string,
    "hasIssue": boolean,
    "issueType": "typo" | "grammar" | "mismatch" | "none",
    "suggestedTerm": string,
    "suggestedDefinition": string,
    "feedback": string
  }
]
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.error("Gemini proofreadCards error:", error);
    return [];
  }
};

// Supported languages for explicit language-aware checking
export type SupportedLanguage =
  | "vi"   // Tiếng Việt
  | "en"   // English
  | "ja"   // 日本語
  | "ko"   // 한국어
  | "zh"   // 中文
  | "fr"   // Français
  | "de"   // Deutsch
  | "es"   // Español
  | "auto"; // Auto-detect (fallback)

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  vi: "Tiếng Việt",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  auto: "Tự động nhận diện",
};

export interface CheckTermResult {
  hasError: boolean;
  issueType?: "typo" | "grammar" | "mismatch" | "none";
  suggestedTerm?: string;
  suggestedDefinition?: string;
  message?: string;
}

/**
 * Ultra-fast card checker for real-time / on-blur auto-check (validates Term, Definition & their match)
 * @param term       - Nội dung thuật ngữ
 * @param definition - Nội dung định nghĩa
 * @param termLang   - Ngôn ngữ của Term (mặc định: "auto")
 * @param defLang    - Ngôn ngữ của Definition (mặc định: "auto")
 */
export const checkSingleTermWithAI = async (
  term: string,
  definition?: string,
  termLang: SupportedLanguage = "auto",
  defLang: SupportedLanguage = "auto"
): Promise<CheckTermResult> => {
  const cleanTerm = (term || "").trim();
  const cleanDef = (definition || "").trim();

  // Need at least one field with some content
  if ((!cleanTerm || cleanTerm.length < 2) && (!cleanDef || cleanDef.length < 2)) {
    return { hasError: false };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return { hasError: false };
  }

  // Build language hint block
  const termLangLabel = LANGUAGE_LABELS[termLang] ?? termLang;
  const defLangLabel = LANGUAGE_LABELS[defLang] ?? defLang;

  const termLangInstruction =
    termLang === "auto"
      ? `Tự động nhận diện ngôn ngữ của Term và kiểm tra chính tả theo ngôn ngữ đó.`
      : `Term được viết bằng **${termLangLabel}**. Kiểm tra chính tả và cú pháp CHÍNH XÁC theo chuẩn của ngôn ngữ **${termLangLabel}**.`;

  const defLangInstruction =
    defLang === "auto"
      ? `Tự động nhận diện ngôn ngữ của Definition và kiểm tra theo ngôn ngữ đó.`
      : `Definition được viết bằng **${defLangLabel}**. Kiểm tra chính tả và ngữ pháp theo chuẩn của ngôn ngữ **${defLangLabel}**.`;

  // Build cross-language mismatch instruction
  const isCrossLang =
    termLang !== "auto" && defLang !== "auto" && termLang !== defLang;
  const mismatchInstruction = isCrossLang
    ? `Term (${termLangLabel}) và Definition (${defLangLabel}) cố ý khác ngôn ngữ nhau vì đây là thẻ học từ vựng/dịch nghĩa — ĐÂY LÀ HỢP LỆ, không được coi là mismatch. Chỉ báo mismatch nếu nội dung hai bên hoàn toàn không liên quan về mặt ngữ nghĩa (ví dụ: Term là "Photosynthesis" nhưng Definition lại là "Thủ đô của nước Pháp").`
    : `Nếu cả Term và Definition đều có nội dung, kiểm tra xem Definition có thực sự giải thích/dịch nghĩa đúng cho Term không. Chỉ báo mismatch khi hai bên hoàn toàn không liên quan.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
Bạn là trợ lý kiểm tra chất lượng nội dung thẻ học tập flashcard.

Dữ liệu đầu vào:
- Thuật ngữ (Term): """${cleanTerm}"""
- Định nghĩa (Definition): """${cleanDef || "(chưa nhập)"}"""

---
### NGÔN NGỮ ĐÃ CHỈ ĐỊNH:
- ${termLangInstruction}
- ${defLangInstruction}

---
### QUY TẮC KIỂM TRA:

**1. Chính tả Term (Spelling):**
- Phát hiện typo, lỗi gõ phím, thiếu/thừa ký tự, sai dấu (đặc biệt với tiếng Việt: sai thanh điệu / dấu phụ) theo đúng ngôn ngữ đã chỉ định.
- Chấp nhận viết tắt chuyên ngành phổ biến (HTML, CPU, DNA, GDP, v.v.).
- Chấp nhận tên riêng, thuật ngữ kỹ thuật, danh từ riêng đặc thù.

**2. Chính tả & Ngữ pháp Definition:**
- Kiểm tra chính tả theo ngôn ngữ đã chỉ định.
- CHỈ bắt lỗi ngữ pháp khi câu sai hoàn toàn gây hiểu sai nghĩa.
- CHẤP NHẬN định nghĩa ngắn gọn, cụm từ, câu rút gọn (đặc thù của flashcard).

**3. Tính tương thích (Mismatch):**
- ${mismatchInstruction}

---
### QUY TẮC PHẢN HỒI:
- Nếu nội dung chuẩn (hoặc Definition chưa nhập): hasError = false, issueType = "none", message = "".
- Nếu phát hiện lỗi:
  - hasError = true
  - issueType = "typo" (sai chính tả) | "grammar" (sai ngữ pháp thô) | "mismatch" (nội dung không khớp nhau)
  - suggestedTerm: Term đã sửa đúng (nếu không có lỗi thì giữ nguyên)
  - suggestedDefinition: Definition đã sửa đúng (nếu không có lỗi hoặc chưa nhập thì giữ nguyên)
  - message: Giải thích ngắn gọn bằng tiếng Việt (ví dụ: "Sửa 'accomodate' thành 'accommodate'")

Trả về đúng định dạng JSON:
{
  "hasError": boolean,
  "issueType": "typo" | "grammar" | "mismatch" | "none",
  "suggestedTerm": string,
  "suggestedDefinition": string,
  "message": string
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    const termHasDiff = parsed.suggestedTerm && parsed.suggestedTerm.trim().toLowerCase() !== cleanTerm.toLowerCase();
    const defHasDiff = parsed.suggestedDefinition && cleanDef.length > 0 && parsed.suggestedDefinition.trim().toLowerCase() !== cleanDef.toLowerCase();
    const hasError = Boolean(parsed.hasError) || Boolean(termHasDiff) || Boolean(defHasDiff);

    return {
      hasError,
      issueType: parsed.issueType || (hasError ? "typo" : "none"),
      suggestedTerm: parsed.suggestedTerm || cleanTerm,
      suggestedDefinition: parsed.suggestedDefinition || cleanDef,
      message: parsed.message || (hasError ? "Phát hiện vấn đề cần chỉnh sửa" : ""),
    };
  } catch (error) {
    console.error("Gemini checkSingleTerm error:", error);
    return { hasError: false };
  }
};


