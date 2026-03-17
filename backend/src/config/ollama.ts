import { Ollama } from "ollama";

const ollama = new Ollama({ host: "http://localhost:11434" });

export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

export async function generateText(prompt: string): Promise<string> {
  try {
    const response = await ollama.chat({
      model: OLLAMA_MODEL,
      messages: [{ role: "user", content: prompt }],
    });
    return response.message.content;
  } catch (error: any) {
    if (error?.cause?.code === "ECONNREFUSED") {
      throw new Error("Ollama não está rodando. Execute: ollama serve");
    }
    throw error;
  }
}
