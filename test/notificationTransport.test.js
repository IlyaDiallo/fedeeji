const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const NotificationService = require('../src/backend/services/NotificationService');

test('transport validates origins, sends JSON and refuses redirects/oversized responses', async () => {
    const received = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            received.push({ path: req.url, method: req.method, body });
            if (req.url === '/redirect') { res.writeHead(302, { location: '/target' }); res.end('secret body'); }
            else if (req.url === '/large') res.end('x'.repeat(70000));
            else res.end('ok');
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const settings = { allowedOrigins: [origin], insecureTlsOrigins: [] };
    const send = (path, custom = settings) => NotificationService.send({ webhookUrl: origin + path, payload: { type: 'test' }, settings: custom });
    try {
        assert.equal((await send('/ok')).statusCode, 200);
        assert.equal(received[0].method, 'POST');
        assert.deepEqual(JSON.parse(received[0].body), { type: 'test' });
        await assert.rejects(send('/ok', { allowedOrigins: [] }), /non autorisée/);
        await assert.rejects(send('/redirect'), error => error.message.includes('302') && !error.message.includes('secret'));
        assert.equal(received.some(r => r.path === '/target'), false);
        await assert.rejects(send('/large'), /volumineuse/);
        await assert.rejects(NotificationService.send({ webhookUrl: 'file:///etc/passwd', settings, payload: {} }));
        await assert.rejects(NotificationService.send({ webhookUrl: origin.replace('http://', 'http://user:pass@'), settings, payload: {} }));
    } finally { await new Promise(resolve => server.close(resolve)); }
});
