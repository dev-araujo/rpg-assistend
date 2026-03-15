import { ingestPdf } from "../services/ingest.service.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runIngest = async () => {
  console.log("Starting the ingestion process for D&D library...\n");

  const dataPath = path.resolve(__dirname, "../../../data");

  try {
    const phbDocs = await ingestPdf(`${dataPath}/players_handbook-5.pdf`, {
      edition: "5e",
      book: "players_handbook",
      type: "rules",
    });
    const mmDocs = await ingestPdf(`${dataPath}/monster_manual-5.pdf`, {
      edition: "5e",
      book: "monster_manual",
      type: "bestiary",
    });

    const dmgDocs = await ingestPdf(`${dataPath}/dungeon_masters_guide-5.pdf`, {
      edition: "5e",
      book: "dungeon_masters_guide",
      type: "rules",
    });

    console.log(
      `Total chunks ready for database: ${phbDocs.length + mmDocs.length + dmgDocs.length}`,
    );
    console.log("All books have been successfully processed!");
  } catch (error) {
    console.error("Error during ingestion:", error);
  }
};

runIngest();
