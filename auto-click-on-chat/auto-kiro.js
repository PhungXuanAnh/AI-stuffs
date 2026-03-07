// Kiro workbench customizations
// Injected into workbench.html by patch_workbench_html_kiro()
//
// NOTE: The "Run" button auto-click is handled by auto-kiro-webview.js
// (injected into the webview index.html), because the button lives in a
// cross-origin iframe that cannot be reached from the workbench context.

// Function to add custom icon
function addCustomIcon() {
    // Find the action-toolbar-container
    const toolbarContainer = document.querySelector('.action-toolbar-container');
    
    if (toolbarContainer && !document.getElementById('custom-check-icon')) {
        // Create the icon element
        const iconElement = document.createElement('div');
        iconElement.id = 'custom-check-icon';
        iconElement.className = 'action-item menu-entry';
        iconElement.style.cssText = 'display: flex; align-items: center; justify-content: center; cursor: pointer; margin-left: 4px;';
        
        // Create the icon using codicon
        const icon = document.createElement('a');
        icon.className = 'action-label codicon codicon-check';
        icon.style.cssText = 'color: #00ff00; background-color: #000000; padding: 4px; border-radius: 3px;';
        icon.setAttribute('role', 'button');
        icon.setAttribute('aria-label', 'Custom Check Icon');
        
        iconElement.appendChild(icon);
        
        // Find monaco-toolbar and insert the icon before it
        const monacoToolbar = toolbarContainer.querySelector('.monaco-toolbar');
        if (monacoToolbar) {
            monacoToolbar.parentNode.insertBefore(iconElement, monacoToolbar);
            console.log('Custom check icon added successfully!');
            return true;
        }
    }
    return false;
}

// Wait for the DOM to be ready and add the icon
function waitAndAddIcon() {
    const maxAttempts = 50; // Try for up to 25 seconds (50 * 500ms)
    let attempts = 0;
    
    const iconInterval = setInterval(() => {
        attempts++;
        const success = addCustomIcon();
        
        if (success) {
            clearInterval(iconInterval);
            console.log('Custom icon initialization complete');
        } else if (attempts >= maxAttempts) {
            clearInterval(iconInterval);
            console.log('Failed to add custom icon - toolbar not found');
        }
    }, 500);
}

(function() {
    'use strict';
    console.log('===============> Kiro workbench customization script started...');
    waitAndAddIcon();
})();