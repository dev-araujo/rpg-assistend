import { Router } from "express";
import { QueryController } from "../controllers/query.controller";

const router = Router();
const queryController = new QueryController();

router.post("/ask", (req, res) => queryController.askQuestion(req, res));
router.get("/search", (req, res) => queryController.search(req, res));
router.get("/stats", (req, res) => queryController.getStats(req, res));

export default router;
