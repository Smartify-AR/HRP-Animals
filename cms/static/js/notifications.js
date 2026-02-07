// Notification system for HTMX and general use

document.addEventListener('DOMContentLoaded', function() {
    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        if (!alert.classList.contains('alert-permanent')) {
            setTimeout(() => {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }, 5000);
        }
    });
    
    // HTMX response handling
    document.body.addEventListener('htmx:afterSwap', function(event) {
        // Show flash messages from response
        if (event.detail.target.innerHTML.includes('alert')) {
            // Flash messages are already in the DOM
        }
    });
    
    // Handle form validation errors
    document.body.addEventListener('htmx:responseError', function(event) {
        console.error('HTMX Error:', event.detail);
        // Could show error notification here
    });
});

// Show toast notification (if Bootstrap toasts are added)
function showToast(message, type = 'info') {
    // Placeholder for toast notifications
    console.log(`[${type}] ${message}`);
}

