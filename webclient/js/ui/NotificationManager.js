/**
 * NotificationManager.js
 * 
 * Manages floating notifications in the top-left corner of the screen
 */

export const MODULE_VERSION = '1.0.0';

export class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.nextId = 0;
        this.initialize();
        
        // Cleanup orphaned notifications periodically
        setInterval(() => this.cleanup(), 5000);
    }

    initialize() {
        // Create notification container
        this.container = document.createElement('div');
        this.container.id = 'notificationContainer';
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }
    
    /**
     * Cleanup orphaned notifications that are not in the DOM
     */
    cleanup() {
        this.notifications = this.notifications.filter(notification => {
            // Check if element is still in the DOM
            if (!notification.element.parentNode) {
                return false; // Remove from array
            }
            return true; // Keep in array
        });
        
        // Also clean up any DOM elements not tracked in our array
        const domNotifications = this.container.querySelectorAll('.notification');
        const trackedIds = new Set(this.notifications.map(n => n.id));
        
        domNotifications.forEach(element => {
            const id = parseInt(element.dataset.id);
            if (!trackedIds.has(id)) {
                // Orphaned DOM element, remove it
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }
        });
    }

    /**
     * Show a notification
     * @param {string} message - The message to display
     * @param {string} type - Type: 'info', 'success', 'warning', 'error'
     * @param {number} duration - Duration in ms (0 = permanent until dismissed)
     * @param {boolean} replaceSameType - If true, dismiss all notifications of same type before showing
     * @returns {number} - Notification ID
     */
    show(message, type = 'info', duration = 3000, replaceSameType = false) {
        // If replaceSameType is true, dismiss all existing notifications of this type
        if (replaceSameType) {
            const existingOfType = this.notifications.filter(n => n.type === type);
            existingOfType.forEach(n => this.dismiss(n.id));
        }
        
        const id = this.nextId++;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.dataset.id = id;
        
        // Icon based on type
        const icons = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'path': '🚶',
            'warp': '🚪',
            'map': '🗺️'
        };
        
        const icon = icons[type] || icons['info'];
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        // Add to container at the top
        this.container.insertBefore(notification, this.container.firstChild);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Store notification
        this.notifications.push({
            id,
            element: notification,
            type,
            message
        });
        
        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(id);
            }, duration);
        }
        
        return id;
    }

    /**
     * Update an existing notification
     * @param {number} id - Notification ID
     * @param {string} message - New message
     */
    update(id, message) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            const messageElement = notification.element.querySelector('.notification-message');
            if (messageElement) {
                messageElement.textContent = message;
                notification.message = message;
            }
        }
    }

    /**
     * Dismiss a notification
     * @param {number} id - Notification ID
     */
    dismiss(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
            const notification = this.notifications[index];
            
            // Check if already being dismissed
            if (notification.element.classList.contains('dismissing')) {
                return;
            }
            
            // Mark as dismissing to prevent duplicate dismissal
            notification.element.classList.add('dismissing');
            
            // Fade out
            notification.element.classList.remove('show');
            
            // Remove after animation
            setTimeout(() => {
                if (notification.element.parentNode) {
                    notification.element.parentNode.removeChild(notification.element);
                }
                // Remove from array (find index again in case array changed)
                const currentIndex = this.notifications.findIndex(n => n.id === id);
                if (currentIndex !== -1) {
                    this.notifications.splice(currentIndex, 1);
                }
            }, 300);
        }
    }

    /**
     * Dismiss all notifications
     */
    dismissAll() {
        const ids = this.notifications.map(n => n.id);
        ids.forEach(id => this.dismiss(id));
    }

    /**
     * Show pathfinding progress
     * @param {number} current - Current step
     * @param {number} total - Total steps
     * @returns {number} - Notification ID
     */
    showPathProgress(current, total) {
        const remaining = total - current;
        const percent = Math.round((current / total) * 100);
        const message = `Walking: ${current}/${total} steps (${percent}%) - ${remaining} remaining`;
        
        // Check if we already have a path progress notification
        const existingPath = this.notifications.find(n => n.type === 'path');
        
        if (existingPath) {
            // Update the existing one
            this.update(existingPath.id, message);
            return existingPath.id;
        } else {
            // Create new path notification, replacing any old ones of same type
            return this.show(message, 'path', 0, true); // replaceSameType = true
        }
    }

    /**
     * Dismiss path progress notification
     */
    dismissPathProgress() {
        // Dismiss ALL path notifications (in case there are duplicates)
        const pathNotifications = this.notifications.filter(n => n.type === 'path');
        pathNotifications.forEach(notification => {
            this.dismiss(notification.id);
        });
    }

    /**
     * Show map transition notification
     * @param {string} mapName - Name of the new map
     */
    showMapTransition(mapName) {
        this.show(`Entered: ${mapName}`, 'map', 2000);
    }

    /**
     * Show warp notification
     * @param {string} fromMap - Source map name
     * @param {string} toMap - Destination map name
     */
    showWarp(fromMap, toMap) {
        this.show(`${fromMap} → ${toMap}`, 'warp', 2000);
    }
}
