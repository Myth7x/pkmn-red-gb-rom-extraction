/**
 * Progress Bar Module
 * A reusable console progress bar with customizable display
 */

class ProgressBar {
  constructor(options = {}) {
    this.total = options.total || 100;
    this.current = 0;
    this.width = options.width || 40;
    this.completeChar = options.completeChar || '█';
    this.incompleteChar = options.incompleteChar || '░';
    this.title = options.title || 'Progress';
    this.showPercentage = options.showPercentage !== false;
    this.showCount = options.showCount !== false;
    this.showETA = options.showETA !== false;
    
    this.startTime = Date.now();
    this.lastUpdate = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.currentItem = '';
    
    // Clear mode - if true, clears the line before writing
    this.clearLine = options.clearLine !== false;
  }

  /**
   * Update the progress bar
   */
  update(current, item = '') {
    this.current = current;
    this.currentItem = item;
    this.render();
  }

  /**
   * Increment progress by 1
   */
  increment(item = '') {
    this.current++;
    this.currentItem = item;
    this.render();
  }

  /**
   * Mark current item as success
   */
  success(item = '') {
    this.successCount++;
    this.current++;
    this.currentItem = item;
    this.render();
  }

  /**
   * Mark current item as error
   */
  error(item = '', errorMsg = '') {
    this.errorCount++;
    this.current++;
    this.currentItem = item;
    
    // Print error on new line
    if (this.clearLine) {
      process.stdout.write('\r\x1b[K');
    }
    console.log(`\x1b[31m✗\x1b[0m ${item}${errorMsg ? ` - ${errorMsg}` : ''}`);
    
    this.render();
  }

  /**
   * Log a success message without incrementing
   */
  logSuccess(message) {
    if (this.clearLine) {
      process.stdout.write('\r\x1b[K');
    }
    console.log(`\x1b[32m✓\x1b[0m ${message}`);
  }

  /**
   * Log an info message
   */
  logInfo(message) {
    if (this.clearLine) {
      process.stdout.write('\r\x1b[K');
    }
    console.log(`\x1b[36mℹ\x1b[0m ${message}`);
  }

  /**
   * Calculate estimated time remaining
   */
  getETA() {
    if (this.current === 0) return 'calculating...';
    
    const elapsed = Date.now() - this.startTime;
    const rate = elapsed / this.current;
    const remaining = (this.total - this.current) * rate;
    
    if (remaining < 1000) return '< 1s';
    if (remaining < 60000) return `${Math.round(remaining / 1000)}s`;
    return `${Math.round(remaining / 60000)}m ${Math.round((remaining % 60000) / 1000)}s`;
  }

  /**
   * Render the progress bar to console
   */
  render() {
    const percent = Math.min(100, Math.round((this.current / this.total) * 100));
    const filled = Math.round((this.width * this.current) / this.total);
    const empty = this.width - filled;
    
    // Build progress bar
    const bar = this.completeChar.repeat(filled) + this.incompleteChar.repeat(empty);
    
    // Build status parts
    const parts = [];
    
    // Title
    parts.push(`\x1b[1m${this.title}:\x1b[0m`);
    
    // Bar
    parts.push(`[\x1b[36m${bar}\x1b[0m]`);
    
    // Percentage
    if (this.showPercentage) {
      parts.push(`${percent}%`);
    }
    
    // Count
    if (this.showCount) {
      parts.push(`${this.current}/${this.total}`);
    }
    
    // Success/Error counts
    if (this.successCount > 0 || this.errorCount > 0) {
      const stats = [];
      if (this.successCount > 0) {
        stats.push(`\x1b[32m✓${this.successCount}\x1b[0m`);
      }
      if (this.errorCount > 0) {
        stats.push(`\x1b[31m✗${this.errorCount}\x1b[0m`);
      }
      parts.push(`(${stats.join(' ')})`);
    }
    
    // ETA
    if (this.showETA && this.current > 0 && this.current < this.total) {
      parts.push(`ETA: ${this.getETA()}`);
    }
    
    // Current item
    if (this.currentItem) {
      const maxItemLength = 30;
      const item = this.currentItem.length > maxItemLength 
        ? this.currentItem.substring(0, maxItemLength - 3) + '...'
        : this.currentItem;
      parts.push(`- ${item}`);
    }
    
    // Build final output
    const output = parts.join(' ');
    
    // Clear line and write
    if (this.clearLine) {
      process.stdout.write('\r\x1b[K' + output);
    } else {
      console.log(output);
    }
  }

  /**
   * Complete the progress bar
   */
  complete(message = '') {
    this.current = this.total;
    this.render();
    
    // Move to new line
    process.stdout.write('\n');
    
    if (message) {
      console.log(`\x1b[32m✓ ${message}\x1b[0m`);
    }
  }

  /**
   * Reset the progress bar
   */
  reset() {
    this.current = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.currentItem = '';
    this.startTime = Date.now();
  }

  /**
   * Print a separator line
   */
  static separator(char = '=', length = 60) {
    console.log(char.repeat(length));
  }

  /**
   * Print a header
   */
  static header(text, char = '=', length = 60) {
    console.log('\n' + char.repeat(length));
    console.log(text);
    console.log(char.repeat(length));
  }

  /**
   * Print a section title
   */
  static section(text) {
    console.log(`\n\x1b[1m${text}\x1b[0m`);
  }
}

export default ProgressBar;
