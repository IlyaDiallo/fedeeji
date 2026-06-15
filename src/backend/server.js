const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const createApiRouter = require('./routes/api');
const createAuthRouter = require('./routes/auth');
const createFilesRouter = require('./routes/files');
const { createAuthMiddleware, requireRole } = require('./middleware/auth');

const FileSystemAdapter = require('./storage/FileSystemAdapter');
const TrashService = require('./services/TrashService');
const DataService = require('./services/DataService');
const LogService = require('./services/LogService');
const AuthService = require('./services/AuthService');
const CollectiveService = require('./services/CollectiveService');
const ImportService = require('./services/ImportService');
const ActionNotificationScheduler = require('./services/ActionNotificationScheduler');

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

// --- Initialisation des services ---

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

const scheduler = new ActionNotificationScheduler({
    collectiveService, dataService
});

const authMiddleware = createAuthMiddleware(authService);

// --- Routes d'authentification ---

const authRouter = createAuthRouter({
    authService, collectiveService, dataService
});
app.use('/auth', authRouter);

// --- Upload de fichiers (superadmin) ---

const uploadsDir = path.join(__dirname, '../../data/uploads');
const filesRouter = createFilesRouter({
    authService, uploadsDir
});
app.use('/api/files', filesRouter);

// --- Import XLSX (admin, avant le routeur générique) ---

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
            res.status(400).json({ error: error.message });
        }
    }
);

// --- Images d'activités (upload admin, service public) ---

const activityImageUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(
                __dirname, '../../data',
                req.params.collectiveId, 'uploads'
            );
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix =
                `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
            const safeName = (file.originalname || 'image')
                .replace(/[^a-zA-Z0-9._-]/g, '_');
            cb(null, `${uniqueSuffix}-${safeName}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if ((file.mimetype || '').startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées'));
        }
    }
});

app.post('/api/:collectiveId/activity-images',
    authMiddleware,
    requireRole('admin'),
    activityImageUpload.single('file'),
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                error: 'Aucun fichier fourni'
            });
        }
        res.status(201).json({
            filename: req.file.filename,
            path: `/api/${req.params.collectiveId}`
                + `/activity-images/${req.file.filename}`
        });
    }
);

// Service public des images (utilisé dans les balises <img>)
app.get('/api/:collectiveId/activity-images/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(
        __dirname, '../../data',
        req.params.collectiveId, 'uploads', filename
    );
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Image non trouvée' });
    }
    res.sendFile(filePath);
});

// Route publique : version de l'application
const { version } = require('../../package.json');
app.get('/api/version', (req, res) => {
    res.json({ version });
});

// --- Routeur API principal ---

const apiRouter = createApiRouter({ dataService, trashService, scheduler });
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
    scheduler.start();
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
