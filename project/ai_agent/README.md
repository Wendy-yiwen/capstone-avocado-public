# Channel Service API

A Flask-based API service for managing channels, messages, and AI assistant integration.

## Prerequisites

- Python 3.11 or higher
- Virtual environment (`new_env`)

## Environment Setup

This project uses a Python virtual environment to manage dependencies. The following dependencies are required:

```
flask==2.0.1
flask-cors==3.0.10
python-dotenv==0.19.0
supabase==1.0.3
Flask-SocketIO==5.1.1
openai==1.3.0
asgiref
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Starting the Server

### Method 1: Using the virtual environment directly

```bash
# Navigate to the project directory
cd /path/to/project/ai_agent

# Activate the virtual environment
source new_env/bin/activate

# Run the server
python channel_service.py
```

### Method 2: Using the shebang line (executable file)

```bash
# Navigate to the project directory
cd /path/to/project/ai_agent

# Make sure the file is executable
chmod +x channel_service.py

# Run the file directly
./channel_service.py
```

The server will start and be available at http://127.0.0.1:5002.

## API Endpoints

- `GET /api/channels` - Get all channels or filter by user/channel ID
- `POST /api/channels` - Create a new channel
- `GET /api/channels/<channel_id>/messages` - Get messages for a specific channel
- `POST /api/channels/<channel_id>/messages` - Send a message to a channel
- `GET /api/channels/<channel_id>/members` - Get members of a channel
- `POST /api/channels/<channel_id>/members` - Add a user to a channel
- `DELETE /api/channels/<channel_id>/members/<zid>` - Remove a member from a channel

## AI Assistant Feature

The service includes an AI assistant feature. To use it, include `@assistant` in your message content when sending a message. The AI will respond automatically.

Example:
```bash
curl -X POST "http://localhost:5002/api/channels/your-channel-id/messages" \
-H "Content-Type: application/json" \
-d '{
    "sender_zid": "user_id",
    "content": "@assistant Can you help me with this project?"
}'
```

## Troubleshooting

If you encounter any issues with missing dependencies, make sure you're using the virtual environment and all required packages are installed:

```bash
source new_env/bin/activate
pip install flask flask-cors flask-socketio openai python-dotenv supabase asgiref
```

Use Ctrl+C to stop the server.