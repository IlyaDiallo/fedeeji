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
const OrganizationService = require('./services/OrganizationService');
const ImportService = require('./services/ImportService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
const organizationService = new OrganizationService();
const importService = new ImportService({ dataService });

const authMiddleware = createAuthMiddleware(authService);

// API routes
const authRouter = createAuthRouter({
    authService, organizationService, dataService
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

app.post('/api/:orgId/import-subscriptions',
    authMiddleware,
    requireRole('admin'),
    (req, res, next) => {
        req.organisationId = req.params.orgId;
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
                .importSubscriptions({
                    organisationId: req.organisationId,
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

app.use('/api/:orgId', authMiddleware, apiRouter);

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
