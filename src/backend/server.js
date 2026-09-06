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
const AssetService = require('./services/AssetService');
const IllustrationService = require('./services/IllustrationService');
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
const illustrationService = new IllustrationService();
const collectiveService = new CollectiveService({ illustrationService });
const importService = new ImportService({ dataService });
const assetService = new AssetService({
    basePath: path.join(__dirname, '../../data')
});

const scheduler = new ActionNotificationScheduler({
    collectiveService, dataService
});

const authMiddleware = createAuthMiddleware(authService);

// --- Routes d'authentification ---

const authRouter = createAuthRouter({
    authService, collectiveService, dataService, illustrationService
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

const activityImageTypes = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/gif', 'gif']
]);
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
            const extension = activityImageTypes.get(file.mimetype);
            cb(null, `${uniqueSuffix}.${extension}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (activityImageTypes.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(
                'Formats acceptés : JPEG, PNG, WebP ou GIF'
            ));
        }
    }
});

app.post('/api/:collectiveId/activity-images',
    authMiddleware,
    requireRole('admin'),
    (req, res, next) => {
        if (!/^[a-zA-Z0-9_-]+$/.test(req.params.collectiveId)) {
            return res.status(400).json({
                error: 'Identifiant de collectif invalide'
            });
        }
        next();
    },
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
    if (!/^[a-zA-Z0-9_-]+$/.test(req.params.collectiveId)) {
        return res.status(404).json({ error: 'Image non trouvée' });
    }
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

// Aperçu générique des illustrations, notamment avant la création d'un espace.
app.get('/api/illustrations/:filename', (req, res) => {
    try {
        const match = req.params.filename.match(/^([a-z0-9-]+)\.svg$/);
        if (!match) return res.status(404).end();
        if (req.query.variant && req.query.variant !== 'compact') {
            return res.status(400).json({
                error: 'Variante d’illustration inconnue'
            });
        }
        const theme = collectiveService.resolveTheme(req.query.color);
        const seed = req.query.seed === undefined
            ? illustrationService.seedFrom(match[1])
            : Number(req.query.seed);
        const recipe = illustrationService.normalizeRecipe({
            collection: 'tabler',
            name: match[1],
            style: req.query.style || 'doodle-v1',
            seed
        });
        const result = illustrationService.render({
            recipe,
            primaryColor: theme.onPrimaryColor === '#17253f'
                ? theme.primaryDark : theme.primaryColor,
            secondaryColor: theme.secondaryColor,
            compact: req.query.variant === 'compact'
        });
        if (req.headers['if-none-match'] === result.etag) {
            return res.status(304).end();
        }
        res.set({
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'ETag': result.etag,
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; style-src 'none'; sandbox"
        });
        res.send(result.svg);
    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
});

// Illustrations locales : rendu SVG public, borné au catalogue embarqué.
app.get('/api/:collectiveId/illustrations/:filename', async (req, res) => {
    try {
        if (!/^[a-z0-9-]+$/.test(req.params.collectiveId)) {
            return res.status(404).end();
        }
        const match = req.params.filename.match(/^([a-z0-9-]+)\.svg$/);
        if (!match) return res.status(404).end();
        const org = await collectiveService.getById(req.params.collectiveId);
        if (!org) return res.status(404).end();
        if (req.query.variant && req.query.variant !== 'compact') {
            return res.status(400).json({
                error: 'Variante d’illustration inconnue'
            });
        }

        const seed = req.query.seed === undefined
            ? illustrationService.seedFrom(match[1])
            : Number(req.query.seed);
        const recipe = illustrationService.normalizeRecipe({
            collection: 'tabler',
            name: match[1],
            style: req.query.style || 'doodle-v1',
            seed
        });
        const result = illustrationService.render({
            recipe,
            primaryColor: org.onPrimaryColor === '#17253f'
                ? org.primaryDark : org.primaryColor,
            secondaryColor: org.secondaryColor,
            compact: req.query.variant === 'compact'
        });

        if (req.headers['if-none-match'] === result.etag) {
            return res.status(304).end();
        }
        res.set({
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'ETag': result.etag,
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; style-src 'none'; sandbox"
        });
        res.send(result.svg);
    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
});

// Route publique : version de l'application
const { version } = require('../../package.json');
app.get('/api/version', (req, res) => {
    res.json({ version });
});

// --- Routeur API principal ---

const apiRouter = createApiRouter({
    dataService, trashService, scheduler, assetService,
    illustrationService
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
