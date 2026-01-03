/**
 * UI Component Framework
 * Provides reusable UI components matching the application's dark theme
 */

export const MODULE_VERSION = '1.0.0';

export class UIComponents {
    /**
     * Create a card component
     * @param {Object} options - Card configuration
     * @param {string} options.id - Card ID
     * @param {string} options.title - Card title
     * @param {string} options.icon - Bootstrap icon class
     * @param {boolean} options.collapsible - Whether card is collapsible
     * @param {boolean} options.collapsed - Initial collapsed state
     * @param {string} options.content - HTML content
     * @param {string} options.bodyClass - Additional body classes
     * @returns {HTMLElement} Card element
     */
    static createCard({ id, title, icon = 'bi-info-circle', collapsible = true, collapsed = false, content = '', bodyClass = 'panel-content' }) {
        const card = document.createElement('div');
        card.className = 'card mb-3';
        
        const headerClass = collapsible ? 'card-header collapsible-header' : 'card-header';
        const collapsedClass = collapsed ? 'collapsed' : '';
        
        card.innerHTML = `
            <div class="${headerClass} ${collapsedClass}" data-panel="${id}">
                <i class="bi ${icon}"></i> ${title}
                ${collapsible ? '<i class="bi bi-chevron-down collapse-icon"></i>' : ''}
            </div>
            <div class="card-body ${bodyClass} ${collapsed ? 'collapsed' : ''}" id="panel-${id}">
                ${content}
            </div>
        `;
        
        // Note: Event listeners are attached by MapViewer.initCollapsiblePanels()
        // to properly handle state persistence
        
        return card;
    }

    /**
     * Create a form switch checkbox
     * @param {Object} options - Switch configuration
     * @param {string} options.id - Input ID
     * @param {string} options.label - Label text
     * @param {string} options.icon - Bootstrap icon class
     * @param {boolean} options.checked - Initial checked state
     * @param {boolean} options.disabled - Disabled state
     * @param {Function} options.onChange - Change handler
     * @returns {HTMLElement} Form switch element
     */
    static createSwitch({ id, label, icon = '', checked = false, disabled = false, onChange = null }) {
        const div = document.createElement('div');
        div.className = 'form-check form-switch mb-2';
        
        const input = document.createElement('input');
        input.className = 'form-check-input';
        input.type = 'checkbox';
        input.id = id;
        input.checked = checked;
        input.disabled = disabled;
        
        const labelEl = document.createElement('label');
        labelEl.className = 'form-check-label';
        labelEl.htmlFor = id;
        labelEl.innerHTML = icon ? `<i class="bi ${icon}"></i> ${label}` : label;
        
        if (onChange) {
            input.addEventListener('change', onChange);
        }
        
        div.appendChild(input);
        div.appendChild(labelEl);
        
        return div;
    }

    /**
     * Create a button
     * @param {Object} options - Button configuration
     * @param {string} options.id - Button ID
     * @param {string} options.label - Button label
     * @param {string} options.icon - Bootstrap icon class
     * @param {string} options.variant - Button variant (primary, secondary, info, success, warning, danger)
     * @param {string} options.size - Button size (sm, lg)
     * @param {boolean} options.disabled - Disabled state
     * @param {boolean} options.fullWidth - Full width button
     * @param {Function} options.onClick - Click handler
     * @returns {HTMLElement} Button element
     */
    static createButton({ id, label, icon = '', variant = 'primary', size = '', disabled = false, fullWidth = false, onClick = null }) {
        const button = document.createElement('button');
        button.id = id;
        button.className = `btn btn-${variant}`;
        
        if (size) button.className += ` btn-${size}`;
        if (fullWidth) button.className += ' w-100';
        if (disabled) button.disabled = true;
        
        button.innerHTML = icon ? `<i class="bi ${icon}"></i> ${label}` : label;
        
        if (onClick) {
            button.addEventListener('click', onClick);
        }
        
        return button;
    }

