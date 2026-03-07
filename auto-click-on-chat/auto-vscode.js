// Auto-click "Allow" button in Chat
// This script runs periodically to check for and click the Allow button

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

(function () {
    'use strict';

    // Configuration
    const CHECK_INTERVAL = 500; // Check every 500ms

    // All Allow button selectors
    const BUTTON_SELECTORS = [
        'a[aria-label="Allow (Ctrl+Enter)"]',           // Original Allow button with shortcut
        'a[aria-label="Allow and Review (Ctrl+Enter)"]', // Allow and Review button
        'a[aria-label="Allow and Review Once (Ctrl+Enter)"]', // Allow and Review Once button
        'a[aria-label="Allow Once (Ctrl+Enter)"]',      // Allow Once button
        'a[aria-label="Allow Once"]',                   // Simple Allow Once button (no shortcut)
        'a[aria-label="Allow"]',                          // Simple Allow button (no shortcut)
        'a[aria-label="Allow this tool to run in this session without confirmation."]' // Allow in this Session
    ];

    console.log('===============> Auto-click Allow button script started...');

    // Start trying to add the icon
    waitAndAddIcon();

    // Function to find and click any Allow button
    function findAndClickAllowButton() {
        for (const selector of BUTTON_SELECTORS) {
            const allowButton = document.querySelector(selector);

            if (allowButton) {
                console.log(`Found button [${selector}], clicking...`);
                allowButton.click();
                return true;
            }
        }

        return false;
    }

    // Set up periodic checking
    const intervalId = setInterval(() => {
        const clicked = findAndClickAllowButton();

        if (clicked) {
            console.log('Allow button clicked successfully!');
        }
    }, CHECK_INTERVAL);

    // Optionally, you can stop the script after a certain time or manually
    // Uncomment the following to stop after 5 minutes:
    // setTimeout(() => {
    //     clearInterval(intervalId);
    //     console.log('Auto-click script stopped.');
    // }, 5 * 60 * 1000);

    // Store the interval ID globally so you can stop it manually if needed
    window.allowButtonAutoClicker = {
        intervalId: intervalId,
        stop: function () {
            clearInterval(this.intervalId);
            console.log('Auto-click Allow button script stopped.');
        }
    };

    console.log('To stop the script, run: allowButtonAutoClicker.stop()');
})();


/*
get command that need to allowed to run
// Find the element by its class and get its text content
const messageElement = document.querySelector('.chat-confirmation-widget-message');

// Use .trim() to remove any leading/trailing whitespace
const text = messageElement.textContent.trim();

console.log(text);
*/