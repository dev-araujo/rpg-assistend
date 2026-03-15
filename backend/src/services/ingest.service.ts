import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface BookMetadata {
  edition: string;
  book: string;
  type: string;
  [key: string]: any;
}

export const ingestPdf = async (filePath: string, metadata: BookMetadata) => {
  console.log(`[Ingest Service] Loading PDF from: ${filePath}`);

  const loader = new PDFLoader(filePath);
  const rawDocs = await loader.load();

  console.log(`[Ingest Service] Splitting text for ${metadata.book}...`);
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await textSplitter.splitDocuments(rawDocs);

  console.log(
    `[Ingest Service] Injecting metadata into ${docs.length} chunks...`,
  );
  const docsWithMetadata = docs.map((doc: any) => {
    doc.metadata = {
      ...doc.metadata,
      ...metadata,
    };
    return doc;
  });

  console.log(`[Ingest Service] Successfully processed ${metadata.book}.\n`);

  return docsWithMetadata;
};