    /**
     * Create an info item (label-value pair)
     * @param {Object} options - Info item configuration
     * @param {string} options.label - Label text
     * @param {string} options.value - Value text
     * @param {string} options.icon - Bootstrap icon class
     * @param {string} options.valueId - ID for value span (for dynamic updates)
     * @returns {HTMLElement} Info item element
     */
    static createInfoItem({ label, value = '-', icon = '', valueId = '' }) {
        const div = document.createElement('div');
        div.className = 'npc-info-item';
        
        const content = document.createElement('div');
        const iconHtml = icon ? `<i class="bi ${icon}"></i> ` : '';
        const valueIdAttr = valueId ? ` id="${valueId}"` : '';
        
        content.innerHTML = `
            <span class="npc-info-label">${iconHtml}${label}:</span>
            <span class="npc-info-value"${valueIdAttr}>${value}</span>
        `;
        
        div.appendChild(content);
        return div;
    }

    /**
     * Create a badge
     * @param {Object} options - Badge configuration
     * @param {string} options.text - Badge text
     * @param {string} options.variant - Badge variant (primary, secondary, success, danger, warning, info)
     * @param {string} options.icon - Bootstrap icon class
     * @returns {HTMLElement} Badge element
     */
    static createBadge({ text, variant = 'primary', icon = '' }) {
        const badge = document.createElement('span');
        badge.className = `badge bg-${variant}`;
        badge.innerHTML = icon ? `<i class="bi ${icon}"></i> ${text}` : text;
        return badge;
    }

    /**
     * Create a collapsible section
     * @param {Object} options - Section configuration
     * @param {string} options.id - Section ID
     * @param {string} options.title - Section title
     * @param {string} options.icon - Bootstrap icon class
     * @param {boolean} options.collapsed - Initial collapsed state
     * @param {string} options.content - HTML content
     * @returns {HTMLElement} Section element
     */
    static createCollapsibleSection({ id, title, icon = '', collapsed = false, content = '' }) {
        const div = document.createElement('div');
        div.className = 'mb-3';
        
        const headerClass = collapsed ? 'collapsible-header collapsed' : 'collapsible-header';
        const contentClass = collapsed ? 'panel-content collapsed' : 'panel-content';
        
        div.innerHTML = `
            <div class="${headerClass}" data-panel="${id}" 
                 style="padding: 0.5rem; margin: -0.5rem -0.75rem 0.5rem -0.75rem; background: #21262d; border-radius: 4px;">
                <strong>${icon ? `<i class="bi ${icon}"></i> ` : ''}${title}</strong>
                <i class="bi bi-chevron-down collapse-icon"></i>
            </div>
            <div class="${contentClass}" id="panel-${id}" style="padding-top: 0.5rem;">
                ${content}
            </div>
        `;
        
        // Note: Event listeners are attached by MapViewer.initCollapsiblePanels()
        // to properly handle state persistence
        
        return div;
    }

    /**
     * Create a slider (range input)
     * @param {Object} options - Slider configuration
     * @param {string} options.id - Input ID
     * @param {string} options.label - Label text
     * @param {number} options.min - Minimum value
     * @param {number} options.max - Maximum value
     * @param {number} options.step - Step value
     * @param {number} options.value - Initial value
     * @param {string} options.displayId - ID for display element
     * @param {string} options.minLabel - Min label text
     * @param {string} options.maxLabel - Max label text
     * @param {Function} options.onChange - Change handler
     * @returns {HTMLElement} Slider element
     */
    static createSlider({ id, label, min = 0, max = 100, step = 1, value = 50, displayId = '', minLabel = 'Min', maxLabel = 'Max', onChange = null }) {
        const container = document.createElement('div');
        container.className = 'mb-3';
        
        container.innerHTML = `
            <label class="form-label">${label}: <span id="${displayId}">${value}</span></label>
            <div class="d-flex align-items-center gap-2">
                <small class="text-muted" style="min-width: 30px;">${minLabel}</small>
                <input type="range" class="form-range flex-grow-1" id="${id}" 
                       min="${min}" max="${max}" step="${step}" value="${value}">
                <small class="text-muted" style="min-width: 35px;">${maxLabel}</small>
            </div>
        `;
        
        if (onChange) {
            const input = container.querySelector('input');
            input.addEventListener('input', onChange);
        }
        
        return container;
    }

