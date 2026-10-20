const FULL_LABEL = 'ci:full';
const INITIAL_JOB = 'Initial CI / Linux ARM64 current';
const FULL_JOB = 'Full CI';

async function upsertComment(github, repo, number, marker, text) {
    const comments = await github.paginate(github.rest.issues.listComments, {
        ...repo, issue_number: number, per_page: 100,
    });
    const existing = comments.find(comment =>
        comment.user?.login === 'github-actions[bot]' &&
        comment.body?.startsWith(marker));
    const body = `${marker}\n${text}`;
    if (existing) {
        if (existing.body !== body) {
            await github.rest.issues.updateComment({
                ...repo, comment_id: existing.id, body,
            });
        }
    } else {
        await github.rest.issues.createComment({
            ...repo, issue_number: number, body,
        });
    }
}

function escapePath(path) {
    return path.replace(/[&<>@]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '@': '&#64;',
    })[char]);
}

async function reportTestChanges(github, repo, pr) {
    const files = await github.paginate(github.rest.pulls.listFiles, {
        ...repo, pull_number: pr.number, per_page: 100,
    });
    const isTest = path => /^(test|tests)\//.test(path || '');
    const changed = files.filter(file =>
        isTest(file.filename) || isTest(file.previous_filename));
    const marker = '<!-- pdal-test-changes -->';
    if (!changed.length) {
        if (files.length >= 3000) {
            await upsertComment(github, repo, pr.number, marker,
                '⚠️ GitHub returned its maximum of 3,000 changed files. No test paths ' +
                'were found in that list, but changes under `test/` or `tests/` may ' +
                'be missing. Please review the complete diff for test changes.');
            return;
        }
        // Clear a warning if a later push removes all test changes.
        const comments = await github.paginate(github.rest.issues.listComments, {
            ...repo, issue_number: pr.number, per_page: 100,
        });
        const warning = comments.find(comment =>
            comment.user?.login === 'github-actions[bot]' &&
            comment.body?.startsWith(marker));
        if (warning) {
            await github.rest.issues.updateComment({
                ...repo, comment_id: warning.id,
                body: `${marker}\nThis PR no longer changes files under \`test/\` or \`tests/\`.`,
            });
        }
        return;
    }
    let paths = '';
    let listed = 0;
    for (const file of changed) {
        const previous = file.previous_filename
            ? `<code>${escapePath(file.previous_filename)}</code> → ` : '';
        const line = `- ${previous}<code>${escapePath(file.filename)}</code> (${file.status})\n`;
        // Stay below GitHub's comment limit, including unusually long filenames.
        if (paths.length + line.length > 55000) break;
        paths += line;
        listed++;
    }
    let text = `⚠️ This contribution changes test code or test data under \`test/\` or \`tests/\`.\n\n` +
        `Please review these changes alongside the implementation (${changed.length} changed files):\n\n${paths}`;
    if (listed < changed.length) {
        text += `\n${changed.length - listed} more test paths are shown in the PR's Files changed tab.\n`;
    }
    if (files.length >= 3000) {
        text += '\nGitHub limits the files API to 3,000 files; additional test changes may exist.\n';
    }
    await upsertComment(github, repo, pr.number, marker, text);
}

async function reportResults(github, context, core) {
    const repo = context.repo;
    const run = context.payload.workflow_run;
    if (run.event !== 'pull_request' || run.path !== '.github/workflows/pr-ci.yml') return;

    // Fork runs can have an empty pull_requests array. Resolve using the commit
    // association, then verify the current head, base repo, and source repo.
    let candidates = run.pull_requests || [];
    if (!candidates.length) {
        candidates = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
            ...repo, commit_sha: run.head_sha, per_page: 100,
        });
    }
    const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
        ...repo, run_id: run.id, attempt_number: run.run_attempt, per_page: 100,
    });
    const passed = name => jobs.some(job =>
        job.name === name && job.status === 'completed' && job.conclusion === 'success');
    for (const candidate of candidates) {
        const { data: pr } = await github.rest.pulls.get({
            ...repo, pull_number: candidate.number,
        });
        if (pr.state !== 'open' ||
            pr.head.sha !== run.head_sha ||
            pr.base.repo.full_name !== `${repo.owner}/${repo.repo}` ||
            pr.head.repo?.full_name !== run.head_repository.full_name) {
            core.info(`Ignoring stale or unrelated run ${run.id} for PR #${pr.number}.`);
            continue;
        }
        if (passed(INITIAL_JOB)) {
            await upsertComment(github, repo, pr.number,
                `<!-- pdal-ci-initial:${run.head_sha} -->`,
                `✅ Initial CI passed on Linux ARM64 with cached Conda dependencies for \`${run.head_sha}\`.\n\n` +
                `A maintainer can apply the \`${FULL_LABEL}\` label to run the full CI matrix.\n\n` +
                `[View CI run](${run.html_url})`);
        }
        if (run.conclusion === 'success' && passed(INITIAL_JOB) && passed(FULL_JOB)) {
            await upsertComment(github, repo, pr.number,
                `<!-- pdal-ci-full:${run.head_sha} -->`,
                `✅ The full CI matrix passed for \`${run.head_sha}\`: Linux ARM64 (cached Conda dependencies), Pixi, ` +
                `Linux (current and fixed), macOS, Windows (current and fixed), Alpine, ` +
                `Conda (Linux, macOS, and Windows), and Docker (AMD64 and ARM64).\n\n` +
                `Maintainers and project managers: this revision has passed all CI platforms.\n\n` +
                `[View CI run](${run.html_url})`);
        }
    }
}

module.exports = async ({ github, context, core }) => {
    if (context.eventName === 'pull_request_target') {
        const { data: pr } = await github.rest.pulls.get({
            ...context.repo, pull_number: context.payload.pull_request.number,
        });
        if (pr.state === 'open') await reportTestChanges(github, context.repo, pr);
    } else if (context.eventName === 'workflow_run') {
        await reportResults(github, context, core);
    }
};
