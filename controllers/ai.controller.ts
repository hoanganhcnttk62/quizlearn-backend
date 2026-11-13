import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/CatchAsyncError";
import ErrorHandler from "../utils/errorHandler";
import {
  checkAnswerWithAI,
  proofreadCardsWithAI,
  checkSingleTermWithAI,
  ProofreadCardItem,
} from "../services/gemini.service";

// POST /api/v1/ai/check-term
export const checkTerm = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { term, definition } = req.body;

      if (!term || typeof term !== "string") {
        return res.status(200).json({
          success: true,
          data: { hasError: false },
        });
      }

      const result = await checkSingleTermWithAI(term, definition);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message || "AI check term error", 500));
    }
  }
);

// POST /api/v1/ai/check-answer
export const checkAnswer = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { term, definition, userAnswer } = req.body;

      if (!term || userAnswer === undefined) {
        return next(
          new ErrorHandler("Term and userAnswer are required for validation", 400)
        );
      }

      const result = await checkAnswerWithAI(
        term,
        definition || "",
        userAnswer
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message || "AI check error", 500));
    }
  }
);

// POST /api/v1/ai/proofread-cards
export const proofreadCards = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cards } = req.body as { cards: ProofreadCardItem[] };

      if (!cards || !Array.isArray(cards) || cards.length === 0) {
        return next(new ErrorHandler("A non-empty cards array is required", 400));
      }

      const results = await proofreadCardsWithAI(cards);

      res.status(200).json({
        success: true,
        issues: results.filter((item) => item.hasIssue),
        allReviews: results,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message || "AI proofread error", 500));
    }
  }
);
