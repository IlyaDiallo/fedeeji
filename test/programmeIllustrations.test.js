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
