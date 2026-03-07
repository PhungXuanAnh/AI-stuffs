#!/usr/bin/env bash
# patch_workbench_html.sh — Inject custom JavaScript into VS Code-based IDE HTML files
#
# This replicates what the "Reload Custom CSS and JS" extension command does,
# but entirely from the shell. Uses temp files to safely handle JS content
# containing backticks, $, and other special shell characters.
#
# Supports: VSCode, Kiro, Antigravity, Windsurf
#
# Usage:
#   source /path/to/patch_workbench_html.sh
#   patch_workbench_html <html_file_path> <js_file_path>
#   patch_workbench_html_vscode
#   patch_workbench_html_kiro
#   patch_webview_html_kiro
#   patch_workbench_html_antigravity
#   patch_workbench_html_windsurf

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-${(%):-%x}}")" && pwd)"

# ============================================================================
# Base function: patch any HTML file with a JS file
# ============================================================================
# Usage: patch_workbench_html <workbench_html_path> <custom_js_file_path>
patch_workbench_html() {
    local WORKBENCH_HTML="$1"
    local CUSTOM_JS_FILE="$2"

    if [ ! -f "$WORKBENCH_HTML" ]; then
        echo "ERROR: Workbench HTML not found at $WORKBENCH_HTML"
        return 1
    fi
    if [ ! -f "$CUSTOM_JS_FILE" ]; then
        echo "ERROR: Custom JS file not found at $CUSTOM_JS_FILE"
        return 1
    fi

    echo "Patching $WORKBENCH_HTML with $CUSTOM_JS_FILE ..."

    # 1. Remove any existing custom CSS/JS patches (idempotent)
    sudo sed -i '/<!-- !! VSCODE-CUSTOM-CSS-SESSION-ID/d' "$WORKBENCH_HTML"
    sudo sed -i '/<!-- !! VSCODE-CUSTOM-CSS-START !! -->/,/<!-- !! VSCODE-CUSTOM-CSS-END !! -->/d' "$WORKBENCH_HTML"

    # 2. Remove Content-Security-Policy meta tag to allow injected scripts
    #    (the tag may span multiple lines, so we use perl for multi-line matching)
    #    NOTE: \/? handles both self-closing tags (/>)  and normal tags (>)
    #    VSCode/Antigravity/Windsurf use self-closing (/>) while Kiro webview uses normal (>)
    sudo perl -i -0pe 's/<meta\s[^>]*http-equiv="Content-Security-Policy"[^>]*\/?>//gs' "$WORKBENCH_HTML"

    # 3. Generate a session UUID
    local SESSION_UUID
    SESSION_UUID=$(cat /proc/sys/kernel/random/uuid)

    # 4. Build the injection block in a temp file (avoids shell expansion issues
    #    with backticks, $, etc. in the JS content)
    local INJECT_TMP
    INJECT_TMP=$(mktemp)
    {
        echo "<!-- !! VSCODE-CUSTOM-CSS-SESSION-ID ${SESSION_UUID} !! -->"
        echo "<!-- !! VSCODE-CUSTOM-CSS-START !! -->"
        echo -n "<script>"
        cat "$CUSTOM_JS_FILE"
        echo "</script>"
        echo "<!-- !! VSCODE-CUSTOM-CSS-END !! -->"
    } > "$INJECT_TMP"

    # 5. Inject the block before </html> using awk + temp file (reads injection
    #    content from INJECT_TMP so no shell variable expansion occurs)
    local OUTPUT_TMP
    OUTPUT_TMP=$(mktemp)
    sudo awk '
        /<\/html>/ {
            while ((getline line < "'"$INJECT_TMP"'") > 0) print line
        }
        { print }
    ' "$WORKBENCH_HTML" > "$OUTPUT_TMP" \
        && sudo mv "$OUTPUT_TMP" "$WORKBENCH_HTML"

    rm -f "$INJECT_TMP" "$OUTPUT_TMP"

    echo "Workbench HTML patched successfully."
}

# ============================================================================
# IDE-specific wrapper functions
# ============================================================================

patch_workbench_html_vscode() {
    patch_workbench_html \
        "/usr/share/code/resources/app/out/vs/code/electron-browser/workbench/workbench.html" \
        "${SCRIPT_DIR}/auto-vscode.js"
}

patch_workbench_html_kiro() {
    patch_workbench_html \
        "/usr/share/kiro/resources/app/out/vs/code/electron-browser/workbench/workbench.html" \
        "${SCRIPT_DIR}/auto-kiro.js"
}

patch_webview_html_kiro() {
    patch_workbench_html \
        "/usr/share/kiro/resources/app/out/vs/workbench/contrib/webview/browser/pre/index.html" \
        "${SCRIPT_DIR}/auto-kiro-webview.js"
}

patch_workbench_html_antigravity() {
    patch_workbench_html \
        "/usr/share/antigravity/resources/app/out/vs/code/electron-browser/workbench/workbench.html" \
        "${SCRIPT_DIR}/auto-antigravity.js"
}

patch_workbench_html_windsurf() {
    patch_workbench_html \
        "/usr/share/windsurf/resources/app/out/vs/code/electron-browser/workbench/workbench.html" \
        "${SCRIPT_DIR}/auto-windsurf.js"
}
