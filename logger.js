/**
 * Centralized logging and error tracking utility.
 * Handles errors and rejections in both main thread and Web Workers.
 */
(function(global) {
  const Logger = {
    /**
     * Logs an error to the console and could be extended to send to an external tracking service.
     * @param {string} message - The error message or context.
     * @param {Error|any} error - The error object or additional data.
     */
    error(message, error) {
      console.error(`[ERROR] ${message}`, error);
      // Future: sendToErrorTrackingService(message, error);
    },

    /**
     * Logs an information message.
     * @param {string} message
     */
    info(message) {
      console.info(`[INFO] ${message}`);
    }
  };

  // Attach to global scope
  global.Logger = Logger;

  // Global error handling with addEventListener for better compatibility
  if (typeof window !== 'undefined') {
    // Main Thread
    window.addEventListener('error', function(event) {
      Logger.error('Uncaught Error:', {
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    window.addEventListener('unhandledrejection', function(event) {
      Logger.error('Unhandled Promise Rejection:', event.reason);
    });
  } else if (typeof self !== 'undefined') {
    // Web Worker
    self.addEventListener('error', function(event) {
      Logger.error('Worker Uncaught Error:', {
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    self.addEventListener('unhandledrejection', function(event) {
      Logger.error('Worker Unhandled Promise Rejection:', event.reason);
    });
  }

  // Export for environments that support it (optional, for tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
  }
})(typeof window !== 'undefined' ? window : self);
