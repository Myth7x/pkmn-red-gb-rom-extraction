/**
 * UI Builder
 * Builds the application UI using reusable components
 */

import { UIComponents } from './UIComponents.js';

export const MODULE_VERSION = '1.0.0';

export class UIBuilder {
    /**
     * Build the main sidebar UI
     * @param {Object} handlers - Event handlers for UI elements
     * @returns {HTMLElement} Complete sidebar element
     */
    static buildSidebar(handlers = {}) {
        const sidebar = document.createElement('div');
        sidebar.id = 'sidebar';
        sidebar.className = 'hidden';
        
        // Controls Card
        const controlsCard = this.buildControlsCard(handlers);
        sidebar.appendChild(controlsCard);
        
        // Map Info Card
        const mapInfoCard = this.buildMapInfoCard();
        sidebar.appendChild(mapInfoCard);
        
        // Map List Card
        const mapListCard = this.buildMapListCard();
        sidebar.appendChild(mapListCard);
        
        return sidebar;
    }

    /**
     * Build the controls card
     */
    static buildControlsCard(handlers) {
        const card = UIComponents.createCard({
            id: 'controls',
            title: 'Controls',
            icon: 'bi-gear',
            collapsible: true,
            collapsed: false,
            bodyClass: 'card-body panel-content',
            content: '' // We'll add content programmatically
        });
        
        const body = card.querySelector('.card-body');
        
        // Zoom controls
        const zoomSlider = UIComponents.createSlider({
            id: 'zoomSlider',
            label: '<i class="bi bi-zoom-in"></i> Zoom Level',
            min: 0.5,
            max: 40,
            step: 0.1,
            value: 2,
            displayId: 'zoomLevel',
            minLabel: 'In',
            maxLabel: 'Out',
            onChange: handlers.onZoomChange
        });
        body.appendChild(zoomSlider);
        
        const resetBtn = UIComponents.createButton({
            id: 'resetZoomBtn',
            label: 'Reset & Center',
            icon: 'bi-arrow-counterclockwise',
            variant: 'secondary',
            size: 'sm',
            fullWidth: true,
            onClick: handlers.onResetZoom
        });
        zoomSlider.appendChild(resetBtn);
        
        body.appendChild(UIComponents.createDivider());
        
        // Visual Options Section
        const visualSection = UIComponents.createCollapsibleSection({
            id: 'visualOptions',
            title: 'Visual Options',
            icon: 'bi-eye',
            collapsed: false,
            content: ''
        });
        
        const visualContent = visualSection.querySelector('.panel-content');
        visualContent.appendChild(UIComponents.createSwitch({
            id: 'showOverlaysCheckbox',
            label: 'Show Overlays (W/S/N)',
            icon: 'bi-eye',
            checked: true,
            onChange: handlers.onToggleOverlays
        }));
        
        visualContent.appendChild(UIComponents.createSwitch({
            id: 'showGridCheckbox',
            label: 'Show Grid',
            icon: 'bi-grid-3x3',
            checked: false,
            onChange: handlers.onToggleGrid
        }));
        
        visualContent.appendChild(UIComponents.createSwitch({
            id: 'showCoordsCheckbox',
            label: 'Show Coordinates',
            icon: 'bi-cursor-text',
            checked: false,
            onChange: handlers.onToggleCoords
        }));
        
        visualContent.appendChild(UIComponents.createSwitch({
            id: 'showTooltipCheckbox',
            label: 'Show Debug Tooltip',
            icon: 'bi-info-square',
            checked: true,
            onChange: handlers.onToggleTooltip
        }));
        
        body.appendChild(visualSection);
        
        // NPC Options Section
        const npcSection = UIComponents.createCollapsibleSection({
            id: 'npcOptions',
            title: 'NPC Options',
            icon: 'bi-person-walking',
            collapsed: false,
            content: ''
        });
        
        const npcContent = npcSection.querySelector('.panel-content');
        npcContent.appendChild(UIComponents.createSwitch({
            id: 'npcMovementCheckbox',
            label: 'NPC Movement',
            icon: 'bi-person-walking',
            checked: true,
            onChange: handlers.onToggleNPCMovement
        }));
        
        body.appendChild(npcSection);
        
        // Interior Layout Section
        const interiorSection = UIComponents.createCollapsibleSection({
            id: 'interiorOptions',
            title: 'Interior Layout Options',
            icon: 'bi-building',
            collapsed: false,
            content: ''
        });
        
        const interiorContent = interiorSection.querySelector('.panel-content');
        interiorContent.appendChild(UIComponents.createSwitch({
            id: 'showInteriorLayoutCheckbox',
            label: 'Interior Layout Mode',
            icon: 'bi-building',
            checked: true,
            disabled: true,
            onChange: handlers.onToggleInteriorLayout
        }));
        
        body.appendChild(interiorSection);
        
        // Optimization Section
        const optSection = UIComponents.createCollapsibleSection({
            id: 'optimizationOptions',
            title: 'Optimization',
            icon: 'bi-speedometer2',
            collapsed: false,
            content: ''
        });
        
        const optContent = optSection.querySelector('.panel-content');
        optContent.appendChild(UIComponents.createSwitch({
            id: 'tileOptimizationCheckbox',
            label: 'Tile Render Optimization',
            icon: 'bi-speedometer2',
            checked: true,
            onChange: handlers.onToggleTileOptimization
        }));
        
        body.appendChild(optSection);
        
        // Debug Utils Section
        const debugSection = UIComponents.createCollapsibleSection({
            id: 'debugUtils',
            title: 'Debug Utils',
            icon: 'bi-bug',
            collapsed: false,
            content: ''
        });
        
        const debugContent = debugSection.querySelector('.panel-content');
        debugContent.appendChild(UIComponents.createButton({
            id: 'printCollisionBtn',
            label: 'Print Collision Data',
            icon: 'bi-terminal',
            variant: 'info',
            size: 'sm',
            fullWidth: true,
            onClick: handlers.onPrintCollision
        }));
        debugContent.appendChild(document.createElement('br'));
        
        debugContent.appendChild(UIComponents.createButton({
            id: 'analyzeConnectionsBtn',
            label: 'Analyze Connections',
            icon: 'bi-arrows-move',
            variant: 'success',
            size: 'sm',
            fullWidth: true,
            disabled: true,
            onClick: handlers.onAnalyzeConnections
        }));
        debugContent.appendChild(document.createElement('br'));
        
        debugContent.appendChild(UIComponents.createButton({
            id: 'applyOptimalAlignmentsBtn',
            label: 'Apply Optimal Alignments',
            icon: 'bi-arrow-left-right',
            variant: 'warning',
            size: 'sm',
            fullWidth: true,
            disabled: true,
            onClick: handlers.onApplyAlignments
        }));
        debugContent.appendChild(document.createElement('br'));
        
        debugContent.appendChild(UIComponents.createButton({
            id: 'tileAnimDebugBtn',
            label: 'Tile Animation Debug',
            icon: 'bi-gear',
            variant: 'secondary',
            size: 'sm',
            fullWidth: true,
            onClick: handlers.onTileAnimDebug
        }));
        
        body.appendChild(debugSection);
        
        return card;
    }

