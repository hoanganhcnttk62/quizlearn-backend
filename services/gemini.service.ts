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
 */
export const proofreadCardsWithAI = async (
  cards: ProofreadCardItem[]
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
Dưới đây là danh sách các thẻ trong một học phần:
${JSON.stringify(cards, null, 2)}

Hãy rà soát từng thẻ:
1. Phát hiện lỗi chính tả (spelling typo) ở "term" hoặc "definition".
2. Phát hiện lỗi ngữ pháp thô hoặc câu tối nghĩa ở "definition".
3. Kiểm tra xem "term" và "definition" có khớp nhau về ý nghĩa không (mismatch), hay bị dán nhầm nội dung.

Trả về mảng JSON với cấu trúc:
[
  {
    "cardId": string,
    "hasIssue": boolean,
    "issueType": "typo" | "grammar" | "mismatch" | "none",
    "suggestedTerm": string, // Thuật ngữ đã được sửa lỗi chính tả nếu có
    "suggestedDefinition": string, // Định nghĩa đã được hoàn thiện nếu có
    "feedback": string // Lời giải thích ngắn gọn bằng tiếng Việt (ví dụ: "Sửa 'accomodate' thành 'accommodate'")
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

export interface CheckTermResult {
  hasError: boolean;
  issueType?: "typo" | "grammar" | "mismatch" | "none";
  suggestedTerm?: string;
  suggestedDefinition?: string;
  message?: string;
}

/**
 * Ultra-fast card checker for real-time / on-blur auto-check (validates Term, Definition & their match)
 */
export const checkSingleTermWithAI = async (
  term: string,
  definition?: string
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

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
Bạn là trợ lý kiểm tra nội dung thẻ học tập flashcard.
Người dùng vừa nhập:
- Thuật ngữ (Term): "${cleanTerm}"
- Định nghĩa (Definition): "${cleanDef}"

Nhiệm vụ kiểm tra toàn diện:
1. "Term": Có bị viết sai chính tả (typo, lỗi gõ phím, thiếu/thừa ký tự) không? (Ví dụ: "Inteligenc" -> "Intelligence", "accomodate" -> "accommodate").
2. "Definition": Có bị lỗi chính tả hoặc ngữ pháp thô không?
3. Tính tương thích: Nếu cả Term và Definition đều đã có nội dung, định nghĩa có thực sự diễn giải cho thuật ngữ không hay bị gõ nhầm nội dung khác (mismatch)?

Quy tắc phản hồi:
- Nếu nội dung chuẩn, không có lỗi gì: trả về hasError = false.
- Nếu có lỗi chính tả, ngữ pháp hoặc lệch nghĩa:
  - hasError = true
  - issueType = "typo" | "grammar" | "mismatch"
  - suggestedTerm: Thuật ngữ chuẩn xác đã sửa lỗi chính tả (nếu Term đúng thì giữ nguyên)
  - suggestedDefinition: Định nghĩa chuẩn xác đã sửa lỗi nếu có (nếu Definition đúng thì giữ nguyên)
  - message: Lời giải thích ngắn gọn bằng tiếng Việt (Ví dụ: "Sửa 'Inteligenc' thành 'Intelligence'" hoặc "Định nghĩa chưa khớp với thuật ngữ").

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

