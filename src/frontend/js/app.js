const pathToRegex = path => new RegExp(
    "^" + path.replace(/\//g, "\\/")
        .replace(/:\w+/g, "([^\\/]+)") + "$"
);

const getParams = match => {
    const values = match.result.slice(1);
    const keys = Array.from(
        match.route.path.matchAll(/:(\w+)/g)
    ).map(result => result[1]);

    return Object.fromEntries(keys.map((key, i) => {
        return [key, values[i]];
    }));
};

const navigateTo = url => {
    history.pushState(null, null, url);
    router();
};

let currentOrgId = null;
let currentOrgName = null;
let currentOrgLabel = null;
let currentOrgTypeLabel = null;
let currentOrgLogo = null;
let currentOrgContributionsEnabled = true;
let currentOrgTheme = {
    primaryColor: '#5b55e7',
    secondaryColor: '#08a88a',
    primaryDark: '#443dcc',
    onPrimaryColor: '#ffffff'
};

const applyCollectiveTheme = (theme = {}) => {
    currentOrgTheme = {
        primaryColor: theme.primaryColor || '#5b55e7',
        secondaryColor: theme.secondaryColor || '#08a88a',
        primaryDark: theme.primaryDark || '#443dcc',
        onPrimaryColor: theme.onPrimaryColor || '#ffffff'
    };
    const root = document.documentElement;
    const hexToRgb = hex => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
    ].join(', ');
    root.style.setProperty('--fd-primary', currentOrgTheme.primaryColor);
    root.style.setProperty('--fd-primary-dark', currentOrgTheme.primaryDark);
    root.style.setProperty('--fd-secondary', currentOrgTheme.secondaryColor);
    root.style.setProperty('--fd-on-primary', currentOrgTheme.onPrimaryColor);
    root.style.setProperty(
        '--fd-primary-rgb', hexToRgb(currentOrgTheme.primaryColor)
    );
    root.style.setProperty(
        '--bs-primary-rgb', hexToRgb(currentOrgTheme.primaryColor)
    );
};

const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Récupère le nom et le label d'un collectif via l'API publique et les met en cache
 */
const fetchOrgName = async (collectiveId) => {
    if (!collectiveId) {
        currentOrgName = null;
        currentOrgLabel = null;
        currentOrgTypeLabel = null;
        currentOrgLogo = null;
        currentOrgContributionsEnabled = true;
        applyCollectiveTheme();
        return;
    }
    try {
        const orgs = await api.getCollectives();
        const org = orgs.find(o => o.id === collectiveId);
        currentOrgName = org?.name || null;
        currentOrgLabel = org?.label || null;
        currentOrgTypeLabel = org?.typeLabel
            || (i18n.lang === 'en' ? 'group' : 'groupe');
        currentOrgLogo = org?.logoIllustration
            ? IllustrationPicker.previewUrl(
                collectiveId, org.logoIllustration, true
            )
            : (org?.logo || null);
        currentOrgContributionsEnabled = org?.contributionsEnabled !== false;
        applyCollectiveTheme(org || {});
    } catch (e) {
        currentOrgName = null;
        currentOrgLabel = null;
        currentOrgTypeLabel = null;
        currentOrgLogo = null;
        currentOrgContributionsEnabled = true;
        applyCollectiveTheme();
    }
};

/**
 * Met à jour le texte du navbar brand selon le contexte
 */
const updateNavbarBrand = () => {
    const brand = document.getElementById('navbar-brand');
    const name = document.getElementById('brand-name');
    const context = document.getElementById('brand-context');
    const mark = document.querySelector('.brand-mark');
    const logo = document.getElementById('brand-logo');
    const defaultIcon = document.getElementById('brand-default-icon');
    if (!brand || !name || !context) return;
    name.textContent = currentOrgName || 'Feddeeji';
    context.textContent = currentOrgName
        ? (currentOrgLabel || currentOrgTypeLabel || '')
        : t('home_eyebrow');
    if (logo && defaultIcon && mark) {
        logo.classList.toggle('d-none', !currentOrgLogo);
        defaultIcon.classList.toggle('d-none', Boolean(currentOrgLogo));
        mark.classList.toggle('has-org-logo', Boolean(currentOrgLogo));
        if (currentOrgLogo) logo.src = currentOrgLogo;
    }
    const collectiveId = currentOrgId || api.getUserOrgId();
    brand.href = collectiveId ? `/${collectiveId}` : '/';
};

/**
 * Vérifie si la route est accessible pour le rôle actuel
 */
const canAccessRoute = (path) => {
    // Routes de login toujours accessibles
    if (path === '/login' || path === '/:collectiveId/login' || path === '/:collectiveId/register') {
        return true;
    }

    const role = api.getRole();
    if (!role) return false;

    if (role === 'superadmin') return true;

    // Admin : accès à son org seulement (pas à la liste des orgs)
    if (role === 'admin') {
        if (path === '/') return false;
        return true;
    }

    // Membre : accès limité
    if (role === 'member') {
        const memberRoutes = [
            '/:collectiveId',
            '/:collectiveId/events',
            '/:collectiveId/inscriptions',
            '/:collectiveId/events/:eventId/inscription-schedule',
            '/:collectiveId/programme',
            '/:collectiveId/action-history',
            '/:collectiveId/activities',
            '/:collectiveId/activities/:activityId',
            '/:collectiveId/profile'
        ];
        if (currentOrgContributionsEnabled) {
            memberRoutes.push('/:collectiveId/contributions');
        }
        return memberRoutes.includes(path);
    }

    return false;
};

