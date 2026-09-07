const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
    constructor(tag) {
        this.tag = tag; this.children = []; this.listeners = {}; this.attributes = {};
        this.classList = { add() {} }; this.value = ''; this.disabled = false;
    }
    replaceChildren(...children) { this.children = children; }
    append(...children) { this.children.push(...children); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    fire(name, event = {}) { this.listeners[name]?.(event); }
    focus() { this.focused = true; }
    querySelector(tag) {
        for (const child of this.children) {
            if (child.tag === tag) return child;
            const match = child.querySelector?.(tag);
            if (match) return match;
        }
        return null;
    }
}

function fixture() {
    const context = vm.createContext({ t: key => key, document: {
        createElement: tag => new Element(tag), createTextNode: text => ({ text })
    } });
    vm.runInContext(fs.readFileSync('src/frontend/js/MemberMultiSelect.js', 'utf8') + '\nthis.Picker = MemberMultiSelect;', context);
    const container = new Element('div');
    const picker = new context.Picker({ container,
        members: Array.from({ length: 50 }, (_, i) => ({ id: String(i) })),
        selectedIds: ['1'], getMemberName: id => id === '1' ? 'Élodie' : `Membre ${id}`
    });
    return { picker, container, search: picker.details.querySelector('input') };
}

test('50 members: accent-insensitive search preserves selection and handles no results', () => {
    const { picker, search } = fixture();
    assert.equal(picker.entries.length, 50);
    assert.equal(picker.badges.children.length, 1);
    search.value = 'elodie'; search.fire('input');
    assert.equal(picker.entries.filter(e => !e.label.hidden).length, 1);
    search.value = 'absent'; search.fire('input');
    assert.equal(picker.entries.filter(e => !e.label.hidden).length, 0);
    assert.equal(picker.details.querySelector('p').hidden, false);
    assert.equal(picker.entries[1].input.checked, true);
    picker.details.open = true; picker.details.fire('toggle');
    assert.equal(search.value, '');
    assert.equal(search.focused, true);
    assert.equal(picker.entries.filter(e => !e.label.hidden).length, 50);
});

test('checkboxes create removable badges; Escape closes the picker and restores focus', () => {
    const { picker } = fixture();
    picker.entries[2].input.checked = true;
    picker.entries[2].input.fire('change');
    assert.equal(picker.badges.children.length, 2);
    picker.badges.children[0].fire('click');
    assert.equal(picker.entries[1].input.checked, false);
    assert.equal(picker.badges.children.length, 1);
    assert.equal(picker.badges.children[0].focused, true);
    picker.details.open = true;
    let stopped = false;
    picker.details.fire('keydown', { key: 'Escape', preventDefault() {}, stopPropagation() { stopped = true; } });
    assert.equal(picker.details.open, false);
    assert.equal(stopped, true);
    assert.equal(picker.details.querySelector('summary').focused, true);
});
