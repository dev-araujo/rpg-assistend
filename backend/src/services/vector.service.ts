import fs from "fs/promises";
import path from "path";
import { generateText } from "../config/ollama";
import { generateEmbedding } from "../config/embeddings";

interface Document {
  id: string;
  content: string;
  metadata: {
    source: string;
    book: string;
    page: number;
    chapter: string;
    category: string;
    timestamp: string;
  };
  embedding: number[];
}

export class VectorStoreService {
  private documents: Document[] = [];
  private readonly vectorPath = path.join(__dirname, "../../data/vectors");
  private readonly initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.loadDocuments();
  }

  private async loadDocuments() {
    try {
      const filePath = path.join(this.vectorPath, "documents.json");
      const data = await fs.readFile(filePath, "utf-8");
      this.documents = JSON.parse(data);
      console.log(
        `📚 ${this.documents.length} chunks de documentos carregados`,
      );
    } catch (error) {
      console.log(
        "⚠️ Nenhum documento encontrado. Execute npm run ingest primeiro.",
      );
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      return await generateEmbedding(query);
    } catch (error) {
      console.error("Erro ao gerar embedding da consulta:", error);
      return new Array(384).fill(0);
    }
  }

  async searchSimilarDocuments(
    query: string,
    topK: number = 5,
    category?: string,
  ): Promise<Document[]> {
    try {
      await this.initPromise;
      const queryEmbedding = await this.generateQueryEmbedding(query);

      let docsToSearch = this.documents;
      if (category) {
        docsToSearch = this.documents.filter(
          (doc) => doc.metadata.category === category,
        );
        console.log(
          `📑 Filtrando por categoria "${category}": ${docsToSearch.length} documentos`,
        );
      }

      if (docsToSearch.length === 0) {
        console.log("⚠️ Nenhum documento encontrado para a categoria");
        return [];
      }

      console.log("📊 Calculando similaridades...");
      const similarities = docsToSearch.map((doc) => {
        if (!doc.embedding || doc.embedding.length === 0) {
          return { doc, similarity: 0 };
        }
        return {
          doc,
          similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
        };
      });

      const topResults = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .filter((item) => item.similarity > 0.3)
        .map((item) => item.doc);

      console.log(`✅ Encontrados ${topResults.length} documentos relevantes`);

      topResults.forEach((doc, i) => {
        const similarity =
          similarities.find((s) => s.doc.id === doc.id)?.similarity || 0;
        console.log(
          `   ${i + 1}. Similaridade: ${similarity.toFixed(4)} - ${doc.metadata.book} p.${doc.metadata.page}`,
        );
      });

      return topResults;
    } catch (error) {
      console.error("Erro na busca:", error);
      return [];
    }
  }

  async generateResponse(query: string): Promise<string> {
    try {
      await this.initPromise;
      const category = this.detectCategory(query);
      console.log(`📌 Categoria detectada: ${category || "todas"}`);

      const relevantDocs = await this.searchSimilarDocuments(
        query,
        5,
        category,
      );

      if (relevantDocs.length === 0) {
        return "📖 Não encontrei informações específicas sobre isso nos livros de regras.";
      }

      const context = relevantDocs
        .map((doc) => {
          return `[Fonte: ${doc.metadata.book}, Página ${doc.metadata.page}, Capítulo: ${doc.metadata.chapter}]
${doc.content}`;
        })
        .join("\n\n---\n\n");

      const prompt = `
      Você é um especialista em D&D 5ª edição. Use APENAS o contexto abaixo para responder.
      
      CONTEXTO (dos livros de regras):
      ${context}
      
      PERGUNTA: ${query}
      
      INSTRUÇÕES:
      - Responda apenas com base no contexto fornecido
      - Cite a fonte (livro e página) quando possível
      - Se a informação não estiver no contexto, diga que não encontrou
      - Seja claro e preciso
      
      RESPOSTA:
      `;

      console.log("🤖 Gerando resposta...");
      const answer = await generateText(prompt);
      return answer;
    } catch (error) {
      console.error("Erro ao gerar resposta:", error);
      return "❌ Erro ao processar sua pergunta. Tente novamente.";
    }
  }

  private detectCategory(query: string): string | undefined {
    const lowerQuery = query.toLowerCase();

    const magiaTerms = [
      "magia", "mágico", "mágica", "feitiço", "feitiçaria", "conjuração",
      "ritual", "encantamento", "evocação", "ilusão", "necromancia",
      "transmutação", "adivinhação", "abjuração", "invocação", "cantrip",
      "spell", "spellcast", "magic", "magical", "enchantment", "illusion",
      "necromancy", "conjuration", "divination", "abjuration", "evocation",
      "concentration", "concentração", "scroll", "pergaminho",
    ];

    const combateTerms = [
      "combate", "batalha", "luta", "guerra", "atacar", "ataque", "attack",
      "combat", "dano", "damage", "hit", "acertar", "golpe", "ferimento",
      "iniciativa", "initiative", "turno", "round", "ação", "action",
      "reação", "reaction", "movimento", "movement", "resistência",
      "saving throw", "teste de resistência", "crítico", "critical",
    ];

    const personagemTerms = [
      "classe", "class", "raça", "race", "personagem", "character",
      "atributo", "attribute", "habilidade", "ability", "perícia", "skill",
      "talento", "feat", "nível", "level", "experiência", "experience",
      "antecedente", "background", "alinhamento", "alignment",
      "proficiência", "proficiency", "traço", "trait",
    ];

    const equipamentoTerms = [
      "item", "equipamento", "equipment", "arma", "weapon", "armadura",
      "armor", "armour", "escudo", "shield", "poção", "potion", "ferramenta",
      "tool", "suprimento", "supply", "moeda", "gold", "gp", "tesouro",
      "treasure", "varinha", "wand", "cajado", "staff", "orbe", "orb",
    ];

    const bestiárioTerms = [
      "monstro", "monster", "criatura", "creature", "besta", "beast",
      "dragão", "dragon", "demônio", "demon", "diabo", "devil", "goblin",
      "orc", "undead", "morto-vivo", "gigante", "giant", "humanoide",
      "humanoid", "aberração", "aberration", "celestial", "elemental",
      "fada", "fey", "planta", "plant", "constructo", "construct",
    ];

    const score = (terms: string[]) =>
      terms.filter((t) => lowerQuery.includes(t)).length;

    const scores = {
      magia: score(magiaTerms),
      combate: score(combateTerms),
      personagem: score(personagemTerms),
      equipamento: score(equipamentoTerms),
      bestiário: score(bestiárioTerms),
    };

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : undefined;
  }

  async getStats() {
    await this.initPromise;
    const books = new Set(this.documents.map((d) => d.metadata.book));
    const categories: Record<string, number> = {};

    this.documents.forEach((doc) => {
      categories[doc.metadata.category] =
        (categories[doc.metadata.category] || 0) + 1;
    });

    return {
      totalChunks: this.documents.length,
      totalBooks: books.size,
      books: Array.from(books),
      categories,
      totalPages: new Set(
        this.documents.map((d) => `${d.metadata.book}_${d.metadata.page}`),
      ).size,
    };
  }
}
