import { pipeline, env } from "@xenova/transformers";
import path from "path";

env.cacheDir = path.join(__dirname, "../../.models");

let embeddingPipeline: any = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log("⏳ Carregando modelo de embedding local (primeira vez demora ~30s)...");
    embeddingPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("✅ Modelo de embedding carregado!");
  }
  return embeddingPipeline;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text.slice(0, 512), { pooling: "mean", normalize: true });
  return Array.from(output.data) as number[];
}

export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  const pipe = await getEmbeddingPipeline();
  const truncated = texts.map((t) => t.slice(0, 512));
  const output = await pipe(truncated, { pooling: "mean", normalize: true });
  const dims = output.dims; // [batchSize, 384]
  const data = Array.from(output.data) as number[];
  const embeddings: number[][] = [];
  for (let i = 0; i < dims[0]; i++) {
    embeddings.push(data.slice(i * dims[1], (i + 1) * dims[1]));
  }
  return embeddings;
}
