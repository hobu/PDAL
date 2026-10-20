const { test } = require('node:test');
const assert = require('node:assert/strict');
const report = require('./pr-ci-comments.cjs');

function fixture(eventName = 'workflow_run') {
    const state = {
        comments: [], files: [], jobs: [],
        pr: {
            number: 42, state: 'open',
            base: { repo: { full_name: 'hobu/PDAL' } },
            head: { sha: 'abc123', repo: { full_name: 'contributor/PDAL' } },
        },
        run: {
            id: 100, workflow_id: 10, run_attempt: 2, event: 'pull_request',
            path: '.github/workflows/pr-ci.yml', head_sha: 'abc123',
            head_repository: { full_name: 'contributor/PDAL' },
            pull_requests: [{ number: 42 }], conclusion: 'success',
            html_url: 'https://github.com/hobu/PDAL/actions/runs/100',
        },
        calls: [],
    };
    const rest = {
        issues: {
            listComments: 'comments',
            async createComment(args) {
                state.calls.push(['create', args]);
                state.comments.push({
                    id: state.comments.length + 1, body: args.body,
                    user: { login: 'github-actions[bot]' },
                });
            },
            async updateComment(args) {
                state.calls.push(['update', args]);
                state.comments.find(comment => comment.id === args.comment_id).body = args.body;
            },
        },
        pulls: { listFiles: 'files', async get() { return { data: state.pr }; } },
        repos: { listPullRequestsAssociatedWithCommit: 'associated' },
        actions: { listJobsForWorkflowRunAttempt: 'jobs' },
    };
    const github = {
        rest,
        async paginate(method, args) {
            state.calls.push([method, args]);
            if (method === 'associated') return [state.pr];
            return state[method];
        },
    };
    const context = {
        repo: { owner: 'hobu', repo: 'PDAL' }, eventName,
        payload: { workflow_run: state.run, pull_request: { number: 42 } },
    };
    return {
        state, context,
        run: () => report({ github, context, core: { info() {} } }),
    };
}

function job(name, conclusion = 'success') {
    return { name, conclusion, status: 'completed' };
}

test('initial-only run reports ARM64 success but not a skipped full matrix', async () => {
    const f = fixture();
    f.state.jobs = [job('Initial CI / Pixi'), job('Full CI', 'skipped')];
    await f.run();
    assert.equal(f.state.comments.length, 1);
    assert.match(f.state.comments[0].body, /Initial CI passed on Linux ARM64/);
    assert.match(f.state.comments[0].body, /ci:full/);
    assert.equal(f.state.calls.find(([method]) => method === 'jobs')[1].attempt_number, 2);
});

test('full success produces two distinct comments and reruns are idempotent', async () => {
    const f = fixture();
    f.state.jobs = [job('Initial CI / Pixi'), job('Full CI')];
    await f.run();
    await f.run();
    assert.equal(f.state.comments.length, 2);
    assert.match(f.state.comments[1].body, /full CI matrix passed/);
    assert.equal(f.state.calls.filter(([method]) => method === 'create').length, 2);
    assert.equal(f.state.calls.filter(([method]) => method === 'update').length, 0);
    f.state.run.html_url += '/attempts/3';
    await f.run();
    assert.equal(f.state.comments.length, 2);
    assert.equal(f.state.calls.filter(([method]) => method === 'update').length, 2);
});

for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out']) {
    test(`initial ${conclusion} never posts success`, async () => {
        const f = fixture();
        f.state.run.conclusion = conclusion;
        f.state.jobs = [job('Initial CI / Pixi', conclusion), job('Full CI', 'skipped')];
        await f.run();
        assert.equal(f.state.comments.length, 0);
    });
    test(`full ${conclusion} only reports the successful initial stage`, async () => {
        const f = fixture();
        f.state.run.conclusion = conclusion;
        f.state.jobs = [job('Initial CI / Pixi'), job('Full CI', conclusion)];
        await f.run();
        assert.equal(f.state.comments.length, 1);
        assert.doesNotMatch(f.state.comments[0].body, /full CI matrix passed/);
    });
}

test('overall failure suppresses full success even if the summary job passed', async () => {
    const f = fixture();
    f.state.run.conclusion = 'failure';
    f.state.jobs = [job('Initial CI / Pixi'), job('Full CI')];
    await f.run();
    assert.equal(f.state.comments.length, 1);
});

