#!/usr/bin/env python3
"""
Simple HTTP file server for writing files from VS Code's page context.

Usage:
    python3 file_server.py [--port 3847]

The server accepts POST requests to write files:
    POST /write-file
    Content-Type: application/json
    Body: { "filename": "test.txt", "content": "hello", "workspace_path": "/home/user/project" }

Files are written relative to the workspace_path provided in each request.
"""

import argparse
import json
import logging
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG_FILE = "/tmp/file_server.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("file-server")


class FileServerHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path == "/write-file":
            return self._handle_write_file()
        elif self.path == "/send-chat":
            return self._handle_send_chat()
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "Not found"}')

    def _handle_send_chat(self):
        """Send a message to VS Code Copilot chat via CDP using send-to-chat.js."""
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {}

        text = body.get("text", "")
        if not text:
            self.send_response(400)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "text is required"}')
            return

        cdp_port = body.get("cdp_port", 9333)
        new_chat = body.get("new_chat", True)

        import subprocess

        script_dir = os.path.dirname(os.path.abspath(__file__))
        debug_scripts_dir = os.path.join(os.path.dirname(script_dir), "debug-scripts")
        send_script = os.path.join(debug_scripts_dir, "send-to-chat.js")

        cmd = ["node", send_script, "--port", str(cdp_port)]
        if not new_chat:
            cmd.append("--no-new-chat")

        try:
            result = subprocess.run(
                cmd,
                input=text,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=debug_scripts_dir,
            )
            if result.returncode == 0:
                self.send_response(200)
                self._send_cors_headers()
                self.end_headers()
                # send-to-chat.js outputs JSON on success
                output = result.stdout.strip()
                self.wfile.write(output.encode() if output else b'{"ok": true}')
                logger.info(f"Chat sent via CDP: {text[:80]}")
            else:
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
                err = result.stderr.strip() or result.stdout.strip()
                self.wfile.write(json.dumps({"error": err}).encode())
                logger.error(f"CDP send failed: {err}")
        except subprocess.TimeoutExpired:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "CDP timeout (30s)"}')
        except FileNotFoundError:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "node not found"}')

    def _handle_write_file(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 10 * 1024 * 1024:  # 10 MB limit
            self.send_response(413)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "Payload too large"}')
            return

        raw = self.rfile.read(content_length)
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            self.send_response(400)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "Invalid JSON"}')
            return

        filename = body.get("filename", "")
        content = body.get("content", "")
        workspace_path = body.get("workspace_path", "")

        if not filename:
            self.send_response(400)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "filename is required"}')
            return

        if not workspace_path or not os.path.isdir(workspace_path):
            self.send_response(400)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(
                b'{"error": "workspace_path is required and must be a valid directory"}'
            )
            return

        # Security: prevent path traversal in filename
        safe_name = os.path.basename(filename)
        if safe_name != filename:
            self.send_response(400)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "Invalid filename (no path traversal)"}')
            return

        base_dir = workspace_path
        target = os.path.join(base_dir, safe_name)
        try:
            with open(target, "w", encoding="utf-8") as f:
                f.write(content)
            if safe_name.endswith(".txt"):
                self._add_to_git_exclude(workspace_path, safe_name)
            self.send_response(200)
            self._send_cors_headers()
            self.end_headers()
            resp = json.dumps({"ok": True, "path": target})
            self.wfile.write(resp.encode())
            logger.info(f"Wrote to file {target} this content:\n{content}")
        except OSError as e:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            resp = json.dumps({"error": str(e)})
            self.wfile.write(resp.encode())

    def _add_to_git_exclude(self, workspace_path: str, filename: str) -> None:
        """Append *filename* to .git/info/exclude if the file exists and the
        entry is not already present.  Does nothing when the exclude file is
        absent."""
        exclude_path = os.path.join(workspace_path, ".git", "info", "exclude")
        if not os.path.isfile(exclude_path):
            return
        try:
            with open(exclude_path, "r", encoding="utf-8") as f:
                existing_lines = f.read().splitlines()
            # Check whether any non-comment line already matches the filename.
            if filename in existing_lines:
                logger.info(f"'{filename}' is already in {exclude_path}, skipping.")
                return
            with open(exclude_path, "a", encoding="utf-8") as f:
                # Ensure we start on a new line.
                f.write(f"\n{filename}\n")
            logger.info(f"Added '{filename}' to {exclude_path}")
        except OSError as e:
            logger.warning(f"Could not update {exclude_path}: {e}")

    def log_message(self, format, *args):
        logger.info(args[0])


def main():
    parser = argparse.ArgumentParser(
        description="HTTP file server for VS Code page context"
    )
    parser.add_argument(
        "--port", type=int, default=3847, help="Port to listen on (default: 3847)"
    )
    args = parser.parse_args()

    server = HTTPServer(("127.0.0.1", args.port), FileServerHandler)
    logger.info(f"File server listening on http://127.0.0.1:{args.port}")
    logger.info(f"Log file: {LOG_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
