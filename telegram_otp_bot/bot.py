"""
Telegram OTP Bot - Findora Integration
Uses raw urllib for Telegram API (avoids httpx/anyio TLS issues on Windows).
Runs a background polling thread + aiohttp HTTP server.
"""

import os
import sys
import json
import secrets
import string
import logging
import threading
import time
import asyncio
import urllib.request
import urllib.error

from aiohttp import web
from dotenv import load_dotenv

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
HTTP_PORT = int(os.getenv("BOT_HTTP_PORT", "8080"))
BASE_URL = f"https://api.telegram.org/bot{TOKEN}"

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------
link_codes: dict[str, int] = {}
linked_accounts: dict[int, str] = {}

# ---------------------------------------------------------------------------
# Raw Telegram API helpers (urllib - works on Windows)
# ---------------------------------------------------------------------------
def tg_call(method: str, params: dict | None = None, timeout: int = 8) -> dict:
    """Call Telegram Bot API using urllib."""
    url = f"{BASE_URL}/{method}"
    data = json.dumps(params or {}).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def tg_send(chat_id: int, text: str) -> None:
    """Send a text message to a Telegram chat."""
    try:
        tg_call("sendMessage", {"chat_id": chat_id, "text": text}, timeout=6)
        logger.info("Sent message to chat_id %s", chat_id)
    except Exception as e:
        logger.warning("Could not send Telegram message to %s: %s", chat_id, e)
        print(f"\n========================================")
        print(f"📢 [TELEGRAM OTP NOTIFICATION] Chat ID: {chat_id}")
        print(text)
        print(f"========================================\n", flush=True)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _generate_link_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    part1 = "".join(secrets.choice(alphabet) for _ in range(4))
    part2 = "".join(secrets.choice(alphabet) for _ in range(4))
    return f"{part1}-{part2}"

# ---------------------------------------------------------------------------
# Update handlers
# ---------------------------------------------------------------------------
def handle_start(chat_id: int) -> None:
    if chat_id in linked_accounts:
        tg_send(chat_id,
            "Your Telegram is already linked to Findora!\n"
            "You will receive locker OTPs here automatically.\n\n"
            "Send /status to check your link."
        )
        return

    # Invalidate old codes for this chat
    for code, cid in list(link_codes.items()):
        if cid == chat_id:
            del link_codes[code]

    code = _generate_link_code()
    link_codes[code] = chat_id
    logger.info("Issued link code %s for chat_id %s", code, chat_id)

    tg_send(chat_id,
        "Findora Account Linking\n\n"
        "Steps to link your Telegram with Findora:\n\n"
        f"1) Copy your link code:\n    {code}\n\n"
        "2) Open Findora app\n"
        "3) Go to Profile -> Link Telegram Account\n"
        "4) Paste the code and click Link\n\n"
        "This code expires once used. Send /start for a new one."
    )


def handle_otp(chat_id: int) -> None:
    code = f"{secrets.randbelow(1_000_000):06d}"
    tg_send(chat_id, f"Your OTP is: {code}\n\nEnter this code on the locker keypad.")
    # Sync with Findora backend for ESP32 keypad verification
    try:
        data = json.dumps({"otp": code, "chat_id": chat_id}).encode('utf-8')
        req = urllib.request.Request("http://127.0.0.1:3001/api/v1/box/register-otp", data=data, headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=3)
        logger.info("Registered OTP %s with backend", code)
    except Exception as e:
        logger.warning("Could not register OTP with backend: %s", e)


def handle_status(chat_id: int) -> None:
    if chat_id in linked_accounts:
        uid = linked_accounts[chat_id]
        tg_send(chat_id,
            f"Status: Linked\nFindora account: {uid}\n"
            "You will receive locker OTPs here."
        )
    else:
        tg_send(chat_id, "Status: Not linked\nSend /start to get a link code.")


def handle_unknown(chat_id: int) -> None:
    tg_send(chat_id,
        "Unknown command.\n\n"
        "Available:\n"
        "/start  - Link your Findora account\n"
        "/otp    - Generate a standalone OTP\n"
        "/status - Check link status"
    )


def process_update(update: dict) -> None:
    """Dispatch an incoming Telegram update to the right handler."""
    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return
    chat_id = msg["chat"]["id"]
    text = msg.get("text", "")

    if text.startswith("/start"):
        handle_start(chat_id)
    elif text.startswith("/otp"):
        handle_otp(chat_id)
    elif text.startswith("/status"):
        handle_status(chat_id)
    elif text.startswith("/"):
        handle_unknown(chat_id)

# ---------------------------------------------------------------------------
# Polling thread (background)
# ---------------------------------------------------------------------------
_stop_polling = threading.Event()

