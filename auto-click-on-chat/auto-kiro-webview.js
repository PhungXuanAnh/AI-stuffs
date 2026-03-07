// Auto-click "Run" button in Kiro Chat
// This script is injected into the webview index.html by patch_workbench_html
// It runs inside the webview host (same origin as active-frame), so it can
// access the Kiro UI DOM via contentDocument

(function() {
    'use strict';

    // Only activate for the Kiro Agent webview
    var params = new URLSearchParams(window.location.search);
    if (params.get('extensionId') !== 'kiro.kiroAgent') return;

    var CHECK_INTERVAL = 500;

    function getActiveFrameDocument() {
        var frame = document.getElementById('active-frame');
        if (!frame) return null;
        try { return frame.contentDocument; } catch(e) { return null; }
    }

    function findAndClickRunButton() {
        var doc = getActiveFrameDocument();
        if (!doc) return false;
        var candidates = doc.querySelectorAll('button.kiro-button[data-variant="primary"][data-purpose="alert"]');
        var btn = Array.from(candidates).find(function(b) {
            return b.textContent.trim().indexOf('Run') !== -1;
        });
        if (btn) {
            btn.click();
            console.log('[auto-kiro] Run button clicked!');
            return true;
        }
        return false;
    }

    console.log('[auto-kiro] Auto-click script loaded in kiro.kiroAgent webview');

    var intervalId = setInterval(findAndClickRunButton, CHECK_INTERVAL);

    // Allow stopping via console
    window.__autoKiroStop = function() {
        clearInterval(intervalId);
        console.log('[auto-kiro] Stopped.');
    };
})();
