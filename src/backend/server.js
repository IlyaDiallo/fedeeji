const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
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
