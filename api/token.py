from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import datetime, timedelta, timezone

from google import genai


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            client = genai.Client(
                api_key=os.environ.get("GEMINI_API_KEY"),
                http_options={"api_version": "v1alpha"},
            )

            now = datetime.now(tz=timezone.utc)
            expire_time = now + timedelta(minutes=30)

            token = client.auth_tokens.create(
                config={
                    "uses": 1,
                    "expire_time": expire_time.isoformat(),
                    "new_session_expire_time": (
                        now + timedelta(minutes=1)
                    ).isoformat(),
                    "http_options": {"api_version": "v1alpha"},
                }
            )

            body = json.dumps(
                {"token": token.name, "expires_at": expire_time.isoformat()}
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body.encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
