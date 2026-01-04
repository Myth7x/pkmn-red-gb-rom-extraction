/**
 * MovementQueue.js
 * 
 * Manages a queue of movement paths across multiple maps.
 * Handles sequential execution of path segments and border crossing transitions.
 */

import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.0';

export class MovementQueue {
    constructor() {
        this.segments = []; // Array of path segments {mapId, path, borderExit, nextMapId}
        this.currentSegmentIndex = 0;
        this.currentPathIndex = 0;
        this.isActive = false;
    }

    /**
     * Initialize the queue with path segments
     * @param {Array} pathSegments - Array of {mapId, path, borderExit, nextMapId}
     */
    initialize(pathSegments) {
        if (!pathSegments || pathSegments.length === 0) {
            Logger.warn('MovementQueue: Cannot initialize with empty path segments');
            this.clear();
            return false;
        }

        this.segments = pathSegments;
        this.currentSegmentIndex = 0;
        this.currentPathIndex = 0;
        this.isActive = true;

        Logger.success(`🚶 Movement queue initialized with ${this.segments.length} segment(s)`);
        this.logCurrentSegment();
        return true;
    }

    /**
     * Get the current path segment
     * @returns {Object|null} Current segment or null if queue is empty
     */
    getCurrentSegment() {
        if (!this.isActive || this.currentSegmentIndex >= this.segments.length) {
            return null;
        }
        return this.segments[this.currentSegmentIndex];
    }

    /**
     * Get the current step in the current path segment
     * @returns {Object|null} {x, y} position or null
     */
    getCurrentStep() {
        const segment = this.getCurrentSegment();
        if (!segment) return null;

        if (this.currentPathIndex >= segment.path.length) {
            return null;
        }

        return segment.path[this.currentPathIndex];
    }

    /**
     * Advance to the next step in the current path
     * @returns {Object|null} Next step {x, y} or null if reached end of segment
     */
    advanceStep() {
        this.currentPathIndex++;
        
        const segment = this.getCurrentSegment();
        if (!segment) return null;

        // Check if reached end of current segment's path
        if (this.currentPathIndex >= segment.path.length) {
            Logger.log(`📍 Reached end of path segment ${this.currentSegmentIndex + 1}/${this.segments.length}`);
            return null;
        }

        return segment.path[this.currentPathIndex];
    }

    /**
     * Check if we need to cross a border (at end of segment path)
     * @returns {Object|null} Border crossing info {direction, connection, nextMapId} or null
     */
    checkBorderCrossing() {
        const segment = this.getCurrentSegment();
        if (!segment) return null;

        // At end of path segment with a border exit
        if (this.currentPathIndex >= segment.path.length && segment.borderExit) {
            return {
                direction: segment.borderExit.direction,
                connection: segment.borderExit.connection,
                nextMapId: segment.nextMapId
            };
        }

        return null;
    }

    /**
     * Advance to the next map segment (after border crossing)
     * @param {number} newMapId - The map we just transitioned to
     * @returns {boolean} True if successfully advanced, false if queue is complete
     */
    advanceToNextMap(newMapId) {
        // Move to next segment
        this.currentSegmentIndex++;
        // Start at index 0 (entry point). Player is teleported here after border crossing.
        // The update loop will see player is already at path[0], call advanceStep(), and continue to path[1]
        this.currentPathIndex = 0;

        if (this.currentSegmentIndex >= this.segments.length) {
            Logger.success('🎉 Movement queue completed!');
            this.clear();
            return false;
        }

        const nextSegment = this.getCurrentSegment();
        
        // Verify we're on the expected map
        if (nextSegment.mapId !== newMapId) {
            Logger.error(`❌ Movement queue map mismatch: expected ${nextSegment.mapId}, got ${newMapId}`);
            this.clear();
            return false;
        }

        Logger.success(`✅ Advanced to segment ${this.currentSegmentIndex + 1}/${this.segments.length} (Map ${nextSegment.mapId})`);
        this.logCurrentSegment();
        return true;
    }

    /**
     * Get the current path for rendering
     * @returns {Array|null} Array of {x, y} positions or null
     */
    getCurrentPath() {
        const segment = this.getCurrentSegment();
        return segment ? segment.path : null;
    }

    /**
     * Get the current path index for rendering
     * @returns {number} Current index in path
     */
    getCurrentPathIndex() {
        return this.currentPathIndex;
    }

    /**
     * Get all segments for visualization
     * @returns {Array} All path segments
     */
    getAllSegments() {
        return this.segments;
    }

    /**
     * Check if queue is active
     * @returns {boolean}
     */
    isQueueActive() {
        return this.isActive && this.currentSegmentIndex < this.segments.length;
    }

    /**
     * Get progress information
     * @returns {Object} {currentSegment, totalSegments, currentStep, totalSteps}
     */
    getProgress() {
        const segment = this.getCurrentSegment();
        return {
            currentSegment: this.currentSegmentIndex + 1,
            totalSegments: this.segments.length,
            currentStep: this.currentPathIndex,
            totalSteps: segment ? segment.path.length : 0,
            mapId: segment ? segment.mapId : null,
            mapName: segment ? segment.mapName : null
        };
    }

    /**
     * Clear the queue
     */
    clear() {
        this.segments = [];
        this.currentSegmentIndex = 0;
        this.currentPathIndex = 0;
        this.isActive = false;
        Logger.log('🧹 Movement queue cleared');
    }

    /**
     * Log current segment info for debugging
     */
    logCurrentSegment() {
        const segment = this.getCurrentSegment();
        if (segment) {
            const borderInfo = segment.borderExit 
                ? `→ ${segment.borderExit.direction} to map ${segment.nextMapId}` 
                : '(final)';
            Logger.log(`  📍 Segment ${this.currentSegmentIndex + 1}/${this.segments.length}: Map ${segment.mapId} (${segment.mapName}) - ${segment.path.length} steps ${borderInfo}`);
        }
    }

    /**
     * Get border crossing movement for when we reach end of a segment
     * This returns the movement direction needed to trigger the boundary crossing
     * @returns {Object|null} {direction, dx, dy} or null
     */
    getBorderCrossingMovement() {
        const borderInfo = this.checkBorderCrossing();
        if (!borderInfo) return null;

        const direction = borderInfo.direction;
        let dx = 0, dy = 0;

        switch (direction) {
            case 'north':
                dy = -1;
                break;
            case 'south':
                dy = 1;
                break;
            case 'west':
                dx = -1;
                break;
            case 'east':
                dx = 1;
                break;
        }

        return { direction, dx, dy };
    }
}
