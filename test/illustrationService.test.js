const test = require('node:test');
const assert = require('node:assert/strict');
const IllustrationService = require(
    '../src/backend/services/IllustrationService'
);

function service() {
    return new IllustrationService();
}

test('search ranks French and English task synonyms', () => {
    const illustrations = service();
    assert.equal(
        illustrations.search({ query: 'lessive', lang: 'fr' })[0].name,
        'wash'
    );
    assert.equal(
        illustrations.search({ query: 'aspirateur', lang: 'fr' })[0].name,
        'vacuum-cleaner'
    );
    assert.equal(
        illustrations.search({ query: 'delivery', lang: 'en' })[0].name,
        'truck-delivery'
    );
    assert.equal(
        illustrations.search({ query: 'réception', lang: 'fr' })[0].name,
        'package-import'
    );
});

test('search ignores accents and returns a local featured library', () => {
    const illustrations = service();
    const accented = illustrations.search({ query: 'événement' });
    const plain = illustrations.search({ query: 'evenement' });
    assert.deepEqual(
        accented.map(item => item.name),
        plain.map(item => item.name)
    );
    assert.ok(illustrations.search().length >= 12);
});

test('bathroom vocabulary finds relevant illustrations in French and English', () => {
    const illustrations = service();
    const cases = {
        'salle de bains': 'bath', 'salle de bain': 'bath', bathroom: 'bath',
        lavabo: 'feddeeji-sink', lavabos: 'feddeeji-sink',
        'évier': 'feddeeji-sink', sink: 'feddeeji-sink',
        robinet: 'feddeeji-faucet', robinets: 'feddeeji-faucet',
        faucet: 'feddeeji-faucet', tap: 'feddeeji-faucet',
        douche: 'feddeeji-shower', shower: 'feddeeji-shower',
        'le robinet': 'feddeeji-faucet'
    };
    for (const [query, expected] of Object.entries(cases)) {
        assert.equal(illustrations.search({ query })[0]?.name, expected, query);
    }
    assert.equal(illustrations.search({ query: 'lavabo' })[0].label, 'Lavabo / évier');
    assert.ok(!illustrations.search({ query: 'salle de bains' })
        .some(item => item.name === 'code'));
});

test('search ignores stop words and matches synonyms only at word boundaries', () => {
    const illustrations = service();
    assert.deepEqual(illustrations._expandedTerms('de la'), []);
    assert.deepEqual(illustrations.search({ query: 'de la' }), []);
    assert.ok(!illustrations._expandedTerms('cadeau').includes('droplet'));
    assert.ok(!illustrations._expandedTerms('stockholm').includes('packages'));
    assert.ok(illustrations._expandedTerms('les robinets').includes('feddeeji-faucet'));
});

test('local supplementary drawings support persisted recipes and safe rendering', () => {
    const illustrations = service();
    for (const name of ['feddeeji-sink', 'feddeeji-faucet', 'feddeeji-shower', 'feddeeji-roof']) {
        const recipe = { collection: 'tabler', name, style: 'doodle-v1', seed: 42 };
        assert.deepEqual(illustrations.normalizeRecipe(recipe), recipe);
        const output = illustrations.render({ recipe });
        assert.match(output.svg, /stroke="currentColor"/);
        assert.doesNotMatch(output.svg, /<(script|image|use|foreignObject)\b/i);
        assert.deepEqual(service().render({ recipe }), output);
    }
});

test('common French household words and plurals find the expected drawings', () => {
    const illustrations = service();
    const cases = [
        [['lit', 'lits', 'faire le lit'], 'bed', 'Lit'],
        [['toit', 'toits', 'toiture', 'toitures'], 'feddeeji-roof', 'Toit'],
        [['camion', 'camions'], 'truck', 'Camion'],
        [['maison', 'maisons'], 'home', 'Maison'],
        [['porte', 'portes'], 'door', 'Porte'],
        [['canapé', 'canapés'], 'sofa', 'Canapé'],
        [['fauteuil', 'fauteuils'], 'armchair', 'Fauteuil'],
        [['lampe', 'lampes'], 'lamp', 'Lampe'],
        [['escalier', 'escaliers'], 'stairs', 'Escalier'],
        [['aspirateur', 'aspirateurs'], 'vacuum-cleaner', 'Aspirateur']
    ];
    for (const [queries, name, label] of cases) {
        for (const query of queries) {
            const first = illustrations.search({ query })[0];
            assert.equal(first?.name, name, query);
            assert.equal(first.label, label, query);
        }
    }
    assert.ok(!illustrations._expandedTerms('qualité').includes('bed'));
    assert.ok(!illustrations._expandedTerms('étoile').includes('feddeeji-roof'));
});

test('recipe validation applies a deterministic fallback', () => {
    const illustrations = service();
    const first = illustrations.normalizeRecipe(null, {
        fallbackSource: 'Lessive'
    });
    const second = illustrations.normalizeRecipe(null, {
        fallbackSource: 'Lessive'
    });
    assert.deepEqual(first, second);
    assert.equal(first.name, 'clipboard-check');

    assert.throws(
        () => illustrations.normalizeRecipe({
            collection: 'tabler', name: '../wash',
            style: 'doodle-v1', seed: 1
        }),
        /Illustration inconnue/
    );
    assert.throws(
        () => illustrations.normalizeRecipe({
            collection: 'tabler', name: 'wash',
            style: 'other', seed: 1
        }),
        /Style d’illustration inconnu/
    );
    assert.throws(
        () => illustrations.normalizeRecipe({
            collection: 'tabler', name: 'wash',
            style: 'doodle-v1', seed: -1
        }),
        /Graine d’illustration invalide/
    );
});

test('doodle-v1 SVG rendering is deterministic and supports compact mode', () => {
    const illustrations = service();
    const recipe = {
        collection: 'tabler', name: 'wash',
        style: 'doodle-v1', seed: 18427
    };
    const params = {
        recipe, primaryColor: '#5b55e7', secondaryColor: '#08a88a'
    };
    const first = illustrations.render(params);
    const second = illustrations.render(params);
    const changedSeed = illustrations.render({
        ...params, recipe: { ...recipe, seed: 18428 }
    });
    const compact = illustrations.render({ ...params, compact: true });

    assert.deepEqual(first, second);
    assert.notEqual(first.svg, changedSeed.svg);
    assert.notEqual(first.svg, compact.svg);
    assert.match(first.etag, /^"[a-f0-9]{24}"$/);
    assert.match(first.svg, /viewBox="0 0 512 512"/);
    assert.match(first.svg, /#5b55e7/);
    assert.match(first.svg, /#08a88a/);
});

test('generated SVG contains no active or external content', () => {
    const illustrations = service();
    const output = illustrations.render({
        recipe: {
            collection: 'tabler', name: 'clipboard-check',
            style: 'doodle-v1', seed: 1
        }
    }).svg;
    assert.doesNotMatch(output, /<(script|image|foreignObject|iframe|a)\b/i);
    const withoutNamespace = output.replace(
        'xmlns="http://www.w3.org/2000/svg"', ''
    );
    assert.doesNotMatch(withoutNamespace, /https?:|data:|javascript:/i);
    assert.doesNotMatch(output, /\son\w+=/i);

    illustrations.icons.hostile = {
        body: '<script>alert(1)</script>'
    };
    assert.throws(
        () => illustrations.render({
            recipe: {
                collection: 'tabler', name: 'hostile',
                style: 'doodle-v1', seed: 1
            }
        }),
        /Contenu SVG/
    );
});
