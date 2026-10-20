# Pull request CI

Every opened, reopened, or updated PR first runs a Linux Debug build and tests on
`ubuntu-24.04-arm`, including documentation-only PRs. The gate uses the existing
Linux CMake configuration, `scripts/ci/current-environment.yml`, and `ccache`.
The complete solved Conda environment is cached with a stable versioned key;
cache hits skip dependency solving and installation, even on later days. The gate
prioritizes reusing working dependencies over picking up every package release.
It configures and builds once, then invokes CTest directly. Master pushes also run
the ARM64 gate to populate caches that new PRs can restore. Installation, examples, standalone plugin
rebuilds, and the second locale test pass remain in the full matrix. A successful
initial run posts an **Initial CI passed** comment with the tested head SHA and
run link.

Pixi runs in the full matrix with its `RelWithDebInfo` setup. The workflow invokes
only its `test` task, which already depends on configure/build, to avoid a second
compilation. The gate uses the faster Debug configuration and compiler caching
while retaining the basic Linux build's test coverage.
Standard ARM64 and x64 GitHub-hosted runners are both free for public repositories;
the gate uses the standard ARM64 runner, not a paid larger runner.

The environment cache automatically changes when `current-environment.yml`
changes. Micromamba is pinned because the setup action also includes its binary
hash in the cache key. To refresh dependencies deliberately, bump
`cache-environment-key: gate-current-v1` in `linux-gate.yml` (for example, to
`gate-current-v2`). Changing the pinned Micromamba version or a GitHub cache
eviction can also require a fresh solve. Package downloads and compiled objects
are cached separately. The environment cache key has no date, commit SHA, or PR
number; master builds populate caches that other PRs can restore, while a PR's
own caches benefit later runs of that PR within GitHub's cache access rules.

After reviewing that result, a maintainer applies the **`ci:full`** label. Create
this repository label before using the gate:

```sh
gh label create ci:full --repo OWNER/PDAL --color 0E8A16 \
  --description "Run all CI platforms after Linux ARM64 passes"
```

Adding the label starts a new run, which rechecks ARM64 and then runs Pixi, Linux
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

The initial check is named `Initial CI / Linux ARM64 current`. Existing branch protection rules
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