    /**
     * Build the map info card
     */
    static buildMapInfoCard() {
        const content = document.createElement('div');
        
        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'd-flex justify-content-between align-items-center mb-2';
        badgeContainer.appendChild(UIComponents.createBadge({
            text: 'Active Map',
            variant: 'success'
        }));
        content.appendChild(badgeContainer);
        
        content.appendChild(UIComponents.createInfoItem({
            label: 'Map',
            value: 'Loading...',
            valueId: 'mapName'
        }));
        
        content.appendChild(UIComponents.createInfoItem({
            label: 'ID',
            value: '-',
            valueId: 'mapId'
        }));
        
        content.appendChild(UIComponents.createInfoItem({
            label: 'Size',
            value: '-',
            valueId: 'mapSize'
        }));
        
        content.appendChild(UIComponents.createInfoItem({
            label: 'Tileset',
            value: '-',
            valueId: 'tilesetName'
        }));
        
        const card = UIComponents.createCard({
            id: 'mapInfo',
            title: 'Map Information',
            icon: 'bi-map',
            collapsible: true,
            collapsed: false,
            bodyClass: 'card-body panel-content',
            content: content.innerHTML
        });
        
        return card;
    }

    /**
     * Build the map list card
     */
    static buildMapListCard() {
        const content = '<div id="mapList" class="map-list"></div>';
        
        const card = UIComponents.createCard({
            id: 'mapList',
            title: 'Map List',
            icon: 'bi-list-ul',
            collapsible: true,
            collapsed: false,
            bodyClass: 'card-body p-2 panel-content',
            content: content
        });
        
        return card;
    }