test('unrelated label runs, missing jobs, and incomplete jobs do not report success', async () => {
    const f = fixture();
    await f.run();
    f.state.jobs = [{ ...job('Initial CI / Pixi'), status: 'in_progress' }];
    await f.run();
    assert.equal(f.state.comments.length, 0);
});

for (const mismatch of ['head', 'base', 'source', 'closed']) {
    test(`ignores ${mismatch} mismatch for workflow run`, async () => {
        const f = fixture();
        f.state.jobs = [job('Initial CI / Pixi'), job('Full CI')];
        if (mismatch === 'head') f.state.pr.head.sha = 'new-commit';
        if (mismatch === 'base') f.state.pr.base.repo.full_name = 'elsewhere/PDAL';
        if (mismatch === 'source') f.state.pr.head.repo.full_name = 'other/PDAL';
        if (mismatch === 'closed') f.state.pr.state = 'closed';
        await f.run();
        assert.equal(f.state.comments.length, 0);
    });
}

test('fork PR fallback uses commit associations when run has no PR list', async () => {
    const f = fixture();
    f.state.run.pull_requests = [];
    f.state.jobs = [job('Initial CI / Pixi')];
    await f.run();
    assert.equal(f.state.comments.length, 1);
    assert.equal(f.state.calls.find(([method]) => method === 'associated')[1].commit_sha, 'abc123');
});

test('ignores push runs and different workflow paths', async () => {
    const f = fixture();
    f.state.jobs = [job('Initial CI / Pixi'), job('Full CI')];
    f.state.run.event = 'push';
    await f.run();
    f.state.run.event = 'pull_request';
    f.state.run.path = '.github/workflows/different.yml';
    await f.run();
    assert.equal(f.state.calls.length, 0);
});

test('test warning includes both directory names, deletions and renames out', async () => {
    const f = fixture('pull_request_target');
    f.state.files = [
        { filename: 'test/unit/Test.cpp', status: 'modified' },
        { filename: 'tests/new.cpp', status: 'added' },
        { filename: 'test/data/old.las', status: 'removed' },
        { filename: 'src/moved.cpp', previous_filename: 'tests/old.cpp', status: 'renamed' },
        { filename: 'src/main.cpp', status: 'modified' },
        { filename: 'test-other/no.cpp', status: 'modified' },
    ];
    await f.run();
    const body = f.state.comments[0].body;
    assert.match(body, /4 changed files/);
    assert.match(body, /test\/unit\/Test.cpp/);
    assert.match(body, /tests\/new.cpp/);
    assert.match(body, /test\/data\/old.las/);
    assert.match(body, /tests\/old.cpp.*src\/moved.cpp/);
    assert.doesNotMatch(body, /src\/main.cpp|test-other/);
});

test('warnings escape filenames and update when test changes disappear', async () => {
    const f = fixture('pull_request_target');
    f.state.files = [{ filename: 'tests/<x>&@maintainer.cpp', status: 'added' }];
    await f.run();
    assert.match(f.state.comments[0].body, /&lt;x&gt;&amp;&#64;maintainer/);
    f.state.files = [];
    await f.run();
    assert.equal(f.state.comments.length, 1);
    assert.match(f.state.comments[0].body, /no longer changes files/);
});

test('does not alter comments forged by a contributor', async () => {
    const f = fixture();
    f.state.comments = [{
        id: 99, body: '<!-- pdal-ci-initial:abc123 -->\nforged',
        user: { login: 'contributor' },
    }];
    f.state.jobs = [job('Initial CI / Pixi')];
    await f.run();
    assert.equal(f.state.comments.length, 2);
    assert.match(f.state.comments[0].body, /forged/);
});

test('large file lists stay within comment size and disclose API truncation', async () => {
    const f = fixture('pull_request_target');
    f.state.files = Array.from({ length: 3000 }, (_, i) => ({
        filename: `tests/${i}/${'x'.repeat(100)}.cpp`, status: 'modified',
    }));
    await f.run();
    assert.ok(f.state.comments[0].body.length < 65536);
    assert.match(f.state.comments[0].body, /more test paths/);
    assert.match(f.state.comments[0].body, /limits the files API to 3,000/);
});

test('no test changes on a new PR produce no warning', async () => {
    const f = fixture('pull_request_target');
    f.state.files = [{ filename: 'src/main.cpp', status: 'modified' }];
    await f.run();
    assert.equal(f.state.comments.length, 0);
});