def polling_loop() -> None:
    """Long-poll Telegram for updates in a background thread."""
    offset = 0
    logger.info("[POLLING] Starting Telegram long-poll...")

    while not _stop_polling.is_set():
        try:
            result = tg_call("getUpdates", {
                "offset": offset,
                "timeout": 20,
                "allowed_updates": ["message"],
            })
            for update in result.get("result", []):
                offset = update["update_id"] + 1
                try:
                    process_update(update)
                except Exception as e:
                    logger.error("Error handling update: %s", e)
        except urllib.error.URLError as e:
            logger.warning("[POLLING] Network error: %s — retrying in 5s", e)
            time.sleep(5)
        except Exception as e:
            logger.error("[POLLING] Unexpected error: %s — retrying in 5s", e)
            time.sleep(5)

    logger.info("[POLLING] Stopped.")

# ---------------------------------------------------------------------------
# HTTP API (called by Findora backend, async aiohttp)
# ---------------------------------------------------------------------------
async def http_resolve_link(request: web.Request) -> web.Response:
    code = request.rel_url.query.get("code", "").upper().strip()
    if not code:
        return web.json_response({"error": "Link code required"}, status=400)
    if code in link_codes:
        chat_id = link_codes.pop(code)
        return web.json_response({"chat_id": chat_id})
    if code == "DEMO-1234" or code.startswith("DEMO-"):
        return web.json_response({"chat_id": 999888777})
    return web.json_response({"error": "Invalid or expired link code (or use DEMO-1234 for testing)"}, status=404)


async def http_link_confirm(request: web.Request) -> web.Response:
    data = await request.json()
    chat_id = data.get("chat_id")
    uid = data.get("uid")
    if not chat_id or not uid:
        return web.json_response({"error": "chat_id and uid required"}, status=400)

    linked_accounts[int(chat_id)] = uid

    # Send confirmation in background (tg_send uses urllib - blocking, run in executor)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, tg_send, int(chat_id),
        "Findora account linked successfully!\n\n"
        "You will now receive smart locker OTPs here "
        "whenever an item is ready for collection."
    )
    return web.json_response({"ok": True})


async def http_send_otp(request: web.Request) -> web.Response:
    data = await request.json()
    chat_id = data.get("chat_id")
    otp = data.get("otp")
    item = data.get("item", "your item")
    locker = data.get("locker", "the locker")

    if not chat_id or not otp:
        return web.json_response({"error": "chat_id and otp required"}, status=400)

    msg = (
        f"Item Ready for Collection!\n\n"
        f"Item: {item}\n"
        f"Locker: {locker}\n\n"
        f"Your OTP: {otp}\n\n"
        f"Valid for 10 minutes.\n"
        f"Enter this code in the Findora app to unlock the locker."
    )
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, tg_send, int(chat_id), msg)
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def http_health(request: web.Request) -> web.Response:
    return web.json_response({
        "status": "ok",
        "linked_accounts": len(linked_accounts),
        "pending_link_codes": len(link_codes),
    })


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    if not TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN is not set in .env")
        sys.exit(1)

    # Verify token works before starting
    try:
        me = tg_call("getMe", timeout=5)
        bot_name = me.get("result", {}).get("first_name", "Bot")
        bot_username = me.get("result", {}).get("username", "Unknown")
        print(f"[BOT] Connected to Telegram as: {bot_name} (@{bot_username})")
    except Exception as e:
        print(f"[BOT] ⚠️ Warning: Telegram API unreachable ({e}).")
        print("[BOT] Running HTTP API in resilient mode (OTPs and alerts will log locally).")
        print("[BOT] If your network blocks Telegram, connect via VPN/proxy to enable real-time Telegram messages.")

    # Start polling in background thread
    poll_thread = threading.Thread(target=polling_loop, daemon=True)
    poll_thread.start()
    print("[BOT] Telegram polling thread started")

    # Build and run aiohttp HTTP server
    web_app = web.Application()
    web_app.router.add_get("/health", http_health)
    web_app.router.add_get("/resolve-link", http_resolve_link)
    web_app.router.add_post("/link-confirm", http_link_confirm)
    web_app.router.add_post("/send-otp", http_send_otp)

    print(f"[BOT] HTTP API starting on http://localhost:{HTTP_PORT}")
    print(f"[BOT]   GET  /health")
    print(f"[BOT]   GET  /resolve-link?code=XXXX-XXXX")
    print(f"[BOT]   POST /link-confirm")
    print(f"[BOT]   POST /send-otp")

    web.run_app(web_app, host="0.0.0.0", port=HTTP_PORT)


if __name__ == "__main__":
    main()

