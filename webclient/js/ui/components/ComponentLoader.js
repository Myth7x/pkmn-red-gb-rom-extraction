/**
 * UI Component Loader
 * Loads and manages reusable HTML components
 * @version 1.0.0
 */

export const MODULE_VERSION = '1.0.0';

export class ComponentLoader {
    constructor() {
        this.components = new Map();
        this.loadedComponents = new Set();
    }

    /**
     * Load an HTML component from the components directory
     * @param {string} name - Component name (e.g., 'sidebar', 'modal')
     * @param {string} targetSelector - CSS selector where to inject component
     * @param {Object} data - Data to populate component with
     */
    async loadComponent(name, targetSelector, data = {}) {
        try {
            // Check if already loaded
            if (this.loadedComponents.has(name)) {
                console.log(`📦 Component '${name}' already loaded`);
                return this.components.get(name);
            }

            // Fetch component HTML
            const response = await fetch(`./components/${name}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${name}`);
            }

            const html = await response.text();
            
            // Store component
            this.components.set(name, html);
            this.loadedComponents.add(name);

            // Inject into target if specified
            if (targetSelector) {
                const target = document.querySelector(targetSelector);
                if (target) {
                    target.innerHTML = this.processTemplate(html, data);
                    console.log(`✅ Component '${name}' loaded into ${targetSelector}`);
                } else {
                    console.warn(`⚠️ Target element '${targetSelector}' not found`);
                }
            }

            return html;
        } catch (error) {
            console.error(`❌ Error loading component '${name}':`, error);
            throw error;
        }
    }

    /**
     * Process template with data (simple template engine)
     * Replaces {{key}} with data[key]
     */
    processTemplate(html, data) {
        return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    /**
     * Get a loaded component's HTML
     */
    getComponent(name) {
        return this.components.get(name);
    }

    /**
     * Reload a component
     */
    async reloadComponent(name, targetSelector, data = {}) {
        this.loadedComponents.delete(name);
        this.components.delete(name);
        return await this.loadComponent(name, targetSelector, data);
    }

    /**
     * Load multiple components in parallel
     */
    async loadComponents(components) {
        const promises = components.map(({ name, target, data }) =>
            this.loadComponent(name, target, data)
        );
        return await Promise.all(promises);
    }
}

/**
 * UI Component Builder
 * Programmatically create UI components
 */
export class UIBuilder {
    /**
     * Create a card component
     */
    static createCard(options = {}) {
        const {
            id = '',
            title = '',
            icon = 'bi-card-list',
            collapsible = false,
            collapsed = false,
            headerClass = '',
            bodyClass = 'card-body',
            content = ''
        } = options;

        const collapseIcon = collapsible 
            ? `<i class="bi bi-chevron-down collapse-icon"></i>` 
            : '';
        
        const headerClasses = collapsible 
            ? `card-header collapsible-header ${collapsed ? 'collapsed' : ''} ${headerClass}`
            : `card-header ${headerClass}`;

        const bodyId = id ? `panel-${id}` : '';
        const bodyClasses = collapsible
            ? `panel-content ${collapsed ? 'collapsed' : ''} ${bodyClass}`
            : bodyClass;

        const dataPanel = collapsible && id ? `data-panel="${id}"` : '';

        return `
            <div class="card ${id ? `card-${id}` : ''} mb-3">
                <div class="${headerClasses}" ${dataPanel}>
                    <i class="bi ${icon}"></i> ${title}
                    ${collapseIcon}
                </div>
                <div class="${bodyClasses}" ${bodyId ? `id="${bodyId}"` : ''}>
                    ${content}
                </div>
            </div>
        `;
    }

    /**
     * Create a button
     */
    static createButton(options = {}) {
        const {
            id = '',
            text = '',
            icon = '',
            variant = 'primary',
            size = '',
            disabled = false,
            className = '',
            onclick = ''
        } = options;

        const sizeClass = size ? `btn-${size}` : '';
        const iconHtml = icon ? `<i class="bi ${icon}"></i> ` : '';
        const onclickAttr = onclick ? `onclick="${onclick}"` : '';

        return `
            <button 
                ${id ? `id="${id}"` : ''}
                class="btn btn-${variant} ${sizeClass} ${className}"
                ${disabled ? 'disabled' : ''}
                ${onclickAttr}
            >
                ${iconHtml}${text}
            </button>
        `;
    }

