import { Request, Response } from "express";
import { VectorStoreService } from "../services/vector.service";

const vectorStore = new VectorStoreService();

export class QueryController {
  async askQuestion(req: Request, res: Response) {
    try {
      const { question } = req.body;

      if (!question) {
        return res.status(400).json({
          error: "Pergunta é obrigatória",
          exemplo: {
            question: "Quais as magias possíveis para um druida nível 3?",
          },
        });
      }

      console.log(`\n❓ Pergunta recebida: ${question}`);
      const answer = await vectorStore.generateResponse(question);
      const stats = await vectorStore.getStats();

      res.json({
        success: true,
        question,
        answer,
        metadata: {
          timestamp: new Date().toISOString(),
          booksAvailable: stats.totalBooks,
          chunksConsulted: stats.totalChunks,
        },
      });
    } catch (error) {
      console.error("Erro no controller:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
      });
    }
  }

  async search(req: Request, res: Response) {
    try {
      const { query, category, limit = 5 } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query é obrigatória" });
      }

      const results = await vectorStore.searchSimilarDocuments(
        query,
        Number(limit),
        category as string | undefined,
      );

      res.json({
        success: true,
        query,
        category: category || "todas",
        total: results.length,
        results: results.map((doc) => ({
          content: doc.content.substring(0, 200) + "...",
          source: {
            book: doc.metadata.book,
            page: doc.metadata.page,
            chapter: doc.metadata.chapter,
            category: doc.metadata.category,
          },
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Erro no controller:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
      });
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const stats = await vectorStore.getStats();
      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao obter estatísticas" });
    }
  }
}
