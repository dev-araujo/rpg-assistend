import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api", routes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  console.log(`📚 API de consulta D&D 5e`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/ask - Fazer uma pergunta`);
  console.log(`  GET  /api/search - Buscar trechos`);
  console.log(`  GET  /api/stats - Estatísticas do conhecimento`);
});