    /**
     * Create a form switch/checkbox
     */
    static createSwitch(options = {}) {
        const {
            id = '',
            label = '',
            icon = '',
            checked = false,
            disabled = false,
            className = ''
        } = options;

        const iconHtml = icon ? `<i class="bi ${icon}"></i> ` : '';

        return `
            <div class="form-check form-switch mb-2 ${className}">
                <input 
                    class="form-check-input" 
                    type="checkbox" 
                    ${id ? `id="${id}"` : ''}
                    ${checked ? 'checked' : ''}
                    ${disabled ? 'disabled' : ''}
                >
                <label class="form-check-label" ${id ? `for="${id}"` : ''}>
                    ${iconHtml}${label}
                </label>
            </div>
        `;
    }

    /**
     * Create a collapsible section
     */
    static createCollapsibleSection(options = {}) {
        const {
            id = '',
            title = '',
            icon = '',
            content = '',
            collapsed = false
        } = options;

        const iconHtml = icon ? `<i class="bi ${icon}"></i> ` : '';
        const dataPanel = id ? `data-panel="${id}"` : '';
        const panelId = id ? `panel-${id}` : '';
        const collapsedClass = collapsed ? 'collapsed' : '';

        return `
            <div class="mb-3">
                <div class="collapsible-header ${collapsedClass}" ${dataPanel} 
                     style="padding: 0.5rem; margin: -0.5rem -0.75rem 0.5rem -0.75rem; background: #21262d; border-radius: 4px;">
                    <strong>${iconHtml}${title}</strong>
                    <i class="bi bi-chevron-down collapse-icon"></i>
                </div>
                <div class="panel-content ${collapsedClass}" ${panelId ? `id="${panelId}"` : ''} style="padding-top: 0.5rem;">
                    ${content}
                </div>
            </div>
        `;
    }

    /**
     * Create an info item (like NPC info display)
     */
    static createInfoItem(options = {}) {
        const {
            label = '',
            value = '',
            icon = '',
            className = ''
        } = options;

        const iconHtml = icon ? `<i class="bi ${icon}"></i> ` : '';

        return `
            <div class="npc-info-item ${className}">
                <div>
                    <span class="npc-info-label">${iconHtml}${label}:</span> 
                    <span class="npc-info-value">${value}</span>
                </div>
            </div>
        `;
    }

    /**
     * Create a badge
     */
    static createBadge(text, variant = 'primary') {
        return `<span class="badge bg-${variant}">${text}</span>`;
    }

    /**
     * Create a modal
     */
    static createModal(options = {}) {
        const {
            id = 'dynamicModal',
            title = 'Modal',
            icon = 'bi-info-circle',
            content = '',
            footer = '',
            size = '' // '', 'modal-sm', 'modal-lg', 'modal-xl'
        } = options;

        const footerHtml = footer || `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                <i class="bi bi-x-circle"></i> Close
            </button>
        `;

        return `
            <div class="modal fade" id="${id}" tabindex="-1" aria-labelledby="${id}Label" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered ${size}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="${id}Label">
                                <i class="bi ${icon}"></i> ${title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                        <div class="modal-footer">
                            ${footerHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create a list item for map list
     */
    static createMapItem(mapId, mapName) {
        return `
            <div class="map-item" data-map-id="${mapId}">
                ${String(mapId).padStart(3, '0')} - ${mapName}
            </div>
        `;
    }

    /**
     * Create a toast notification
     */
    static createToast(options = {}) {
        const {
            id = 'dynamicToast',
            message = '',
            variant = 'danger', // danger, success, info, warning
            autoHide = true,
            delay = 5000
        } = options;

        return `
            <div id="${id}" class="toast align-items-center text-bg-${variant} border-0" 
                 role="alert" aria-live="assertive" aria-atomic="true"
                 data-bs-autohide="${autoHide}" data-bs-delay="${delay}">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                            data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
    }
}

/**
 * Initialize collapsible panels
 */
export function initCollapsiblePanels() {
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const panelId = this.getAttribute('data-panel');
            const content = panelId 
                ? document.getElementById(`panel-${panelId}`)
                : this.nextElementSibling;
            
            if (content && content.classList.contains('panel-content')) {
                this.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
            }
        });
    });
}
