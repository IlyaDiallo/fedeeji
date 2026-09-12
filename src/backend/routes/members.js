const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { stripSecrets, profileData } = require('../services/memberSecurity');
const { createAuthRateLimit } = require('../middleware/authRateLimit');

function createMembersRouter({ dataService }) {
    const router = express.Router({ mergeParams: true });
    const limit = createAuthRateLimit()({ name: 'member-edit', ip: 50, windowMs: 3600000 });
    const params = req => ({ collectiveId: req.collectiveId, collection: 'members' });
    const view = (req, member) => dataService.authService
        ? dataService.authService.memberView(req.collectiveId, member) : stripSecrets(member);
    router.get('/me', requireRole('member', 'admin'), asyncHandler(async (req, res) => {
        if (!req.user.memberId) return res.status(404).json({ error: 'Non trouvé' });
        const member = await dataService.get({ ...params(req), id: req.user.memberId });
        if (!member) return res.status(404).json({ error: 'Non trouvé' });
        res.json(await view(req, member));
    }));
    router.put('/me', requireRole('member', 'admin'), limit, asyncHandler(async (req, res) => {
        if (!req.user.memberId) return res.status(404).json({ error: 'Non trouvé' });
        const data = { ...profileData(req.body) };
        for (const key of ['email', 'currentPassword', 'lang']) if (Object.hasOwn(req.body, key)) data[key] = req.body[key];
        res.json(await dataService.update({ ...params(req), id: req.user.memberId, data, actor: req.user }));
    }));
    router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
        const members = await dataService.list(params(req));
        res.json(await Promise.all(members.map(member => view(req, member))));
    }));
    router.get('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
        const member = await dataService.get({ ...params(req), id: req.params.id });
        if (!member) return res.status(404).json({ error: 'Non trouvé' });
        res.json(await view(req, member));
    }));
    router.post('/', requireRole('admin'), limit, asyncHandler(async (req, res) => {
        const member = await dataService.create({ ...params(req), data: req.body });
        res.status(201).json(stripSecrets(member));
    }));
    router.put('/:id', requireRole('admin'), limit, asyncHandler(async (req, res) => {
        res.json(await dataService.update({ ...params(req), id: req.params.id, data: req.body, actor: req.user }));
    }));
    router.post('/:id/invite', requireRole('admin'), limit, asyncHandler(async (req, res) => {
        const member = await dataService.get({ ...params(req), id: req.params.id });
        if (!member) return res.status(404).json({ error: 'Non trouvé' });
        await dataService.authService.requestPassword({ collectiveId: req.collectiveId, email: member.email, lang: req.body?.lang });
        res.json({ success: true });
    }));
    router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
        await dataService.delete({ ...params(req), id: req.params.id });
        res.json({ success: true });
    }));
    // Never let an unhandled /members path fall through to generic CRUD.
    router.use((req, res) => res.status(404).json({ error: 'Non trouvé' }));
    return router;
}
module.exports = createMembersRouter;