    /**
     * Build the NPC modal
     */
    static buildNPCModal() {
        return UIComponents.createModal({
            id: 'npcModal',
            title: 'NPC Information',
            icon: 'bi-person-circle',
            content: '<div id="npcModalContent"></div>',
            buttons: [
                {
                    label: 'Close',
                    icon: 'bi-x-circle',
                    variant: 'secondary',
                    dismiss: true
                }
            ]
        });
    }

    /**
     * Build the error toast
     */
    static buildErrorToast() {
        const container = document.createElement('div');
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '2000';
        
        const toast = UIComponents.createToast({
            id: 'errorToast',
            message: '',
            variant: 'danger',
            delay: 5000
        });
        
        container.appendChild(toast);
        return container;
    }

    /**
     * Build the tile tooltip
     */
    static buildTileTooltip() {
        const tooltip = document.createElement('div');
        tooltip.id = 'tileTooltip';
        return tooltip;
    }

    /**
     * Build the version footer
     */
    static buildVersionFooter(isGameMode = false) {
        const footer = document.createElement('div');
        
        if (isGameMode) {
            // Game mode footer
            footer.id = 'gameFooter';
            footer.className = 'app-footer';
            footer.innerHTML = `
                <div class="footer-section">
                    <span class="footer-label">Map:</span>
                    <span id="currentMapName" class="footer-value">Loading...</span>
                </div>
                <div class="footer-section town-navigation" id="townNavigation">
                    <label for="townSelect" class="footer-label">🗺️ Go to:</label>
                    <select id="townSelect" class="form-select form-select-sm">
                        <option value="" disabled selected>Select a town...</option>
                    </select>
                    <button id="navigateToTownBtn" class="btn btn-sm btn-success" disabled>
                        <i class="bi bi-compass"></i> Navigate
                    </button>
                </div>
                <div class="footer-section">
                    <span class="footer-label">FPS:</span>
                    <span id="fpsDisplayGame" class="footer-value">--</span>
                </div>
            `;
        } else {
            // Map viewer mode footer
            footer.id = 'mapViewerFooter';
            footer.className = 'app-footer';
            footer.innerHTML = `
                <div class="main-version">Map Viewer v3.0.2 | Loading... | Maps: <span id="mapsCount">0</span> | FPS: <span id="fpsDisplay">--</span></div>
                <div class="modules">Modules: Loading...</div>
            `;
        }
        
        return footer;
    }

    /**
     * Build the loading spinner
     */
    static buildLoadingSpinner() {
        return UIComponents.createSpinner({
            id: 'loading',
            text: 'Loading map data...',
            variant: 'primary'
        });
    }

    /**
     * Build the toggle sidebar button
     */
    static buildSidebarToggle(onClick) {
        const button = document.createElement('button');
        button.id = 'toggleSidebarBtn';
        button.className = 'btn btn-primary sidebar-visible';
        button.textContent = '✕'; // Sidebar visible by default
        
        if (onClick) {
            button.addEventListener('click', onClick);
        }
        
        return button;
    }
}
