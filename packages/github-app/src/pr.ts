import type { FixProposal } from "@bugnote/shared";
import type { Octokit } from "@octokit/rest";
import { installationOctokit } from "./octokit.js";

export async function openDraftPr(
  repo: string,
  fix: FixProposal,
  report: { id: string },
): Promise<string> {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`invalid repo: ${repo}`);
  const octokit = (await installationOctokit(repo)) as Octokit;

  const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo: name });
  const base = repoInfo.default_branch;
  const { data: baseRef } = await octokit.rest.git.getRef({
    owner,
    repo: name,
    ref: `heads/${base}`,
  });
  const baseSha = baseRef.object.sha;
  const { data: baseCommit } = await octokit.rest.git.getCommit({
    owner,
    repo: name,
    commit_sha: baseSha,
  });

  const tree = await Promise.all(
    fix.files.map(async (f) => {
      const { data: blob } = await octokit.rest.git.createBlob({
        owner,
        repo: name,
        content: f.newContent,
        encoding: "utf-8",
      });
      return {
        path: f.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    }),
  );

  const { data: newTree } = await octokit.rest.git.createTree({
    owner,
    repo: name,
    base_tree: baseCommit.tree.sha,
    tree,
  });
  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo: name,
    message: `fix: ${fix.summary}\n\nBugNote report ${report.id}`,
    tree: newTree.sha,
    parents: [baseSha],
  });

  const branch = `bugnote/${report.id.slice(0, 8)}`;
  try {
    await octokit.rest.git.createRef({
      owner,
      repo: name,
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    if (status !== 422) throw e;
    await octokit.rest.git.updateRef({
      owner,
      repo: name,
      ref: `heads/${branch}`,
      sha: commit.sha,
      force: true,
    });
  }

  const body = [
    `Automated **draft** from BugNote for report \`${report.id}\`.`,
    "",
    `**Summary:** ${fix.summary}`,
    "",
    `**Confidence:** ${fix.confidence}`,
    "",
    "```diff",
    fix.diff,
    "```",
    "",
    "_Review carefully. Tests run on this PR's CI, not on the host VM._",
  ].join("\n");

  const { data: pull } = await octokit.rest.pulls.create({
    owner,
    repo: name,
    head: branch,
    base,
    draft: true,
    title: `[BugNote] ${fix.summary}`.slice(0, 80),
    body,
  });
  return pull.html_url;
}
