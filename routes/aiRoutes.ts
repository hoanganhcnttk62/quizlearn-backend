import express from "express";
import { checkAnswer, proofreadCards, checkTerm } from "../controllers/ai.controller";

const router = express.Router();

// AI utility endpoints (stateless, fast response)
router.post("/check-term", checkTerm);
router.post("/check-answer", checkAnswer);
router.post("/proofread-cards", proofreadCards);

export default router;
