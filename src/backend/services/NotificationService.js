const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Service d'envoi de notifications via un webhook HTTP (Home Assistant Companion App).
 */
class NotificationService {
    /**
     * Envoie un payload JSON vers une URL de webhook.
     * Supporte HTTP et HTTPS, y compris les certificats auto-signés (courant pour HA).
     * @param {Object} params
     * @param {string} params.webhookUrl - URL complète du webhook HA
     * @param {Object} params.payload    - Corps JSON à envoyer
     * @returns {Promise<{ statusCode: number, data: string }>}
     */
    static async send({ webhookUrl, payload }) {
        const url = new URL(webhookUrl);
        const body = JSON.stringify(payload);

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            // Certificats auto-signés tolérés (HA local sans CA officielle)
            rejectUnauthorized: false
        };

        const protocol = url.protocol === 'https:' ? https : http;

        return new Promise((resolve, reject) => {
            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ statusCode: res.statusCode, data });
                    } else {
                        reject(new Error(
                            `Webhook HA : HTTP ${res.statusCode} — ${data}`
                        ));
                    }
                });
            });

            req.on('error', reject);

            req.setTimeout(10000, () => {
                req.destroy(new Error('Timeout webhook HA (10 s)'));
            });

            req.write(body);
            req.end();
        });
    }
}

module.exports = NotificationService;
