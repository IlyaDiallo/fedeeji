/**
 * Middleware d'authentification JWT
 * @param {import('../services/AuthService')} authService
 */
function createAuthMiddleware(authService) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Token manquant'
            });
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = authService.verifyToken(token);
            req.user = decoded;
            next();
        } catch (error) {
            return res.status(401).json({
                error: 'Token invalide'
            });
        }
    };
}

/**
 * Middleware de vérification de rôle
 * @param  {...string} roles - Rôles autorisés
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Non authentifié'
            });
        }

        // Superadmin a accès à tout
        if (req.user.role === 'superadmin') {
            return next();
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Accès interdit'
            });
        }

        // Vérifier que l'admin/membre accède à sa propre org
        const orgId = req.params.orgId || req.organisationId;
        if (
            (req.user.role === 'admin'
                || req.user.role === 'member')
            && req.user.orgId !== orgId
        ) {
            return res.status(403).json({
                error: 'Accès interdit à cette organisation'
            });
        }

        next();
    };
}

module.exports = { createAuthMiddleware, requireRole };
