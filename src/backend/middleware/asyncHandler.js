/**
 * Wrapper pour les handlers async Express.
 * Capture automatiquement les erreurs et les transmet à next().
 * @param {Function} fn - Handler async (req, res, next)
 * @param {number} [errorStatus=400] - Code HTTP par défaut en cas d'erreur
 */
function asyncHandler(fn, errorStatus = 400) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(err => {
            res.status(errorStatus).json({ error: err.message });
        });
    };
}

module.exports = asyncHandler;
