const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function loadRenderers() {
    const context = {
        URLSearchParams,
        t: key => key,
        console
    };
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(
            'src/frontend/js/IllustrationPicker.js', 'utf8'
        ) + ';this.IllustrationPicker=IllustrationPicker;',
        context
    );
    vm.runInContext(
        fs.readFileSync(
            'src/frontend/js/ProgrammeRenderers.js', 'utf8'
        ) + ';this.ProgrammeRenderers=ProgrammeRenderers;',
        context
    );
    return context.ProgrammeRenderers;
}

test('programme renderer uses stored action illustration in compact mode', () => {
    const renderers = loadRenderers();
    const html = renderers.renderActionIllustration({
        id: 'a1',
        illustration: {
            collection: 'tabler', name: 'wash',
            style: 'doodle-v1', seed: 42
        }
    }, 'demo', 'task-icon');
    assert.match(html, /class="task-icon"/);
    assert.match(html, /\/api\/demo\/illustrations\/wash\.svg/);
    assert.match(html, /seed=42/);
    assert.match(html, /variant=compact/);
});

test('settings exposes labelled editing for admins without execution controls', () => {
    const renderers = loadRenderers();
    for (const isMember of [false, true]) {
        for (const status of ['due', 'overdue', 'ok']) {
            const html = renderers.renderActionItem({
                item: {
                    data: { id: 'a1', name: 'Lavabo', states: [] },
                    occurrence: { occurrenceDate: '2026-04-20' }, status
                },
                locale: 'fr', isMember, getMemberName: () => '', collectiveId: 'demo'
            });
            assert.doesNotMatch(html, /btn-mark-done|btn-edit-log|btn-edit-future/);
            if (isMember) {
                assert.doesNotMatch(html, /btn-edit-action|btn-delete-action/);
            } else {
                assert.match(html, /btn-edit-action/);
                assert.match(html, /bi-pencil" aria-hidden="true"><\/i> edit/);
                const editButton = html.match(/<button[^>]*btn-edit-action[\s\S]*?<\/button>/)[0];
                assert.doesNotMatch(editButton, /d-none|d-sm-|d-md-|btn-icon/);
            }
        }
    }
});

test('programme renderer gives historical actions a stable fallback', () => {
    const renderers = loadRenderers();
    const first = renderers.renderActionIllustration(
        { id: 'legacy-id', name: 'Ancienne tâche' },
        'demo', 'task-icon'
    );
    const second = renderers.renderActionIllustration(
        { id: 'legacy-id', name: 'Ancienne tâche' },
        'demo', 'task-icon'
    );
    assert.equal(first, second);
    assert.match(first, /clipboard-check\.svg/);
});
