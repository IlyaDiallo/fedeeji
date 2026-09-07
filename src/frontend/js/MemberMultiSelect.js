/** Native disclosure and checkboxes keep the picker usable with touch and keyboard. */
class MemberMultiSelect {
    constructor({ container, members, selectedIds = [], getMemberName }) {
        this.container = container;
        container.replaceChildren();
        container.classList.add('member-multi-select');
        const selected = new Set(selectedIds);
        this.badges = document.createElement('div');
        this.badges.className = 'member-multi-select-badges';
        this.details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.className = 'form-control';
        summary.textContent = t('member_picker_choose');
        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'form-control my-2';
        search.placeholder = t('member_picker_search');
        search.setAttribute('aria-label', t('member_picker_search'));
        const results = document.createElement('div');
        results.className = 'member-multi-select-results';
        this.entries = members.map(member => {
            const name = getMemberName(member.id);
            const label = document.createElement('label');
            label.className = 'member-multi-select-option';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = member.id;
            input.className = 'form-check-input';
            input.checked = selected.has(member.id);
            label.append(input, document.createTextNode(name));
            results.append(label);
            input.addEventListener('change', () => this.renderBadges());
            return { name, label, input };
        });
        const empty = document.createElement('p');
        empty.className = 'text-muted small m-2';
        empty.textContent = t('member_picker_empty');
        empty.setAttribute('role', 'status');
        results.append(empty);
        const filter = () => {
            const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
            const query = normalize(search.value.trim());
            this.entries.forEach(entry => { entry.label.hidden = !normalize(entry.name).includes(query); });
            empty.hidden = this.entries.some(entry => !entry.label.hidden);
        };
        search.addEventListener('input', filter);
        this.details.addEventListener('toggle', () => {
            if (this.details.open) {
                search.value = '';
                filter();
                search.focus();
            }
        });
        this.details.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.details.open = false;
                summary.focus();
            }
        });
        this.details.append(summary, search, results);
        container.append(this.badges, this.details);
        filter();
        this.renderBadges();
    }

    renderBadges() {
        this.badges.replaceChildren();
        this.entries.filter(entry => entry.input.checked).forEach(entry => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-sm btn-outline-secondary member-multi-select-badge';
            button.textContent = `${entry.name} ×`;
            button.setAttribute('aria-label', `${t('member_picker_remove')} ${entry.name}`);
            button.disabled = entry.input.disabled;
            button.addEventListener('click', () => {
                entry.input.checked = false;
                this.renderBadges();
                (this.badges.querySelector('button') || this.details.querySelector('summary')).focus();
            });
            this.badges.append(button);
        });
    }
}
