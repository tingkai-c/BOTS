# Team workflow

## Access

GitHub collaborators work in `tingkai-c/BOTS`. The Vercel Hobby project remains owned by Kai; contributors do not need a Vercel seat to open the app or a public preview. Do not share the owner's Vercel token.

## Branches and automatic previews

### Where is my preview link?

1. Open your pull request from [the PR list](https://github.com/tingkai-c/BOTS/pulls).
2. Find the **🔎 Haggleface preview** bot comment in the Conversation tab.
3. Click the large **Open Haggleface preview ↗** link, or copy the URL below it into team chat.

The same comment updates after each deployment. While building, it shows a status link; if a build fails, it points to the checks. You can also open the **Preview link** GitHub Actions run to find the URL in its summary. Vercel's existing deployment check/comment remains available as a fallback.

No separate deployment command is required. The comment automation applies after the workflow is merged into `main`; same-repository PRs can also run it directly from their branch.

### Create a branch

```bash
git fetch origin
git switch -c feat/my-change origin/main
# Implement and verify the task.
git add <intended-files>
git commit -m "Describe the change"
git push -u origin feat/my-change
```

Open a pull request targeting `main`. Vercel's Git integration is configured to deploy every branch push:

- `main` updates **https://haggleface.vercel.app** after a successful build.
- Every other branch gets a Preview URL. Find the **Haggleface preview** comment on its PR, or use the Vercel check/deployment list.
- New pushes update that branch's preview. Teammates open the URL and sign into Haggleface through Clerk.
- The GitHub **Checks** workflow runs unit tests, typecheck, lint, and build without secrets. Get a teammate's review and passing checks before merging. This is the team convention; enforced branch protection is separate.

Keep branches short-lived and task-specific. A shared `staging` branch is optional, not required: if the team creates one, Vercel treats it as another Preview branch.

Previews are publicly reachable because Vercel Authentication protection is disabled. Clerk still protects private searches and agent endpoints. Untrusted external-fork previews require owner approval; do not disable fork protection or expose secrets through a pull-request workflow.

Vercel Hobby does not provide shared project-management seats. Public-repository Git previews are the intended path here. If a contributor's deployment is blocked by Vercel, inspect the actual GitHub check; do not share account tokens or spoof commit authors to bypass access checks.

## Database separation

The Convex project is named `scout-market` even though the app and Vercel project are Haggleface. Keep this Convex project.

| Environment | Convex deployment | URL |
| --- | --- | --- |
| Vercel Production | `cheery-bison-90` | `https://cheery-bison-90.convex.cloud` |
| Vercel Preview | `sensible-newt-347` | `https://sensible-newt-347.convex.cloud` |

Each environment has its own `CONVEX_SERVER_SECRET`. The value in Vercel must match the corresponding Convex environment. Production settings must not be copied into branch previews.

Clerk currently uses the same development instance for the hackathon. Test and production database records and marketplace connection references remain separate. Steel and Anthropic credentials currently share their service quotas; browser time and model tokens are not unlimited.

## Backend changes

Vercel deploys Next.js, not Convex functions. A PR that changes `convex/` must include a backend deployment note:

1. Coordinate changes with the team: all previews share the test backend.
2. Verify the CLI is targeting the test deployment, then run `pnpm exec convex dev --once`.
3. Keep the test backend compatible with other active previews.
4. Have the release owner deploy reviewed backend changes to production with `pnpm exec convex deploy` at release time.

Do not run `convex deploy` from a feature branch against the shared production project. For an incompatible experiment, use a separately configured development deployment instead of disrupting the shared test backend.

## Local work

Use Node.js 24 and pnpm 11.20.0. Run `pnpm install` and `pnpm dev`. Without keys, the app runs its labeled demo. Request development configuration privately only when live-integration work needs it. `.env.example` documents variable names; never commit populated environment files.

## Troubleshooting previews

- **No deployment:** check the Git connection, branch deployment settings, and the PR's Vercel status.
- **Build starts but fails:** inspect Vercel build logs. The Playwright tracing configuration in `next.config.ts` must retain the physical pnpm package path without adding its symlink directory.
- **Unexpected end of JSON / empty response:** inspect the function logs. An empty platform error is not valid application JSON; the client parser must show an actionable message.
- **Sign-in works but data fails:** verify the Preview Convex URL, Clerk `convex` JWT template/issuer, and matching test server secret.
- **Old UI after a push:** a failed build leaves the last successful deployment online; inspect the deployed commit SHA rather than assuming the push succeeded.
