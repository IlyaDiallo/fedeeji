const test = require('node:test');
const assert = require('node:assert/strict');
const CollectiveService = require(
    '../src/backend/services/CollectiveService'
);

const service = new CollectiveService();

test('default collective palette matches the Feddeeji identity', () => {
    assert.deepEqual(service.resolveTheme(), {
        primaryColor: '#5b55e7',
        secondaryColor: '#08a88a',
        primaryDark: '#443dcc',
        onPrimaryColor: '#ffffff'
    });
});

test('secondary and contrast colors are derived from primary', () => {
    const light = service.resolveTheme('#f4d35e');
    const dark = service.resolveTheme('#14213d');
    assert.match(light.secondaryColor, /^#[0-9a-f]{6}$/);
    assert.notEqual(light.secondaryColor, light.primaryColor);
    assert.equal(light.onPrimaryColor, '#17253f');
    assert.equal(dark.onPrimaryColor, '#ffffff');
    assert.notEqual(dark.primaryDark, dark.primaryColor);
});

test('collective palette rejects ambiguous and unsafe color values', () => {
    for (const color of [
        '#fff', 'red', '123456', '#12345g',
        'var(--color)', 'url(javascript:alert(1))'
    ]) {
        assert.throws(
            () => service.resolveTheme(color),
            /format #RRGGBB/
        );
    }
});

test('collective identity uses a concrete, validated type label', () => {
    assert.equal(service._normalizeTypeLabel('  association  '), 'association');
    assert.equal(service._normalizeTypeLabel('', 'fr'), 'groupe');
    assert.equal(service._normalizeTypeLabel('', 'en'), 'group');
    assert.throws(
        () => service._normalizeTypeLabel('<script>alert(1)</script>'),
        /libellé simple/
    );
});

test('collective logos use validated local illustration recipes', () => {
    const recipe = service._defaultLogoRecipe({
        id: 'demo', typeLabel: 'club sportif'
    });
    assert.equal(recipe.collection, 'tabler');
    assert.equal(recipe.name, 'ball-football');
    assert.equal(recipe.style, 'doodle-v1');
    assert.throws(
        () => service._normalizeLogoIllustration({
            collection: 'tabler', name: '../logo',
            style: 'doodle-v1', seed: 1
        }, { id: 'demo', typeLabel: 'club' }),
        /Illustration inconnue/
    );
});
