import type { Octokit } from "@octokit/rest";
import { installationOctokit } from "./octokit.js";

const MAX_FILES = 10;
const MAX_BYTES = 64 * 1024;
const MAX_SEARCH_RESULTS = 10;

export async function retrieveFiles(repo: string, paths: string[]) {
  const [owner, name] = repo.split("/");
  if (!owner || !name) return [];
  const octokit = (await installationOctokit(repo)) as Octokit;
  const out: Array<{ path: string; content: string }> = [];
  for (const path of paths.slice(0, MAX_FILES)) {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo: name,
        path,
      });
      if (
        !Array.isArray(data) &&
        data.type === "file" &&
        "size" in data &&
        data.size <= MAX_BYTES &&
        "content" in data
      ) {
        out.push({
          path,
          content: Buffer.from(data.content, "base64").toString("utf-8"),
        });
      }
    } catch {
      /* 404 / skip */
    }
  }
  return out;
}

export async function searchCode(repo: string, query: string): Promise<string[]> {
  try {
    const octokit = (await installationOctokit(repo)) as Octokit;
    const { data } = await octokit.rest.search.code({
      q: `${query} repo:${repo}`,
      per_page: MAX_SEARCH_RESULTS,
    });
    return (data.items ?? [])
      .map((i: { path: string }) => i.path)
      .slice(0, MAX_SEARCH_RESULTS);
  } catch {
    return [];
  }
}
