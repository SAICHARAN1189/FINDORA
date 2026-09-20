# 🤖 Telegram OTP Bot

A simple Telegram bot that generates a secure random 6-digit OTP whenever a user sends `/otp`.

---

## Features

- `/start` — Welcome message with usage instructions.
- `/otp` — Generate a cryptographically secure 6-digit one-time password.
- Graceful handling of unknown commands and errors.

---

## Prerequisites

- **Python 3.9+**
- A **Telegram Bot Token** (see below)

---

## 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot` and follow the prompts to choose a name and username.
3. BotFather will reply with a **bot token** that looks like:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
4. **Copy this token** — you'll need it in the next step.

---

## 2. Set Up the Project

### Clone / navigate to the project folder

```bash
cd telegram_otp_bot
```

### Create and activate a virtual environment

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

---

## 3. Configure the Bot Token

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and replace `your_bot_token_here` with the token from BotFather:
   ```
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

> ⚠️ **Never commit your `.env` file.** It is already listed in `.gitignore`.

---

## 4. Run the Bot

```bash
python bot.py
```

You should see:

```
✅ Telegram OTP bot is running...
```

The bot is now online! Open Telegram and start chatting with it.

---

## 5. Test the Bot

| You send    | Bot replies                                                         |
|-------------|----------------------------------------------------------------------|
| `/start`    | 🤖 Welcome to OTP Bot!<br>Use /otp to generate a random 6-digit OTP. |
| `/otp`      | 🔐 Your OTP is: 004821                                              |
| `/anything` | ❓ Unknown command. Use /otp to generate a one-time password.        |

Each `/otp` call returns a **new**, cryptographically secure 6-digit code (including leading zeros).

---

## Project Structure

```
telegram_otp_bot/
├── bot.py              # Bot logic
├── requirements.txt    # Python dependencies
├── .env.example        # Template for environment variables
├── .gitignore          # Files excluded from version control
└── README.md           # This file
```

---

## License

This project is provided as-is for learning purposes. Feel free to modify and use it however you like.
