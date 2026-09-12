const SUCCESS = { success: true };

/** Bounded mono-process limiter. Forwarded headers only work with explicit Express trust proxy. */
function createAuthRateLimit({ now = () => Date.now(), maxEntries = 10000 } = {}) {
    const buckets = new Map();
    function take(key, limit, windowMs) {
        const time = now();
        for (const [k, bucket] of buckets) if (bucket.until <= time) buckets.delete(k);
        let bucket = buckets.get(key);
        if (!bucket) {
            if (buckets.size >= maxEntries) return false;
            bucket = { count: 0, until: time + windowMs };
            buckets.set(key, bucket);
        }
        return ++bucket.count <= limit;
    }
    return function limit({ name, ip, email, windowMs, neutral = false }) {
        return (req, res, next) => {
            res.set('Cache-Control', 'no-store');
            if (!take(`${name}:ip:${req.ip}`, ip, windowMs)) {
                res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
                return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
            }
            const address = req.body?.email || req.body?.memberData?.email;
            if (email && typeof address === 'string' && address.length <= 254) {
                const key = `${name}:email:${String(req.body.collectiveId).slice(0, 100)}:${address.trim().toLowerCase()}`;
                if (!take(key, email, windowMs)) {
                    return neutral ? res.json(SUCCESS) : res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
                }
            }
            next();
        };
    };
}
module.exports = { createAuthRateLimit };
