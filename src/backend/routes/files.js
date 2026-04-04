const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createAuthMiddleware, requireRole } = require('../middleware/auth');

/**
 * @param {Object} params
 * @param {import('../services/AuthService')} params.authService
 * @param {string} params.uploadsDir
 */
function createFilesRouter({ authService, uploadsDir }) {
    const router = express.Router();
    const authMiddleware = createAuthMiddleware(authService);

    // Créer le dossier uploads si nécessaire
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileUpload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, uploadsDir),
            filename: (req, file, cb) => {
                const uniqueSuffix =
                    `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
                const safeName = file.originalname
                    .replace(/[^a-zA-Z0-9._-]/g, '_');
                cb(null, `${uniqueSuffix}-${safeName}`);
            }
        }),
        limits: { fileSize: 3 * 1024 * 1024 },
        fileFilter: (req, file, cb) => cb(null, true)
    });

    router.post('/',
        authMiddleware,
        requireRole('superadmin'),
        fileUpload.single('file'),
        (req, res) => {
            if (!req.file) {
                return res.status(400).json({
                    error: 'Aucun fichier fourni'
                });
            }
            res.status(201).json({
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                path: `/api/files/${req.file.filename}`
            });
        }
    );

    router.get('/',
        authMiddleware,
        requireRole('superadmin'),
        (req, res) => {
            try {
                const files = fs.readdirSync(uploadsDir)
                    .filter(f => f !== '.gitkeep')
                    .map(filename => {
                        const filePath = path.join(uploadsDir, filename);
                        const stats = fs.statSync(filePath);
                        return {
                            filename,
                            size: stats.size,
                            modified: stats.mtime.toISOString()
                        };
                    });
                res.json(files);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    router.get('/:filename',
        authMiddleware,
        requireRole('superadmin'),
        (req, res) => {
            const filename = path.basename(req.params.filename);
            const filePath = path.join(uploadsDir, filename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'Fichier non trouvé'
                });
            }
            res.download(filePath, filename);
        }
    );

    router.delete('/:filename',
        authMiddleware,
        requireRole('superadmin'),
        (req, res) => {
            const filename = path.basename(req.params.filename);
            const filePath = path.join(uploadsDir, filename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'Fichier non trouvé'
                });
            }
            try {
                fs.unlinkSync(filePath);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({
                    error: 'Erreur lors de la suppression'
                });
            }
        }
    );

    return router;
}

module.exports = createFilesRouter;
