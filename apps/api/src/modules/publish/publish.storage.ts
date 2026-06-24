import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const EXPORT_ROOT = path.resolve(process.cwd(), "../../exports");

export async function storeExportArtifact(params: {
  organizationId: string;
  publishJobId: string;
  fileName: string;
  content: string;
  fileType: string;
}): Promise<{ fileName: string; filePath: string; byteSize: number }> {
  const dir = path.join(EXPORT_ROOT, params.organizationId, params.publishJobId);
  await mkdir(dir, { recursive: true });

  const filePath = path.join(dir, params.fileName);
  await writeFile(filePath, params.content, "utf8");

  return {
    fileName: params.fileName,
    filePath,
    byteSize: Buffer.byteLength(params.content, "utf8"),
  };
}

export async function readArtifact(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}