/** Génère les navigations desktop et mobile selon le rôle. */
const updateNav = () => {
    const navLinks = document.getElementById('nav-links');
    const mobileNav = document.getElementById('mobile-nav');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');

    if (!api.isAuthenticated()) {
        navLinks.innerHTML = '';
        mobileNav.innerHTML = '';
        mobileNav.classList.add('d-none');
        document.body.classList.remove('has-mobile-nav');
        logoutBtn.classList.add('d-none');
        userInfo?.classList.add('d-none');
        return;
    }

    const role = api.getRole();
    const userName = api.user?.memberName || '';
    logoutBtn.classList.remove('d-none');
    if (userInfo) {
        userInfo.innerHTML = `
            <i class="bi bi-person-circle" aria-hidden="true"></i>
            <span>${escapeHtml(userName || t(`role_${role}`))}</span>
            ${userName ? `<small>${escapeHtml(t(`role_${role}`))}</small>` : ''}`;
        userInfo.classList.remove('d-none');
    }

    const collectiveId = currentOrgId || api.getUserOrgId();
    const links = [];
    if (role === 'superadmin') {
        links.push({
            key: 'collectives', href: '/', icon: 'bi-grid',
            label: t('collective_list_title')
        });
    }

    if (collectiveId) {
        const base = `/${collectiveId}`;
        links.push(
            { key: 'home', href: base, icon: 'bi-house-door', label: t('welcome') },
            { key: 'programme', href: `${base}/programme`, icon: 'bi-calendar2-check', label: t('programme') },
            { key: 'events', href: `${base}/events`, icon: 'bi-calendar-event', label: t('events') },
            { key: 'inscriptions', href: `${base}/inscriptions`, icon: 'bi-check2-square', label: t('inscriptions') },
            { key: 'activities', href: `${base}/activities`, icon: 'bi-stars', label: t('activities') },
            { key: 'history', href: `${base}/action-history`, icon: 'bi-clock-history', label: t('action_history') }
        );

        if (role === 'member') {
            links.push({
                key: 'profile', href: `${base}/profile`,
                icon: 'bi-person', label: t('my_profile')
            });
            if (currentOrgContributionsEnabled) {
                links.push({
                    key: 'contributions', href: `${base}/contributions`,
                    icon: 'bi-wallet2', label: t('my_contributions')
                });
            }
        }

        if (role === 'admin' || role === 'superadmin') {
            links.push({
                key: 'members', href: `${base}/members`,
                icon: 'bi-people', label: t('members')
            });
            if (currentOrgContributionsEnabled) {
                links.push({
                    key: 'contributions', href: `${base}/contributions`,
                    icon: 'bi-wallet2', label: t('contributions')
                });
            }
            links.push({
                key: 'trash', href: `${base}/trash`,
                icon: 'bi-trash3', label: t('trash')
            });
        }
    }

    const isActive = link => link.href === '/'
        ? location.pathname === '/'
        : location.pathname === link.href
            || (link.href !== `/${collectiveId}`
                && location.pathname.startsWith(`${link.href}/`));
    const renderLink = (link, mobile = false) => `
        <a class="${mobile ? 'mobile-nav-link' : 'nav-link'}
            ${isActive(link) ? 'active' : ''}"
            href="${escapeHtml(link.href)}" data-link
            ${isActive(link) ? 'aria-current="page"' : ''}>
            <i class="bi ${link.icon}" aria-hidden="true"></i>
            <span>${escapeHtml(link.label)}</span>
        </a>`;

    navLinks.innerHTML = links.map(link =>
        `<li class="nav-item">${renderLink(link)}</li>`
    ).join('');

    if (!collectiveId) {
        mobileNav.innerHTML = '';
        mobileNav.classList.add('d-none');
        document.body.classList.remove('has-mobile-nav');
        return;
    }
    document.body.classList.add('has-mobile-nav');

    const preferred = ['home', 'programme', 'activities', 'events'];
    let mobileLinks = preferred
        .map(key => links.find(link => link.key === key))
        .filter(Boolean);
    if (!mobileLinks.length) mobileLinks = links.slice(0, 4);
    mobileNav.innerHTML = mobileLinks.map(link => renderLink(link, true)).join('')
        + `<button type="button" class="mobile-nav-link"
            data-bs-toggle="collapse" data-bs-target="#navbarNav"
            aria-controls="navbarNav" aria-label="Menu">
            <i class="bi bi-grid-fill" aria-hidden="true"></i>
            <span>Menu</span>
           </button>`;
    mobileNav.classList.remove('d-none');
};

