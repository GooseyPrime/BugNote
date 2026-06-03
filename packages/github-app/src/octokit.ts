import { App } from "@octokit/app";
import { requireGithubEnv } from "./env.js";

export async function installationOctokit(repo: string) {
  const env = requireGithubEnv();
  const app = new App({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });
  const [owner, name] = repo.split("/");
  const { data: inst } = await app.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    { owner, repo: name },
  );
  return app.getInstallationOctokit(inst.id);
}
