// Error handling and display utilities
import { Logger } from './Logger.js';

export const MODULE_VERSION = '1.0.0';

export class ErrorHandler {
    constructor() {
        this.errorElement = null;
        this.toastElement = null;
    }
    
    init() {
        this.errorElement = document.getElementById('errorMessage');
        this.toastElement = document.getElementById('errorToast');
    }
    
    handle(error, context = 'Unknown') {
        const message = error?.message || String(error);
        Logger.error(`Error in ${context}:`, error);
        this.showError(`${context}: ${message}`);
    }
    
    showError(message) {
        Logger.error(message);
        
        if (this.errorElement && this.toastElement) {
            this.errorElement.textContent = message;
            const toast = new bootstrap.Toast(this.toastElement, { delay: 5000 });
            toast.show();
        } else {
            // Fallback if Bootstrap isn't loaded
            alert('Error: ' + message);
        }
    }
}