const updateTranslations = () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (
            el.tagName === 'INPUT' && el.type === 'text'
            && el.placeholder
        ) {
            el.placeholder = t(key);
        } else {
            el.innerText = t(key);
        }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.getAttribute('data-i18n-title'));
    });
};

const router = async () => {
    const routes = [
        { path: "/login", view: LoginView },
        { path: "/:collectiveId/login", view: LoginView },
        { path: "/:collectiveId/register", view: RegisterView },
        { path: "/", view: CollectiveListView },
        { path: "/:collectiveId", view: HomeView },
        { path: "/:collectiveId/members", view: MembersView },
        {
            path: "/:collectiveId/contributions",
            view: ContributionsView
        },
        { path: "/:collectiveId/events", view: EventsView },
        {
            path: "/:collectiveId/inscriptions",
            view: InscriptionsView
        },
        {
            path: "/:collectiveId/events/:eventId/inscription-schedule",
            view: InscriptionScheduleView
        },
        { path: "/:collectiveId/activities", view: ActivitiesView },
        { path: "/:collectiveId/activities/:activityId", view: ActivityRunView },
        { path: "/:collectiveId/programme", view: ProgrammeView },
        { path: "/:collectiveId/action-history", view: ActionHistoryView },
        { path: "/:collectiveId/profile", view: MembersView },
        { path: "/:collectiveId/trash", view: TrashView },
    ];

    // Tester chaque route pour un match
    const potentialMatches = routes.map(route => {
        return {
            route: route,
            result: location.pathname.match(
                pathToRegex(route.path)
            )
        };
    });

    let match = potentialMatches.find(
        potentialMatch => potentialMatch.result !== null
    );

    if (!match) {
        match = {
            route: routes[0],
            result: [location.pathname]
        };
    }

    const params = getParams(match);
    const isLoginRoute =
        match.route.path === '/login'
        || match.route.path === '/:collectiveId/login'
        || match.route.path === '/:collectiveId/register';
    document.body.classList.toggle('auth-page', isLoginRoute);
    document.body.classList.toggle(
        'has-mobile-nav', api.isAuthenticated() && !isLoginRoute
    );

    // Récupérer le nom/label de l'org si l'collectiveId a changé (y compris pages login)
    const newOrgId = params.collectiveId || null;
    if (newOrgId !== currentOrgId || (newOrgId && !currentOrgName)) {
        await fetchOrgName(newOrgId);
    }

    // Mettre à jour l'collectiveId courant (sauf sur les pages login)
    if (!isLoginRoute) {
        currentOrgId = newOrgId;
    }

    updateNav();
    updateNavbarBrand();

    // Redirection si non authentifié (sauf pages login)
    if (!api.isAuthenticated() && !isLoginRoute) {
        // Mémoriser la page demandée pour y revenir après login.
        // Pas d'utilisateur connu ici (accès direct), donc user:null
        // → restaurable pour le prochain utilisateur qui se connecte.
        localStorage.setItem(
            'redirectAfterLogin',
            JSON.stringify({ path: location.pathname, user: null })
        );
        if (params.collectiveId) {
            navigateTo(`/${params.collectiveId}/login`);
        } else {
            navigateTo('/login');
        }
        return;
    }

    // Vérification des permissions de route
    if (
        api.isAuthenticated()
        && !canAccessRoute(match.route.path)
    ) {
        const collectiveId = api.getUserOrgId();
        if (collectiveId) {
            navigateTo(`/${collectiveId}`);
        } else {
            navigateTo('/');
        }
        return;
    }

    // Rediriger admin/membre vers leur org depuis /
    if (
        api.isAuthenticated()
        && match.route.path === '/'
        && api.getRole() !== 'superadmin'
    ) {
        const collectiveId = api.getUserOrgId();
        if (collectiveId) {
            navigateTo(`/${collectiveId}`);
            return;
        }
    }

    // Rediriger si déjà authentifié sur une page login
    if (api.isAuthenticated() && isLoginRoute) {
        const role = api.getRole();
        if (role === 'superadmin') {
            navigateTo('/');
        } else {
            const collectiveId = api.getUserOrgId();
            navigateTo(collectiveId ? `/${collectiveId}` : '/');
        }
        return;
    }

    const view = new match.route.view(params);

    document.querySelector("#app").innerHTML =
        await view.getHtml();
    updateTranslations();
    await view.init();
};

window.addEventListener("popstate", router);

document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", e => {
        const link = e.target.closest("[data-link]");
        if (link) {
            e.preventDefault();
            navigateTo(link.href);
            const menu = document.getElementById('navbarNav');
            if (menu?.classList.contains('show') && window.innerWidth < 1200) {
                bootstrap.Collapse.getOrCreateInstance(menu).hide();
            }
        }
    });

    // Gestion de la langue
    const langSelector =
        document.getElementById('lang-selector');
    langSelector.value = i18n.lang;

    langSelector.addEventListener('change', (e) => {
        i18n.setLang(e.target.value);
    });

    document.addEventListener('langChanged', async () => {
        await router();
    });

    // Déconnexion
    document.getElementById('logout-btn')
        .addEventListener('click', () => api.logout());

    router();
});
