import { IngestService } from "../services/ingest.service";

async function runIngest() {
  console.log("=".repeat(50));
  console.log("🧙 ORÁCULO D&D - SISTEMA DE INGESTÃO");
  console.log("=".repeat(50));

  const ingestService = new IngestService();

  console.log("\n📂 Procurando PDFs na pasta data...");

  try {
    await ingestService.processAllPDFs();

    console.log("\n" + "=".repeat(50));
    console.log("✅ INGESTÃO CONCLUÍDA COM SUCESSO!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("\n❌ Erro durante a ingestão:", error);
  }
}

runIngest().catch(console.error);
