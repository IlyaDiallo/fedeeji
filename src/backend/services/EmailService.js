const nodemailer = require('nodemailer');
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

class EmailService {
    constructor({ transport, publicUrl, from, env = process.env } = {}) {
        this.publicUrl = publicUrl || env.PUBLIC_APP_URL;
        this.from = from || env.SMTP_FROM;
        this.transport = transport;
        if (!transport && env.SMTP_HOST) {
            const secure = env.SMTP_SECURE === 'true';
            this.transport = nodemailer.createTransport({
                host: env.SMTP_HOST, port: Number(env.SMTP_PORT || (secure ? 465 : 587)), secure,
                requireTLS: !secure, tls: { rejectUnauthorized: true },
                auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
                connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
            });
        }
        if (this.publicUrl) {
            const url = new URL(this.publicUrl);
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
                || url.search || url.hash || url.pathname !== '/') throw new Error('PUBLIC_APP_URL doit être une origine HTTP(S)');
            if (env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('HTTPS requis en production');
            this.publicUrl = url.origin;
        }
        if (env.NODE_ENV === 'production' && !this.ready) throw new Error('Configuration SMTP et PUBLIC_APP_URL requise');
    }
    get ready() { return !!(this.transport && this.publicUrl && this.from); }
    async sendLink({ to, collectiveId, token, purpose, lang = 'fr' }) {
        if (!this.ready) throw new Error('Envoi email non configuré');
        const en = lang === 'en';
        const subject = purpose === 'email'
            ? (en ? 'Confirm your email address' : 'Confirmer votre adresse email')
            : (en ? 'Set your password' : 'Définir votre mot de passe');
        const url = `${this.publicUrl}/${encodeURIComponent(collectiveId)}/auth-link#`
            + new URLSearchParams({ purpose, token });
        const text = en
            ? `${subject}\n\n${url}\n\nThis link expires in 30 minutes and can only be used once. If you did not request it, ignore this email.`
            : `${subject}\n\n${url}\n\nCe lien expire dans 30 minutes et ne peut être utilisé qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;
        return this.transport.sendMail({ from: this.from, to: { address: to, name: '' }, subject,
            text, html: `<p>${escape(subject)}</p><p><a href="${escape(url)}">${escape(subject)}</a></p><p>${escape(text.split('\n\n').at(-1))}</p>` });
    }
    async sendNotice({ to, lang = 'fr' }) {
        if (!this.ready) throw new Error('Envoi email non configuré');
        const text = lang === 'en'
            ? 'An email address change was requested for your Feddeeji account. If this was not you, contact your administrator.'
            : "Un changement d'adresse email a été demandé pour votre compte Feddeeji. Si vous n'êtes pas à l'origine de cette demande, contactez votre administrateur.";
        return this.transport.sendMail({ from: this.from, to: { address: to, name: '' }, subject: 'Feddeeji — email', text });
    }
}
module.exports = EmailService;
