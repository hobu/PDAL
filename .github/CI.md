# Pull request CI

Every opened, reopened, or updated PR first runs the Pixi build and tests on
`ubuntu-24.04-arm`, including documentation-only PRs. A successful initial run
posts an **Initial CI passed** comment with the tested head SHA and run link.

After reviewing that result, a maintainer applies the **`ci:full`** label. Create
this repository label before using the gate:

```sh
gh label create ci:full --repo OWNER/PDAL --color 0E8A16 \
  --description "Run all CI platforms after Linux ARM64 passes"
```

Adding the label starts a new run, which rechecks ARM64 and then runs Linux
(current/fixed), macOS, Windows (current/fixed), Alpine, Conda (three platforms),
and Docker (AMD64/ARM64). The **Full CI** job succeeds only when every platform
succeeds. A second bot comment reports full success. Failures, cancellation,
skipped platforms, and results for an older PR head never produce a full-success
comment.

The label remains effective for subsequent pushes: each new revision must pass
ARM64 before its full matrix starts. Remove it to return subsequent runs to the
initial stage; removing it does not cancel work already started. Labels other
than `ci:full` do not start builds or interrupt active runs. To retry a failure,
rerun the workflow in Actions, or remove and reapply `ci:full`.

The bot also maintains a warning listing added, modified, deleted, or renamed
paths under `test/` (PDAL's test tree) and `tests/`. Renames out of those directories
are included. Test data changes count too. If later commits remove those changes,
the warning is updated. Large lists are truncated with a notice.

## Permissions and deployment

PR builds use read-only repository permissions and no publishing credentials.
Docker PR builds never publish images. Existing Docker publishing continues on
`master` and version tags. Other standalone CI workflows run on `master` and tags;
feature-branch pushes use PR CI instead of bypassing its gate.

The comment workflow uses `pull_request_target` for file warnings and
`workflow_run` for results. It checks out only the repository's default branch,
reads GitHub API metadata, and never executes PR code or consumes PR artifacts.
GitHub must have this workflow and its script on the **default branch** before
comments work, including during fork testing. No personal access token is needed.
Success comments are updated per head SHA, avoiding duplicates on reruns.

The initial check is named `Initial CI / Pixi`. Existing branch protection rules
may need updating after deployment because the platform workflows now run inside
PR CI. A skipped `Full CI` check is not proof of a full run: GitHub treats skipped
jobs as passing for required checks. This change controls CI scheduling; it does
not modify repository merge rules.

## Validation

Run the reporting tests with:

```sh
node --test .github/scripts/pr-ci-comments.test.cjs
actionlint
```

For live testing, use a PR in `hobu/PDAL` with this change on the fork's default
branch. Confirm only ARM64 builds initially, inspect the initial-success comment,
apply `ci:full`, then verify all platforms and the full-success comment. Exercise
an unrelated label, a new commit, a failed initial build, and changes/renames under
both test directory spellings. Restore the fork's original default branch after
testing. Only push branches to `hobu`; prepare the upstream PR after validation.
