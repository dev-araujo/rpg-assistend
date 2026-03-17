import fs from "fs/promises";
import path from "path";
import { generateEmbeddingBatch } from "../config/embeddings";

const pdf = require("pdf-parse");

interface Document {
  id: string;
  content: string;
  metadata: {
    source: string;
    page?: number;
    book?: string;
    chapter?: string;
    category?: string;
  };
  embedding?: number[];
}

const BATCH_SIZE = 32; 

export class IngestService {
  private documents: Document[] = [];
  private readonly dataPath = path.join(__dirname, "../../data");
  private readonly vectorPath = path.join(__dirname, "../../data/vectors");

  async init() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await fs.mkdir(this.vectorPath, { recursive: true });
    } catch (error) {
      console.error("Erro ao criar diretórios:", error);
    }
  }

  async processAllPDFs() {
    try {
      await this.init();

      const files = await fs.readdir(this.dataPath);
      const pdfFiles = files.filter((file) =>
        file.toLowerCase().endsWith(".pdf"),
      );

      console.log(`📚 Encontrados ${pdfFiles.length} PDFs para processar...`);

      for (const pdfFile of pdfFiles) {
        console.log(`\n📖 Processando: ${pdfFile}`);
        await this.processPDF(pdfFile);
        await this.saveDocuments();
      }

      console.log("\n✅ Processamento de todos os PDFs concluído!");
    } catch (error) {
      console.error("Erro ao processar PDFs:", error);
    }
  }

  private async processPDF(filename: string) {
    try {
      const filePath = path.join(this.dataPath, filename);
      const dataBuffer = await fs.readFile(filePath);

      console.log(`  📄 Lendo PDF: ${filename}`);

      // Parse do PDF - usando require, então é uma função
      let pdfData;
      try {
        // Simples assim com require
        pdfData = await pdf(dataBuffer);
      } catch (parseError) {
        console.error(
          `  ❌ Erro ao fazer parse do PDF ${filename}:`,
          parseError,
        );
        return;
      }

      console.log(`  📑 Total de páginas: ${pdfData.numpages}`);
      console.log(`  📝 Total de caracteres: ${pdfData.text?.length || 0}`);

      // Extrair texto por páginas
      const pages = this.extractPages(pdfData.text);

      const pendingDocs: Document[] = [];

      for (let i = 0; i < pages.length; i++) {
        const pageText = pages[i].trim();
        if (pageText.length < 50) continue;

        const chunks = this.smartChunking(pageText, filename, i + 1);
        for (const chunk of chunks) {
          const metadata = this.extractMetadata(chunk, filename, i + 1);
          pendingDocs.push({
            id: `${filename}_p${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: chunk,
            metadata,
          });
        }
      }

      console.log(`  📦 ${pendingDocs.length} chunks coletados. Gerando embeddings em lotes...`);

      // Gera embeddings em lote (sem delay de API)
      for (let i = 0; i < pendingDocs.length; i += BATCH_SIZE) {
        const batch = pendingDocs.slice(i, i + BATCH_SIZE);
        const texts = batch.map((d) => d.content);

        try {
          const embeddings = await generateEmbeddingBatch(texts);
          for (let j = 0; j < batch.length; j++) {
            batch[j].embedding = embeddings[j];
            this.documents.push(batch[j]);
          }
          console.log(`  ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pendingDocs.length / BATCH_SIZE)} processado (${i + batch.length}/${pendingDocs.length} chunks)`);
        } catch (error) {
          console.error(`  ❌ Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}, pulando...`);
        }
      }
    } catch (error) {
      console.error(`Erro ao processar PDF ${filename}:`, error);
    }
  }

  private extractPages(text: string): string[] {
    if (!text) return [];
    return text.split(/\f|\n{4,}/).filter((page) => page.trim().length > 0);
  }

  private smartChunking(
    text: string,
    filename: string,
    pageNum: number,
  ): string[] {
    const maxChunkSize = 1500;
    const minChunkSize = 200;

    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (trimmedPara.length === 0) continue;

      if (trimmedPara.length > maxChunkSize) {
        const sentences = trimmedPara.match(/[^.!?]+[.!?]+/g) || [trimmedPara];

        for (const sentence of sentences) {
          if (
            (currentChunk + sentence).length > maxChunkSize &&
            currentChunk.length > 0
          ) {
            if (currentChunk.length >= minChunkSize) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
          } else {
            currentChunk += " " + sentence;
          }
        }
      } else {
        if (
          (currentChunk + trimmedPara).length > maxChunkSize &&
          currentChunk.length > 0
        ) {
          if (currentChunk.length >= minChunkSize) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = trimmedPara;
        } else {
          currentChunk += (currentChunk ? "\n\n" : "") + trimmedPara;
        }
      }
    }

    if (currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private extractMetadata(
    text: string,
    filename: string,
    pageNum: number,
  ): any {
    const chapterPatterns = [
      /chapter\s+(\d+):\s*([^\n]+)/i,
      /cap[ií]tulo\s+(\d+):\s*([^\n]+)/i,
      /^([A-Z][A-Z\s]{5,})$/m,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)$/m,
    ];

    let chapter = "Desconhecido";
    for (const pattern of chapterPatterns) {
      const match = text.match(pattern);
      if (match) {
        chapter = match[0].trim();
        break;
      }
    }

    const lowerText = text.toLowerCase();

    const categoryTerms: Record<string, string[]> = {
      magia: [
        "spell", "spellcast", "magic", "magical", "enchantment", "illusion",
        "necromancy", "conjuration", "divination", "abjuration", "evocation",
        "concentration", "cantrip", "scroll", "ritual", "arcane", "divine",
        "magia", "mágico", "feitiço", "feitiçaria", "conjuração", "ritual",
        "encantamento", "evocação", "ilusão", "necromancia", "transmutação",
        "adivinhação", "abjuração", "invocação", "concentração", "pergaminho",
      ],
      combate: [
        "combat", "attack", "damage", "hit", "initiative", "action", "reaction",
        "movement", "saving throw", "critical", "weapon attack", "armor class",
        "combate", "ataque", "dano", "iniciativa", "ação", "reação", "movimento",
        "teste de resistência", "crítico", "classe de armadura", "resistência",
        "golpe", "ferimento", "batalha", "luta", "turno", "round",
      ],
      personagem: [
        "class", "race", "level", "experience", "ability", "skill", "feat",
        "background", "alignment", "proficiency", "trait", "attribute",
        "classe", "raça", "nível", "experiência", "habilidade", "perícia",
        "talento", "antecedente", "alinhamento", "proficiência", "traço",
        "atributo", "personagem", "character", "subclasse", "subclass",
      ],
      equipamento: [
        "weapon", "armor", "armour", "shield", "equipment", "item", "tool",
        "potion", "wand", "staff", "orb", "supply", "gold", "treasure",
        "arma", "armadura", "escudo", "equipamento", "ferramenta", "poção",
        "varinha", "cajado", "orbe", "tesouro", "moeda", "suprimento",
      ],
      bestiário: [
        "monster", "creature", "beast", "dragon", "demon", "devil", "undead",
        "giant", "humanoid", "aberration", "celestial", "elemental", "fey",
        "construct", "plant", "goblin", "orc",
        "monstro", "criatura", "besta", "dragão", "demônio", "diabo",
        "morto-vivo", "gigante", "humanoide", "aberração", "elemental", "fada",
      ],
    };

    const scores = Object.entries(categoryTerms).map(([cat, terms]) => ({
      category: cat,
      score: terms.filter((t) => lowerText.includes(t)).length,
    }));

    const best = scores.sort((a, b) => b.score - a.score)[0];
    const category = best.score > 0 ? best.category : "geral";

    const bookName = filename
      .replace(".pdf", "")
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    return {
      source: filename,
      book: bookName,
      page: pageNum,
      chapter,
      category,
      timestamp: new Date().toISOString(),
    };
  }

  private async saveDocuments() {
    const filePath = path.join(this.vectorPath, "documents.json");
    await fs.writeFile(filePath, JSON.stringify(this.documents));
    console.log(
      `\n💾 ${this.documents.length} chunks de documentos salvos em ${filePath}`,
    );
  }
}
