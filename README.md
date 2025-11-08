
# URL Uploader - Telegram Mini App

This project contains the frontend for a Telegram Mini App that allows users to submit a URL. It's built with React, TypeScript, and Tailwind CSS.

This guide provides a complete walkthrough for setting up both the frontend and the required Python/FastAPI backend, and deploying the backend to Render.com for free.

## Table of Contents

1.  [How It Works](#how-it-works)
2.  [Frontend Setup (This App)](#frontend-setup-this-app)
3.  [Backend Setup (Python + FastAPI)](#backend-setup-python--fastapi)
    -   [Prerequisites](#prerequisites)
    -   [Local Setup](#local-setup)
    -   [Backend Code](#backend-code)
4.  [Deploying the Backend to Render.com](#deploying-the-backend-to-rendercom)
    -   [Step 1: Push to GitHub](#step-1-push-to-github)
    -   [Step 2: Create a New Web Service on Render](#step-2-create-a-new-web-service-on-render)
    -   [Step 3: Configure the Service](#step-3-configure-the-service)
    -   [Step 4: Add Environment Variable](#step-4-add-environment-variable)
    -   [Step 5: Deploy!](#step-5-deploy)
5.  [Connecting Frontend and Backend](#connecting-frontend-and-backend)
6.  [Setting up the Telegram Mini App](#setting-up-the-telegram-mini-app)

## How It Works

1.  A user opens the Mini App inside Telegram.
2.  The React frontend loads, presenting a simple UI to enter a URL.
3.  The user types a URL and presses the "Submit" button (which is a native Telegram UI button).
4.  The frontend sends the URL and the user's `initData` to your FastAPI backend.
5.  The backend validates the `initData` to ensure the request is genuinely from Telegram.
6.  The backend processes the URL (in our example, it just sends a confirmation message back to the user via the bot API).
7.  The Mini App shows a success message and closes.

## Frontend Setup (This App)

This React application is ready to be used. To run it locally for development or testing, you would typically use a development server like Vite or Create React App.

*   **index.html**: The entry point, loads Tailwind CSS and the Telegram Web App script.
*   **App.tsx**: The main application component with all the UI and logic.
*   **types.ts**: TypeScript definitions for the Telegram Web App object for type safety.

## Backend Setup (Python + FastAPI)

The frontend needs a backend to send the URL to. Here’s how to create a simple and secure one using FastAPI.

### Prerequisites

*   Python 3.7+
*   A Telegram Bot Token. Get one from [@BotFather](httpss://t.me/BotFather) on Telegram.

### Local Setup

1.  **Create a Project Directory:**
    ```bash
    mkdir my-telegram-bot-backend
    cd my-telegram-bot-backend
    ```

2.  **Create a Virtual Environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Create `requirements.txt`:**
    Create a file named `requirements.txt` and add the following lines:
    ```
    fastapi
    uvicorn[standard]
    httpx
    ```

4.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

### Backend Code

Create a file named `main.py` and paste the following code into it. This code sets up a secure endpoint that validates requests from Telegram.

```python
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
from urllib.parse import parse_qs, unquote
import hmac
import hashlib
import json

app = FastAPI()

# --- CORS Configuration ---
# You should restrict this to the actual origin of your Mini App in production
origins = ["*"] # For development, allow all.

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# It's crucial to get the bot token from environment variables for security.
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")

class URLPayload(BaseModel):
    url: str

def validate_init_data(init_data: str, bot_token: str) -> dict | None:
    """Validates the initData string from the Telegram Mini App."""
    try:
        # The initData is URL-encoded.
        unquoted_data = unquote(init_data)
        
        # Split data into hash and other params
        data_parts = sorted([
            part.split('=', 1) for part in unquoted_data.split('&') 
            if part.split('=', 1)[0] != 'hash'
        ])
        
        data_check_string = "\n".join([f"{key}={value}" for key, value in data_parts])
        
        # Extract the hash from the original query string
        received_hash = dict(part.split('=', 1) for part in unquoted_data.split('&')).get('hash')
        if not received_hash:
            return None

        # Generate the secret key and calculate the hash
        secret_key = hmac.new("WebAppData".encode(), bot_token.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        # Compare hashes
        if hmac.compare_digest(received_hash, calculated_hash):
             # Return parsed user data on success
            user_data_str = dict(data_parts).get('user')
            if user_data_str:
                return json.loads(user_data_str)
        return None
    except Exception:
        return None

@app.post("/upload-url")
async def upload_url(request: Request, payload: URLPayload):
    if not BOT_TOKEN:
        raise HTTPException(status_code=500, detail="TELEGRAM_BOT_TOKEN environment variable not set.")

    # Get initData from a custom header sent by the frontend
    init_data = request.headers.get("X-Telegram-Init-Data")
    if not init_data:
        raise HTTPException(status_code=401, detail="X-Telegram-Init-Data header is missing.")

    # Validate the request and get user info
    user_info = validate_init_data(init_data, BOT_TOKEN)
    if not user_info:
        raise HTTPException(status_code=403, detail="Invalid initData. Request could not be verified.")

    user_id = user_info.get('id')
    if not user_id:
         raise HTTPException(status_code=400, detail="Could not extract user ID from initData.")

    # Process the URL and send a confirmation message back to the user
    message_text = f"✅ I've received your URL: {payload.url}"
    
    async with httpx.AsyncClient() as client:
        send_message_url = f"httpss://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        try:
            res = await client.post(send_message_url, json={
                "chat_id": user_id,
                "text": message_text
            })
            res.raise_for_status()
        except httpx.HTTPStatusError as e:
            print(f"Error sending message to Telegram: {e.response.text}")
            raise HTTPException(status_code=500, detail="Failed to send confirmation message.")

    return {"status": "success", "message": "URL received and confirmation sent."}

@app.get("/")
def read_root():
    return {"status": "Backend is running!"}

# Handle CORS preflight requests
@app.options("/upload-url")
async def options_upload_url():
    return Response(status_code=200)

```

## Deploying the Backend to Render.com

Render offers a free tier for web services, which is perfect for this bot backend.

### Step 1: Push to GitHub

Push your backend project (containing `main.py` and `requirements.txt`) to a new GitHub repository.

### Step 2: Create a New Web Service on Render

1.  Sign up or log in to [Render.com](httpss://render.com).
2.  On your dashboard, click **New +** and select **Web Service**.
3.  Connect your GitHub account and select the repository you just created.

### Step 3: Configure the Service

Render will ask for a few settings:

*   **Name**: Give your service a unique name (e.g., `my-telegram-url-bot`). This will be part of your URL.
*   **Root Directory**: Leave this blank if `main.py` is in the root of your repo.
*   **Runtime**: Select **Python 3**.
*   **Build Command**: `pip install -r requirements.txt`
*   **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 4: Add Environment Variable

1.  Go to the **Environment** tab for your new service.
2.  Click **Add Environment Variable**.
3.  Set the **Key** to `TELEGRAM_BOT_TOKEN`.
4.  Set the **Value** to your actual bot token from BotFather.
5.  **Important:** Click **Save Changes**.

### Step 5: Deploy!

1.  Select the **Free** instance type.
2.  Click **Create Web Service**.

Render will now build and deploy your application. Once it's live, you will get a URL like `httpss://my-telegram-url-bot.onrender.com`.

## Connecting Frontend and Backend

In the frontend code (`App.tsx`), find the line with the `BACKEND_URL` constant and replace the placeholder with your live Render URL.

```typescript
// in App.tsx
const BACKEND_URL = 'httpss://my-telegram-url-bot.onrender.com/upload-url'; // <-- Replace with your URL
```

## Setting up the Telegram Mini App

1.  Talk to [@BotFather](httpss://t.me/BotFather) on Telegram.
2.  Use `/mybots`, select your bot.
3.  Go to **Bot Settings** -> **Menu Button**.
4.  Configure the menu button to open your Mini App URL (the URL where you host this React frontend).
5.  The Mini App will now be launchable from the menu button in your bot's chat.
```