const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const readline = require('node:readline');
const nodemailer = require('nodemailer');
const EmailService = require('../src/backend/services/EmailService');

test('Nodemailer delivers a MIME message to an isolated local SMTP capture', async () => {
    const envelopes = [];
    const messages = [];
    const sockets = new Set();
    const server = net.createServer(socket => {
        sockets.add(socket); socket.on('close', () => sockets.delete(socket));
        socket.write('220 local.test ESMTP\r\n');
        let data = null;
        const lines = readline.createInterface({ input: socket, crlfDelay: Infinity });
        lines.on('line', line => {
            if (data) {
                if (line === '.') { messages.push(data.join('\r\n')); data = null; socket.write('250 queued\r\n'); }
                else data.push(line);
            } else if (/^EHLO|^HELO/.test(line)) socket.write('250 local.test\r\n');
            else if (/^MAIL FROM:|^RCPT TO:/.test(line)) { envelopes.push(line); socket.write('250 OK\r\n'); }
            else if (line === 'DATA') { data = []; socket.write('354 End with dot\r\n'); }
            else if (line === 'QUIT') socket.end('221 Bye\r\n');
            else socket.write('250 OK\r\n');
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        // Cleartext is deliberately limited to this test-only injected loopback transport.
        const transport = nodemailer.createTransport({ host: '127.0.0.1', port: server.address().port,
            secure: false, ignoreTLS: true, connectionTimeout: 2000, socketTimeout: 2000 });
        const service = new EmailService({ transport, publicUrl: 'https://app.example.org', from: 'noreply@example.org', env: {} });
        await service.sendLink({ collectiveId: 'demo', to: 'member@example.org', purpose: 'password', token: 'a'.repeat(43), lang: 'en' });
        assert.ok(envelopes.includes('RCPT TO:<member@example.org>'));
        assert.equal(messages.length, 1);
        assert.match(messages[0], /Subject: Set your password/);
        assert.match(messages[0], /\/demo\/auth-link/);
        assert.match(messages[0], /multipart\/alternative/);
        transport.close();
    } finally {
        for (const socket of sockets) socket.destroy();
        await new Promise(resolve => server.close(resolve));
    }
});
