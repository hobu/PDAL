const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Exercise the actual inline API-only guard without adding a YAML dependency.
const workflow = readFileSync(join(__dirname, '../workflows/pr-ci.yml'), 'utf8');
const source = workflow.match(/^          script: \|\n((?:            [^\n]*\n|\n)+)/m);
assert.ok(source, 'PR CI must contain the authorization script');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const authorize = new AsyncFunction('github', 'context', 'core',
    source[1].replace(/^ {12}/gm, ''));

function labelEvent(id, username = 'writer', event = 'labeled', name = 'ci:full') {
    return { id, event, label: { name }, actor: { login: username } };
}

function fixture() {
    const state = {
        pr: { number: 42, state: 'open', head: { sha: 'abc123' }, labels: [{ name: 'ci:full' }] },
        events: [labelEvent(1)],
        permissions: { writer: { permission: 'write', role_name: 'write' } },
        calls: [], notices: [],
    };
    const context = {
        repo: { owner: 'hobu', repo: 'PDAL' },
        actor: 'writer',
        payload: {
            action: 'labeled', label: { name: 'ci:full' },
            pull_request: { number: 42, head: { sha: 'abc123' } },
        },
    };
    const github = {
        rest: {
            pulls: {
                async get(args) {
                    state.calls.push(['pull', args]);
                    return { data: state.pr };
                },
            },
            issues: { listEvents: 'events' },
            repos: {
                async getCollaboratorPermissionLevel(args) {
                    state.calls.push(['permission', args]);
                    const data = state.permissions[args.username] || { permission: 'none' };
                    if (data instanceof Error) throw data;
                    return { data };
                },
            },
        },
        async paginate(method, args) {
            state.calls.push([method, args]);
            if (state.events instanceof Error) throw state.events;
            return state.events;
        },
    };
    return {
        state, context,
        run: () => authorize(github, context, {
            notice: message => state.notices.push(message),
        }),
    };
}

for (const [role, permission] of [['write', 'write'], ['maintain', 'write'], ['admin', 'admin']]) {
    test(`${role} can authorize full CI`, async () => {
        const f = fixture();
        f.state.permissions.writer = { permission, role_name: role };
        assert.equal(await f.run(), true);
    });
}

for (const [role, permission] of [['read', 'read'], ['triage', 'read'], ['none', 'none'], ['unknown', undefined]]) {
    test(`${role} cannot authorize full CI`, async () => {
        const f = fixture();
        f.state.permissions.writer = { permission, role_name: role };
        assert.equal(await f.run(), false);
        assert.match(f.state.notices[0], /needs repository write access/);
    });
}

test('custom roles use effective base permission, not the role name', async () => {
    const f = fixture();
    f.state.permissions.writer = { permission: 'write', role_name: 'release-team' };
    assert.equal(await f.run(), true);
    f.state.permissions.writer = { permission: 'read', role_name: 'write' };
    assert.equal(await f.run(), false);
});

test('contributor pushes retain a writer-approved label', async () => {
    const f = fixture();
    f.context.actor = 'contributor';
    f.context.payload.action = 'synchronize';
    assert.equal(await f.run(), true);
    const users = f.state.calls.filter(([method]) => method === 'permission')
        .map(([, args]) => args.username);
    assert.deepEqual(users, ['writer']);
});

test('an unauthorized label cannot enable full CI on a later push', async () => {
    const f = fixture();
    f.context.payload.action = 'synchronize';
    f.state.events = [labelEvent(1, 'triager')];
    f.state.permissions.triager = { permission: 'read', role_name: 'triage' };
    assert.equal(await f.run(), false);
});

test('latest reapplication replaces older approval even if events are unordered', async () => {
    const f = fixture();
    f.context.payload.action = 'synchronize';
    f.state.events = [
        labelEvent(3, 'triager'), labelEvent(1), labelEvent(2, 'triager', 'unlabeled'),
    ];
    f.state.permissions.triager = { permission: 'read', role_name: 'triage' };
    assert.equal(await f.run(), false);
    f.state.events.push(labelEvent(4, 'writer', 'unlabeled'), labelEvent(5));
    assert.equal(await f.run(), true);
});

test('an unrelated later label does not replace the approval', async () => {
    const f = fixture();
    f.state.events.push(labelEvent(2, 'triager', 'labeled', 'enhancement'));
    assert.equal(await f.run(), true);
});

test('unrelated label events never authorize a new run', async () => {
    const f = fixture();
    f.context.payload.label.name = 'enhancement';
    assert.equal(await f.run(), false);
    assert.equal(f.state.calls.length, 0);
});

test('unexpected event actions never authorize a run', async () => {
    const f = fixture();
    f.context.payload.action = 'edited';
    assert.equal(await f.run(), false);
    assert.equal(f.state.calls.length, 0);
});

test('a removed label denies approval despite the event snapshot', async () => {
    const f = fixture();
    f.state.pr.labels = [];
    assert.equal(await f.run(), false);
    assert.equal(f.state.calls.filter(([method]) => method === 'permission').length, 0);
});

test('a removal found in history denies approval despite a stale PR response', async () => {
    const f = fixture();
    f.state.events.push(labelEvent(2, 'writer', 'unlabeled'));
    assert.equal(await f.run(), false);
});

for (const mismatch of ['closed', 'head']) {
    test(`a ${mismatch} PR does not authorize an old run`, async () => {
        const f = fixture();
        if (mismatch === 'closed') f.state.pr.state = 'closed';
        if (mismatch === 'head') f.state.pr.head.sha = 'new-commit';
        assert.equal(await f.run(), false);
    });
}

test('missing label history or a deleted actor fails closed', async () => {
    const f = fixture();
    f.state.events = [];
    assert.equal(await f.run(), false);
    f.state.events = [{ ...labelEvent(1), actor: null }];
    assert.equal(await f.run(), false);
});

test('revoked write access invalidates the label on subsequent runs', async () => {
    const f = fixture();
    f.context.payload.action = 'reopened';
    assert.equal(await f.run(), true);
    f.state.permissions.writer.permission = 'read';
    assert.equal(await f.run(), false);
});

test('an unauthorized label event cannot borrow a later writer approval', async () => {
    const f = fixture();
    f.context.actor = 'triager';
    f.context.triggering_actor = 'writer';
    f.state.permissions.triager = { permission: 'read', role_name: 'triage' };
    assert.equal(await f.run(), false);
});

test('permission checks target the base repository and ignore author association', async () => {
    const f = fixture();
    f.context.payload.pull_request.head.repo = { full_name: 'writer/PDAL' };
    f.context.payload.pull_request.author_association = 'OWNER';
    f.state.permissions.writer.permission = 'read';
    assert.equal(await f.run(), false);
    const args = f.state.calls.find(([method]) => method === 'permission')[1];
    assert.equal(args.owner, 'hobu');
    assert.equal(args.repo, 'PDAL');
});

test('missing collaborator permission is denied', async () => {
    const f = fixture();
    f.state.permissions.writer = Object.assign(new Error('Not Found'), { status: 404 });
    assert.equal(await f.run(), false);
});

for (const status of [403, 429, 500]) {
    test(`permission API ${status} fails closed instead of granting access`, async () => {
        const f = fixture();
        f.state.permissions.writer = Object.assign(new Error('API unavailable'), { status });
        await assert.rejects(f.run(), /API unavailable/);
    });
}

test('unavailable event history cannot authorize the matrix', async () => {
    const f = fixture();
    f.state.events = new Error('Event history unavailable');
    await assert.rejects(f.run(), /Event history unavailable/);
});
