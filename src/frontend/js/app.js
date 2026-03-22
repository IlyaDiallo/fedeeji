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

/**
 * Récupère le nom et le label d'une organisation via l'API publique et les met en cache
 */
const fetchOrgName = async (orgId) => {
    if (!orgId) {
        currentOrgName = null;
        currentOrgLabel = null;
        return;
    }
    try {
        const orgs = await api.getOrganizations();
        const org = orgs.find(o => o.id === orgId);
        currentOrgName = org?.name || null;
        currentOrgLabel = org?.label || null;
    } catch (e) {
        currentOrgName = null;
        currentOrgLabel = null;
    }
};

/**
 * Met à jour le texte du navbar brand selon le contexte
 */
const updateNavbarBrand = () => {
    const brand = document.getElementById('navbar-brand');
    if (!brand) return;
    brand.textContent = currentOrgName || 'Feddeeji';
};

/**
 * Vérifie si la route est accessible pour le rôle actuel
 */
const canAccessRoute = (path) => {
    // Routes de login toujours accessibles
    if (path === '/login' || path === '/:orgId/login' || path === '/:orgId/register') {
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
            '/:orgId',
            '/:orgId/events',
            '/:orgId/participations',
            '/:orgId/events/:eventId/participation-schedule',
            '/:orgId/schedule',
            '/:orgId/profile',
            '/:orgId/subscriptions'
        ];
        return memberRoutes.includes(path);
    }

    return false;
};

/**
 * Génère la nav selon le rôle et l'org courante
 */
const updateNav = () => {
    const navLinks = document.getElementById('nav-links');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');

    if (!api.isAuthenticated()) {
        navLinks.innerHTML = '';
        logoutBtn.classList.add('d-none');
        if (userInfo) userInfo.classList.add('d-none');
        return;
    }

    logoutBtn.classList.remove('d-none');

    // Afficher le nom de l'utilisateur et son rôle
    if (userInfo) {
        const role = api.getRole();
        const name = api.user?.memberName || '';
        const roleLabel = t(`role_${role}`);
        if (name) {
            userInfo.textContent =
                `${name} (${roleLabel})`;
        } else {
            userInfo.textContent = roleLabel;
        }
        userInfo.classList.remove('d-none');
    }

    const role = api.getRole();

    // Superadmin sans org sélectionnée : liste des orgs
    if (role === 'superadmin' && !currentOrgId) {
        navLinks.innerHTML = `
            <li class="nav-item">
                <a class="nav-link" href="/" data-link
                    data-i18n="org_list_title">
                    ${t("org_list_title")}</a>
            </li>
        `;
        updateTranslations();
        return;
    }

    const orgId = currentOrgId || api.getUserOrgId();
    if (!orgId) {
        navLinks.innerHTML = '';
        updateTranslations();
        return;
    }

    let links = '';

    // Lien retour vers la liste des orgs (superadmin)
    if (role === 'superadmin') {
        links += `
            <li class="nav-item">
                <a class="nav-link" href="/" data-link
                    data-i18n="org_list_title">
                    ${t("org_list_title")}</a>
            </li>
        `;
    }

    // Accueil org (tous les rôles)
    links += `
        <li class="nav-item">
            <a class="nav-link" href="/${orgId}"
                data-link data-i18n="welcome">
                ${t("welcome")}</a>
        </li>
    `;

    // Événements (tous les rôles)
    links += `
        <li class="nav-item">
            <a class="nav-link" href="/${orgId}/events"
                data-link data-i18n="events">
                ${t("events")}</a>
        </li>
    `;

    // Participations (tous les rôles)
    links += `
        <li class="nav-item">
            <a class="nav-link"
                href="/${orgId}/participations"
                data-link data-i18n="participations">
                ${t("participations")}</a>
        </li>
    `;

    // Planning (tous les rôles)
    links += `
        <li class="nav-item">
            <a class="nav-link"
                href="/${orgId}/schedule"
                data-link data-i18n="schedule">
                ${t("schedule")}</a>
        </li>
    `;

    // Membre : accès profil et cotisations
    if (role === 'member') {
        links += `
            <li class="nav-item">
                <a class="nav-link"
                    href="/${orgId}/profile"
                    data-link data-i18n="my_profile">
                    ${t("my_profile")}</a>
            </li>
            <li class="nav-item">
                <a class="nav-link"
                    href="/${orgId}/subscriptions"
                    data-link
                    data-i18n="my_subscriptions">
                    ${t("my_subscriptions")}</a>
            </li>
        `;
    }

    // Admin + superadmin seulement
    if (role === 'admin' || role === 'superadmin') {
        links += `
            <li class="nav-item">
                <a class="nav-link"
                    href="/${orgId}/members"
                    data-link data-i18n="members">
                    ${t("members")}</a>
            </li>
            <li class="nav-item">
                <a class="nav-link"
                    href="/${orgId}/users"
                    data-link data-i18n="users">
                    ${t("users")}</a>
            </li>
            <li class="nav-item">
                <a class="nav-link"
                    href="/${orgId}/subscriptions"
                    data-link data-i18n="subscriptions">
                    ${t("subscriptions")}</a>
            </li>
            <li class="nav-item">
                <a class="nav-link"
                    href="/${orgId}/trash"
                    data-link data-i18n="trash">
                    🗑 ${t("trash")}</a>
            </li>
        `;
    }

    navLinks.innerHTML = links;
    updateTranslations();
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
};

const router = async () => {
    const routes = [
        { path: "/login", view: LoginView },
        { path: "/:orgId/login", view: LoginView },
        { path: "/:orgId/register", view: RegisterView },
        { path: "/", view: OrgListView },
        { path: "/:orgId", view: HomeView },
        { path: "/:orgId/users", view: UsersView },
        { path: "/:orgId/members", view: MembersView },
        {
            path: "/:orgId/subscriptions",
            view: SubscriptionsView
        },
        { path: "/:orgId/events", view: EventsView },
        {
            path: "/:orgId/participations",
            view: ParticipationsView
        },
        {
            path: "/:orgId/events/:eventId/participation-schedule",
            view: ParticipationScheduleView
        },
        { path: "/:orgId/schedule", view: ScheduleView },
        { path: "/:orgId/profile", view: ProfileView },
        { path: "/:orgId/trash", view: TrashView },
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
        || match.route.path === '/:orgId/login'
        || match.route.path === '/:orgId/register';

    // Récupérer le nom/label de l'org si l'orgId a changé (y compris pages login)
    const newOrgId = params.orgId || null;
    if (newOrgId !== currentOrgId || (newOrgId && !currentOrgName)) {
        await fetchOrgName(newOrgId);
    }

    // Mettre à jour l'orgId courant (sauf sur les pages login)
    if (!isLoginRoute) {
        currentOrgId = newOrgId;
    }

    updateNav();
    updateNavbarBrand();

    // Redirection si non authentifié (sauf pages login)
    if (!api.isAuthenticated() && !isLoginRoute) {
        if (params.orgId) {
            navigateTo(`/${params.orgId}/login`);
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
        const orgId = api.getUserOrgId();
        if (orgId) {
            navigateTo(`/${orgId}`);
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
        const orgId = api.getUserOrgId();
        if (orgId) {
            navigateTo(`/${orgId}`);
            return;
        }
    }

    // Rediriger si déjà authentifié sur une page login
    if (api.isAuthenticated() && isLoginRoute) {
        const role = api.getRole();
        if (role === 'superadmin') {
            navigateTo('/');
        } else {
            const orgId = api.getUserOrgId();
            navigateTo(orgId ? `/${orgId}` : '/');
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
