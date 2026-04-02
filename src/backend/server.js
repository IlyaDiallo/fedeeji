const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const createApiRouter = require('./routes/api');
const createAuthRouter = require('./routes/auth');
const {
    createAuthMiddleware
} = require('./middleware/auth');
const FileSystemAdapter = require('./storage/FileSystemAdapter');
const TrashService = require('./services/TrashService');
const DataService = require('./services/DataService');
const LogService = require('./services/LogService');
const AuthService = require('./services/AuthService');
const CollectiveService = require('./services/CollectiveService');
const ImportService = require('./services/ImportService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir les logos des collectifs
app.use('/api/logos', express.static(
    path.join(__dirname, '../../data/logos')
));

// Servir le frontend statique
app.use(express.static(
    path.join(__dirname, '../frontend')
));

// Initialisation des services
const storage = new FileSystemAdapter({
    basePath: path.join(__dirname, '../../data')
});
const trashService = new TrashService({ storage });
const logService = new LogService({ storage });
const dataService = new DataService({
    storage, trashService, logService
});
const authService = new AuthService({ storage });
const collectiveService = new CollectiveService();
const importService = new ImportService({ dataService });

const authMiddleware = createAuthMiddleware(authService);

// API routes
const authRouter = createAuthRouter({
    authService, collectiveService, dataService
});
app.use('/auth', authRouter);

const apiRouter = createApiRouter({
    dataService, trashService, importService
});

// Route d'import XLSX (avant le routeur générique pour éviter les conflits)
const multer = require('multer');
const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = (file.originalname || '')
            .split('.').pop().toLowerCase();
        if (ext === 'xlsx' || ext === 'xls') {
            cb(null, true);
        } else {
            cb(new Error(
                'Format non supporté. Utilisez .xlsx'
            ));
        }
    }
});

const { requireRole } = require('./middleware/auth');

// ============================================================
// Upload de fichiers (superadmin uniquement)
// Stockage dans /data/uploads
// ============================================================
const fs = require('fs');
const uploadsDir = path.join(__dirname, '../../data/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const fileUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(
                Math.random() * 1E9
            )}`;
            const safeName = file.originalname.replace(
                /[^a-zA-Z0-9._-]/g, '_'
            );
            cb(null, `${uniqueSuffix}-${safeName}`);
        }
    }),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});

app.post('/api/files',
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

app.get('/api/files',
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

app.get('/api/files/:filename',
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

app.delete('/api/files/:filename',
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

app.post('/api/:collectiveId/import-contributions',
    authMiddleware,
    requireRole('admin'),
    (req, res, next) => {
        req.collectiveId = req.params.collectiveId;
        next();
    },
    importUpload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: 'Aucun fichier fourni'
                });
            }
            const results = await importService
                .importContributions({
                    collectiveId: req.collectiveId,
                    fileBuffer: req.file.buffer
                });
            res.json(results);
        } catch (error) {
            res.status(400).json({
                error: error.message
            });
        }
    }
);

// Route publique : version de l'application
const { version } = require('../../package.json');
app.get('/api/version', (req, res) => {
    res.json({ version });
});

app.use('/api/:collectiveId', authMiddleware, apiRouter);

// Rediriger toutes les autres requêtes vers index.html
app.use((req, res) => {
    res.sendFile(
        path.join(__dirname, '../frontend/index.html')
    );
});

const server = app.listen(PORT, () => {
    console.log(
        `Serveur démarré sur http://localhost:${PORT}`
    );
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(
            `❌ Le port ${PORT} est déjà utilisé.`
            + ' Arrêtez le processus existant.'
        );
    } else {
        console.error('Erreur serveur :', err);
    }
    process.exit(1);
});
