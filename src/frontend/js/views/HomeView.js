class HomeView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t('welcome'));
        this.collectiveId = params.collectiveId;
    }

    static escape(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    linkCard({ href, icon, title, description, color }) {
        const E = HomeView.escape;
        return `
            <a href="${E(href)}" class="home-link-card" data-link
                style="--card-accent:${color}">
                <span class="home-link-icon"><i class="bi ${icon}"></i></span>
                <span class="home-link-copy">
                    <strong>${E(title)}</strong>
                    <small>${E(description)}</small>
                </span>
                <i class="bi bi-arrow-up-right home-link-arrow"></i>
            </a>`;
    }

    async getHtml() {
        let logo = '/favicon.svg';
        let org = null;
        try {
            const orgs = await api.getCollectives();
            org = orgs.find(item => item.id === this.collectiveId) || null;
            if (org?.logoIllustration) {
                logo = IllustrationPicker.previewUrl(
                    this.collectiveId, org.logoIllustration, false
                );
            } else if (org?.logo) {
                logo = org.logo;
            }
        } catch (error) {
            console.error('Erreur lors de la récupération du collectif', error);
        }

        const E = HomeView.escape;
        const name = org?.label || org?.name || t('brand');
        const typeLabel = org?.typeLabel
            || (i18n.lang === 'en' ? 'group' : 'groupe');
        const displayType = typeLabel.charAt(0).toUpperCase()
            + typeLabel.slice(1);
        const userName = api.user?.memberName || '';
        const greeting = userName
            ? `${t('home_greeting')}, ${userName}`
            : t('home_greeting');
        const base = `/${this.collectiveId}`;
        const cards = [
            {
                href: `${base}/programme`, icon: 'bi-calendar2-check',
                title: t('programme'), description: t('home_programme_desc'),
                color: 'var(--fd-primary)'
            },
            {
                href: `${base}/activities`, icon: 'bi-stars',
                title: t('activities'), description: t('home_activities_desc'),
                color: 'var(--fd-secondary)'
            },
            {
                href: `${base}/events`, icon: 'bi-calendar-event',
                title: t('events'), description: t('home_events_desc'),
                color: '#ed7c34'
            },
            {
                href: `${base}/inscriptions`, icon: 'bi-check2-square',
                title: t('inscriptions'),
                description: t('home_inscriptions_desc'), color: '#d94f8a'
            }
        ];

        const role = api.getRole();
        const management = role === 'admin' || role === 'superadmin'
            ? [
                {
                    href: `${base}/members`, icon: 'bi-people',
                    title: t('members'), description: t('home_members_desc'),
                    color: '#1677c8'
                },
                ...(currentOrgContributionsEnabled ? [{
                    href: `${base}/contributions`, icon: 'bi-wallet2',
                    title: t('contributions'),
                    description: t('home_contributions_desc'),
                    color: '#8a5bd6'
                }] : [])
            ] : [];

        return `
            <section class="dashboard-hero">
                <div class="dashboard-hero-copy">
                    <span class="hero-eyebrow">
                        <i class="bi bi-people-fill"></i>
                        ${E(`${t('your_space')} ${typeLabel}`)}
                    </span>
                    <p class="hero-greeting">${E(greeting)}</p>
                    <h1>${E(name)}</h1>
                    <p class="hero-intro">${E(t('home_intro'))}</p>
                    <div class="hero-actions">
                        <a href="${base}/programme" class="btn btn-primary btn-lg"
                            data-link>
                            <i class="bi bi-calendar2-check"></i>
                            ${E(t('open_programme'))}
                        </a>
                        <a href="${base}/activities"
                            class="btn btn-light btn-lg" data-link>
                            <i class="bi bi-play-circle"></i>
                            ${E(t('activities'))}
                        </a>
                    </div>
                </div>
                <div class="dashboard-hero-visual" aria-hidden="true">
                    <span class="hero-orbit orbit-one"></span>
                    <span class="hero-orbit orbit-two"></span>
                    <div class="hero-logo-wrap">
                        <img src="${E(logo)}" alt="">
                    </div>
                    <span class="hero-float hero-float-one">
                        <i class="bi bi-heart-fill"></i>
                    </span>
                    <span class="hero-float hero-float-two">
                        <i class="bi bi-lightning-charge-fill"></i>
                    </span>
                </div>
            </section>

            <section class="home-section" aria-labelledby="quick-links-title">
                <div class="section-heading">
                    <div>
                        <span class="section-kicker">${E(t('today'))}</span>
                        <h2 id="quick-links-title">${E(t('quick_access'))}</h2>
                    </div>
                </div>
                <div class="home-link-grid">
                    ${cards.map(card => this.linkCard(card)).join('')}
                </div>
            </section>

            ${management.length ? `
                <section class="home-section" aria-labelledby="management-title">
                    <div class="section-heading">
                        <div>
                            <span class="section-kicker">Admin</span>
                            <h2 id="management-title">
                                ${E(`${t('management')} — ${displayType}`)}
                            </h2>
                        </div>
                    </div>
                    <div class="home-link-grid home-link-grid-compact">
                        ${management.map(card => this.linkCard(card)).join('')}
                    </div>
                </section>` : ''}
        `;
    }
}
