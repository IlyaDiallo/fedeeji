const https = require('https');
const http = require('http');

class NotificationService {
    static async send({ webhookUrl, payload, settings }) {
        let url;
        try { url = new URL(webhookUrl); } catch { throw new Error('URL HA invalide'); }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash
            || !settings?.allowedOrigins?.includes(url.origin)) {
            throw new Error('Origine HA non autorisée');
        }
        const body = JSON.stringify(payload);
        const options = {
            hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            rejectUnauthorized: !settings.insecureTlsOrigins?.includes(url.origin)
        };
        return new Promise((resolve, reject) => {
            let timer;
            const req = (url.protocol === 'https:' ? https : http).request(options, res => {
                let size = 0;
                res.on('data', chunk => {
                    size += chunk.length;
                    if (size > 65536) req.destroy(new Error('Réponse HA trop volumineuse'));
                });
                res.on('error', reject);
                res.on('end', () => {
                    clearTimeout(timer);
                    if (res.statusCode >= 200 && res.statusCode < 300) resolve({ statusCode: res.statusCode });
                    else reject(new Error(`Webhook HA : HTTP ${res.statusCode}`));
                });
            });
            req.on('error', error => { clearTimeout(timer); reject(error); });
            timer = setTimeout(() => req.destroy(new Error('Timeout HA (10 s)')), 10000);
            req.end(body);
        });
    }
}
module.exports = NotificationService;
