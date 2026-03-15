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

// ============================================================================
// Custom Prompt Button — red arrow button left of Send
// ============================================================================

var FILE_SERVER_PORT = 3847;

function getWorkspacePath() {
    // Extract workspace path from SCM data-uri (most reliable)
    var scmEditor = document.querySelector('.monaco-editor[data-uri*="vscode-scm"]');
    if (scmEditor) {
        var uri = scmEditor.getAttribute('data-uri');
        var match = uri.match(/rootUri%3D(.+)/);
        if (match) {
            var decoded = decodeURIComponent(decodeURIComponent(match[1]));
            // decoded is like file:///home/user/repo/project
            return decoded.replace(/^file:\/\//, '');
        }
    }
    // Fallback: extract from file editor data-uri
    var fileEditor = document.querySelector('.monaco-editor[data-uri^="file:///"]');
    if (fileEditor) {
        var fileUri = fileEditor.getAttribute('data-uri');
        var filePath = fileUri.replace(/^file:\/\//, '');
        // Return parent directory
        return filePath.substring(0, filePath.lastIndexOf('/'));
    }
    return '';
}

function writeFileViaServer(filename, content) {
    var workspacePath = getWorkspacePath();
    return fetch('http://127.0.0.1:' + FILE_SERVER_PORT + '/write-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename, content: content, workspace_path: workspacePath })
    }).then(function (r) { return r.json(); });
}

function showPromptPopup() {
    // Remove existing popup if open
    var existing = document.getElementById('custom-prompt-popup');
    if (existing) { existing.parentNode.removeChild(existing); }

    // Non-modal floating window (no overlay — user can interact with VS Code)
    var dialog = document.createElement('div');
    dialog.id = 'custom-prompt-popup';
    dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e1e1e;border:1px solid #555;border-radius:8px;padding:0;width:500px;max-width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:99999;display:flex;flex-direction:column;resize:both;overflow:auto;min-width:300px;min-height:200px;';

    // Title bar (draggable)
    var titleBar = document.createElement('div');
    titleBar.textContent = 'Enter prompt for Copilot';
    titleBar.style.cssText = 'color:#ccc;font-size:13px;padding:10px 16px;font-family:system-ui,sans-serif;cursor:move;border-bottom:1px solid #444;user-select:none;flex-shrink:0;';

    // Drag support
    var isDragging = false, dragX = 0, dragY = 0;
    titleBar.addEventListener('mousedown', function (e) {
        isDragging = true;
        dragX = e.clientX - dialog.offsetLeft;
        dragY = e.clientY - dialog.offsetTop;
        // Remove the centered transform once dragging starts
        dialog.style.transform = 'none';
        e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        dialog.style.left = (e.clientX - dragX) + 'px';
        dialog.style.top = (e.clientY - dragY) + 'px';
    });
    document.addEventListener('mouseup', function () { isDragging = false; });

    // Body
    var body = document.createElement('div');
    body.style.cssText = 'padding:12px 16px;flex:1;display:flex;flex-direction:column;';

    var textarea = document.createElement('textarea');
    textarea.style.cssText = 'width:100%;height:120px;background:#2d2d2d;color:#eee;border:1px solid #555;border-radius:4px;padding:8px;font-size:13px;font-family:system-ui,sans-serif;resize:none;box-sizing:border-box;flex:1;';
    textarea.placeholder = 'Type your prompt here...';

    // Error message area (hidden by default)
    var errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'color:#ff4444;font-size:12px;margin-top:6px;font-family:system-ui,sans-serif;display:none;';

    // Button bar
    var btnBar = document.createElement('div');
    btnBar.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid #444;flex-shrink:0;';

    function makeBtn(label, primary) {
        var b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'padding:6px 16px;border-radius:4px;font-size:13px;font-family:system-ui,sans-serif;cursor:pointer;border:1px solid ' + (primary ? '#0078d4' : '#555') + ';background:' + (primary ? '#0078d4' : 'transparent') + ';color:' + (primary ? '#fff' : '#ccc') + ';';
        b.addEventListener('mouseenter', function () { b.style.opacity = '0.85'; });
        b.addEventListener('mouseleave', function () { b.style.opacity = '1'; });
        return b;
    }

    var cancelBtn = makeBtn('Cancel', false);
    var submitBtn = makeBtn('Submit', true);

    function close() { if (dialog.parentNode) dialog.parentNode.removeChild(dialog); }

    function submit() {
        var text = textarea.value.trim();
        if (!text) return;
        errorDiv.style.display = 'none';
        // Write to file only
        writeFileViaServer('user_feedback_and_next_task.txt', text)
            .then(function (resp) {
                if (resp && resp.error) {
                    errorDiv.textContent = 'Server error: ' + resp.error;
                    errorDiv.style.display = 'block';
                    return;
                }
                console.log('Wrote user_feedback_and_next_task.txt');
                close();
            })
            .catch(function (err) {
                errorDiv.textContent = 'Connection error: Could not reach file server at port ' + FILE_SERVER_PORT + '. Is it running?';
                errorDiv.style.display = 'block';
                console.error('File write failed:', err);
            });
    }

    cancelBtn.addEventListener('click', close);
    submitBtn.addEventListener('click', submit);

    // Esc to close
    textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    body.appendChild(textarea);
    body.appendChild(errorDiv);
    btnBar.appendChild(cancelBtn);
    btnBar.appendChild(submitBtn);
    dialog.appendChild(titleBar);
    dialog.appendChild(body);
    dialog.appendChild(btnBar);
    document.body.appendChild(dialog);

    setTimeout(function () { textarea.focus(); }, 50);
}

function addCustomPromptButton() {
    var toolbar = document.querySelector('.chat-execute-toolbar');
    if (!toolbar || document.getElementById('custom-prompt-btn')) return false;

    var li = document.createElement('li');
    li.className = 'action-item menu-entry';
    li.setAttribute('role', 'presentation');
    li.id = 'custom-prompt-btn';

    var btn = document.createElement('a');
    btn.className = 'action-label codicon codicon-arrow-up';
    btn.style.cssText = 'color: #ff4444 !important; cursor: pointer;';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Send custom prompt');
    btn.setAttribute('tabindex', '0');

    btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showPromptPopup();
    });

    li.appendChild(btn);

    var ul = toolbar.querySelector('ul.actions-container');
    if (ul && ul.firstChild) {
        ul.insertBefore(li, ul.firstChild);
        console.log('Custom prompt button (red) added successfully');
        return true;
    }
    return false;
}

function waitAndAddPromptButton() {
    // Keep checking periodically — VS Code may re-render the toolbar and remove our button
    setInterval(function () {
        addCustomPromptButton();
    }, 2000);
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

    // Start trying to add the custom prompt button (red arrow)
    waitAndAddPromptButton();

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