    /**
     * Create a modal
     * @param {Object} options - Modal configuration
     * @param {string} options.id - Modal ID
     * @param {string} options.title - Modal title
     * @param {string} options.icon - Bootstrap icon class
     * @param {string} options.content - HTML content
     * @param {Array} options.buttons - Array of button configs
     * @returns {HTMLElement} Modal element
     */
    static createModal({ id, title, icon = '', content = '', buttons = [] }) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = id;
        modal.tabIndex = -1;
        modal.setAttribute('aria-labelledby', `${id}Label`);
        modal.setAttribute('aria-hidden', 'true');
        
        let buttonsHtml = '';
        if (buttons.length === 0) {
            buttonsHtml = `
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <i class="bi bi-x-circle"></i> Close
                </button>
            `;
        } else {
            buttonsHtml = buttons.map(btn => {
                const dismissAttr = btn.dismiss ? 'data-bs-dismiss="modal"' : '';
                return `
                    <button type="button" class="btn btn-${btn.variant || 'primary'}" ${dismissAttr} id="${btn.id || ''}">
                        ${btn.icon ? `<i class="bi ${btn.icon}"></i> ` : ''}${btn.label}
                    </button>
                `;
            }).join('');
        }
        
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${id}Label">
                            ${icon ? `<i class="bi ${icon}"></i> ` : ''}${title}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="${id}Content">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${buttonsHtml}
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    }

    /**
     * Create a toast notification
     * @param {Object} options - Toast configuration
     * @param {string} options.id - Toast ID
     * @param {string} options.message - Toast message
     * @param {string} options.variant - Toast variant (danger, success, warning, info)
     * @param {number} options.delay - Auto-hide delay in ms
     * @returns {HTMLElement} Toast element
     */
    static createToast({ id, message, variant = 'info', delay = 5000 }) {
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `toast align-items-center text-bg-${variant} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body" id="${id}Message">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        return toast;
    }

    /**
     * Create a loading spinner
     * @param {Object} options - Spinner configuration
     * @param {string} options.id - Spinner ID
     * @param {string} options.text - Loading text
     * @param {string} options.variant - Spinner variant (primary, secondary, etc.)
     * @returns {HTMLElement} Spinner element
     */
    static createSpinner({ id = 'loading', text = 'Loading...', variant = 'primary' }) {
        const container = document.createElement('div');
        container.id = id;
        container.className = 'text-center';
        container.style.cssText = 'display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;';
        
        container.innerHTML = `
            <div class="spinner-border text-${variant}" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">${text}</p>
        `;
        
        return container;
    }

    /**
     * Create a sidebar
     * @param {Object} options - Sidebar configuration
     * @param {string} options.id - Sidebar ID
     * @param {string} options.content - HTML content
     * @param {boolean} options.hidden - Initial hidden state
     * @returns {HTMLElement} Sidebar element
     */
    static createSidebar({ id = 'sidebar', content = '', hidden = true }) {
        const sidebar = document.createElement('div');
        sidebar.id = id;
        sidebar.className = hidden ? 'hidden' : '';
        
        sidebar.innerHTML = content;
        
        return sidebar;
    }

    /**
     * Create a list of map items
     * @param {Array} maps - Array of map objects with {mapId, name}
     * @param {Function} onClickMap - Click handler for map items
     * @returns {HTMLElement} Map list container
     */
    static createMapList({ maps = [], onClickMap = null }) {
        const container = document.createElement('div');
        container.className = 'map-list';
        container.id = 'mapList';
        
        maps.forEach(map => {
            const item = document.createElement('div');
            item.className = 'map-item';
            item.textContent = `${String(map.mapId).padStart(3, '0')} - ${map.name}`;
            item.dataset.mapId = map.mapId;
            
            if (onClickMap) {
                item.addEventListener('click', () => onClickMap(map.mapId));
            }
            
            container.appendChild(item);
        });
        
        return container;
    }

    /**
     * Create a horizontal divider
     * @returns {HTMLElement} Divider element
     */
    static createDivider() {
        const hr = document.createElement('hr');
        hr.className = 'my-3';
        return hr;
    }
}
