import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const statusFile = path.join(dataDir, "status.json");

export async function loadStatusSnapshot() {
  try {
    const raw = await readFile(statusFile, "utf8");
    const parsed = JSON.parse(String(raw).replace(/^\uFEFF/, ""));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveStatusSnapshot(snapshot) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(statusFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}
