#!/Users/chenyingcong/Documents/GitHub/capstone-project-2025-t1-25t1-9900-f14a-Avocado/ai_agent/new_env/bin/python channel_service.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from supabase.client import create_client, Client
import traceback
from datetime import datetime
from flask_socketio import SocketIO, emit, join_room, leave_room
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam
from typing import Optional, List

# 1. First load the environment variables
load_dotenv()

# 2. Initialize Flask and CORS
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000", "supports_credentials": True}})

# 3. Initialize Socket.IO (allow front-end cross-domain access)
socketio = SocketIO(app, cors_allowed_origins="http://localhost:3000")

# 4. Initializing OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# 5. Initialization of Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")


if not supabase_url or not supabase_key:
    print("Error: Missing Supabase configuration!")
    print(f"SUPABASE_URL present: {bool(supabase_url)}")
    print(f"SUPABASE_ANON_KEY present: {bool(supabase_key)}")
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set")

supabase: Client = create_client(supabase_url, supabase_key)

# Add test connection code
try:
    # Test connections using standard APIs
    test_response = supabase.table('channels').select("*").limit(1).execute()
    print("✅ Database connection successful!")
    print(f"Test query result: {test_response.data}")
except Exception as e:
    print("❌ Database connection failed!")
    print(f"Error message: {str(e)}")
    traceback.print_exc()

async def process_ai_assistant_message(content: str, channel_context: Optional[list] = None) -> Optional[str]:
    try:
        # Remove @assistant tag
        actual_question = content.replace("@assistant", "").strip()
        
        # Build system message
        messages: List[ChatCompletionMessageParam] = [
            {"role": "system", "content": "I am a project assistant AI, helping the team with project tasks. I will provide concise and professional answers."},
        ]
        
        # Add channel context if available
        if channel_context:
            for msg in channel_context[-5:]:
                role = "user" if msg.get("sender_zid") != "AI_ASSISTANT" else "assistant"
                content = msg.get("content", "")
                context_message = {"role": role, "content": content}
                messages.append(context_message)  # type: ignore
        
        # Add the user's current issue
        messages.append({"role": "user", "content": actual_question})
        
        # Calling the OpenAI API
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=1000,
            temperature=0.7,
        )
        
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error processing AI assistant message: {str(e)}")
        traceback.print_exc()
        return "I apologize, but I cannot process this request at the moment. Please try again later."

# Socket.IO Event Handling
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

@socketio.on('join')
def handle_join(data):
    channel_id = data.get('channel_id')
    if channel_id:
        room = f"channel_{channel_id}"
        join_room(room)
        print(f"Client {request.sid} joined room: {room}")

@socketio.on('leave')
def handle_leave(data):
    channel_id = data.get('channel_id')
    if channel_id:
        room = f"channel_{channel_id}"
        leave_room(room)
        print(f"Client {request.sid} left room: {room}")

@socketio.on('send_message')
def handle_message(data):
    channel_id = data.get('channel_id')
    message = data.get('message')
    if channel_id and message:
        room = f"channel_{channel_id}"
        # Add error handling and logging
        try:
            emit('new_message', message, to=room)
            print(f"Message broadcasted to room: {room}")
        except Exception as e:
            print(f"Error broadcasting message: {str(e)}")

# API Routing: Get all channels or get a specific channel by ID
@app.route('/api/channels', methods=['GET'])
def get_channels():
    zid = request.args.get('zid')
    channel_id = request.args.get('channelId')
    
    try:
        print(f"Getting channel list, channelId: {channel_id}, zid: {zid}")
        
        # Modify the query to include the is_private field
        query = supabase.table('channels').select('id, name, created_by, created_at, is_private')
        
        # If a specific channel ID is provided, get the channel
        if channel_id:
            query = query.eq('id', channel_id)
        
        # If a user ID is provided, you can get the channels that the user can access
        # Filtering based on the channel_members table is implemented here
        if zid:
            # Get all channel IDs of the user
            member_channels = supabase.table('channel_members')\
                .select('channel_id')\
                .eq('zid', zid)\
                .execute()
            
            if member_channels.data:
                channel_ids = [item['channel_id'] for item in member_channels.data]
                query = query.in_('id', channel_ids)
            else:
                # Returns an empty list if the user is not on any channel
                return jsonify({"status": "success", "data": []})
        
        response = query.execute()
        print(f"Query result: {response.data}")
        return jsonify({"status": "success", "data": response.data})
    except Exception as e:
        print(f"Error getting channel list: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to get channel list", "error": str(e)}), 500

# API Routing: Create New Channel
@app.route('/api/channels', methods=['POST'])
def create_channel():
    data = request.json
    if not data:
        return jsonify({"status": "fail", "message": "No data provided"}), 400
    try:
        print(f"Creating channel, data: {data}")
        name = data.get('name')
        created_by = data.get('created_by')
        is_private = data.get('is_private', False)
        
        if not name or not created_by:
            return jsonify({"status": "fail", "message": "Channel name and creator ID are required"}), 400
        
        # Add the creation time when creating a channel, using a uniform format
        channel_data = {
            "name": name,
            "created_by": created_by,
            "is_private": is_private,
            "created_at": datetime.now().strftime('%Y-%m-%dT%H:%M:%S')  # Modify the time format
        }
        
        print(f"Data to be inserted: {channel_data}")
        response = supabase.table("channels").insert(channel_data).execute()
        print(f"Channel creation result: {response.data}")
        
        # When a channel is successfully created, the creator is automatically added as a channel member
        if response.data:
            new_channel_id = response.data[0]['id']
            try:
                member_data = {
                    "channel_id": new_channel_id,
                    "zid": created_by
                }
                member_response = supabase.table("channel_members").insert(member_data).execute()
                print(f"Added creator as channel member: {member_response.data}")
            except Exception as member_error:
                print(f"Error adding creator as channel member: {str(member_error)}")
                # Here we don't interrupt the channel creation process because adding a member fails
        
        return jsonify({"status": "success", "data": response.data})
    except Exception as e:
        error_msg = str(e)
        print(f"Error creating channel: {error_msg}")
        traceback.print_exc()
        
        # Provide more specific error messages
        if "duplicate key" in error_msg.lower():
            return jsonify({"status": "fail", "message": "Channel name already exists", "error": error_msg}), 409
        elif "foreign key" in error_msg.lower():
            return jsonify({"status": "fail", "message": "Invalid creator ID", "error": error_msg}), 400
        elif "not-null" in error_msg.lower() or "null value" in error_msg.lower():
            return jsonify({"status": "fail", "message": "Missing required fields", "error": error_msg}), 400
        elif "column" in error_msg.lower() and "not exist" in error_msg.lower():
            return jsonify({"status": "fail", "message": "Data table structure mismatch", "error": error_msg}), 400
        else:
            return jsonify({"status": "fail", "message": "Failed to create channel", "error": error_msg}), 500

# API Routing: Getting Channel-Specific Messages
@app.route('/api/channels/<string:channel_id>/messages', methods=['GET'])
def get_channel_messages(channel_id):
    try:
        # Get channel information
        channel_response = supabase.table("channels").select("*").eq("id", channel_id).execute()
        if not channel_response.data:
            return jsonify({"status": "fail", "message": "Channel does not exist"}), 404
        
        # Get channel information
        try:
            # Avoid using sorting parameters that can lead to errors
            messages_response = supabase.table("channel_messages")\
                .select("id, content, sent_at, sender_zid, is_ai_response")\
                .eq("channel_id", channel_id)\
                .execute()
                
            # If you need to sort, you can do it in Python
            if messages_response.data:
                messages_response.data.sort(key=lambda x: x.get('sent_at', '') or '')
        except Exception as e:
            print(f"Error getting messages: {str(e)}")
            traceback.print_exc()
            return jsonify({"status": "fail", "message": "Error processing messages"}), 500
        
        print(f"Channel messages result: {messages_response.data}")
        
        # Ensure that all messages have the is_ai_response field
        if messages_response.data:
            for message in messages_response.data:
                if 'is_ai_response' not in message:
                    message['is_ai_response'] = False
        
        return jsonify({"status": "success", "data": messages_response.data})
    except Exception as e:
        error_msg = str(e)
        print(f"Error getting channel messages: {error_msg}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to get messages", "error": error_msg}), 500

# API Routing: Send a message on a specific channel
@app.route('/api/channels/<string:channel_id>/messages', methods=['POST'])
async def send_channel_message(channel_id):
    data = request.json
    if not data:
        return jsonify({"status": "fail", "message": "No data provided"}), 400
    
    sender_zid = data.get('sender_zid')
    content = data.get('content')
    
    if not sender_zid or not content:
        return jsonify({"status": "fail", "message": "Sender ID and message content are required"}), 400
    
    # Add content length validation
    if len(content) > 10000:  # Setting reasonable length limits
        return jsonify({"status": "fail", "message": "Message content too long"}), 400
    
    try:
        # First check if the channel exists
        channel_check = supabase.table("channels").select("id").eq("id", channel_id).execute()
        if not channel_check.data:
            return jsonify({"status": "fail", "message": "Channel does not exist"}), 404
        
        # Check if the sender is a channel member
        member_check = supabase.table("channel_members")\
            .select("channel_id")\
            .eq("channel_id", channel_id)\
            .eq("zid", sender_zid)\
            .execute()
            
        if not member_check.data:
            return jsonify({"status": "fail", "message": "Only channel members can send messages"}), 403
        
        # Processing AI assistant messages
        if "@assistant" in content.lower():
            try:
                # Get context message
                try:
                    context_response = supabase.table("channel_messages")\
                        .select("content, sender_zid")\
                        .eq("channel_id", channel_id)\
                        .limit(5)\
                        .execute()
                        
                    # If you need to reverse the order, you can do it in Python
                    if context_response.data:
                        context_response.data.sort(key=lambda x: x.get('sent_at', ''), reverse=True)
                except Exception as e:
                    print(f"Error getting context: {str(e)}")
                    context_response = None
                
                context = context_response.data if context_response and hasattr(context_response, 'data') else []
                
                # Save the user's original message
                # Timestamp at the time the message was sent
                current_time = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
                user_message_data = {
                    "channel_id": channel_id,
                    "sender_zid": sender_zid,
                    "content": content,
                    "sent_at": current_time,
                    "is_ai_response": False
                }
                user_response = supabase.table("channel_messages").insert(user_message_data).execute()  # 添加这行
                # Broadcast user messages to all clients on the channel
                if user_response.data:
                    room = f"channel_{channel_id}"
                    socketio.emit('new_message', user_response.data[0], room=room)
                
                # Getting AI responses asynchronously
                ai_response = await process_ai_assistant_message(content, context)
                
                # Save AI's reply message
                # Timestamp of AI reply message
                ai_message_data = {
                    "channel_id": channel_id,
                    "sender_zid": "AI_ASSISTANT",
                    "content": ai_response,
                    "sent_at": datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),  # edit the format
                    "is_ai_response": True
                }
                ai_response_db = supabase.table("channel_messages").insert(ai_message_data).execute()
                
                # Broadcast AI replies to all clients on the channel
                if ai_response_db.data:
                    room = f"channel_{channel_id}"
                    socketio.emit('new_message', ai_response_db.data[0], room=room)
                
                return jsonify({
                    "status": "success", 
                    "data": {
                        "user_message": user_response.data[0],
                        "ai_message": ai_response_db.data[0]
                    }
                })
            except Exception as e:
                print(f"Error processing AI message: {str(e)}")
                traceback.print_exc()
                return jsonify({
                    "status": "fail",
                    "message": "Failed to process AI message",
                    "error": str(e)
                }), 500
        
        # Handling General Messages
        # Timestamps for normal messages
        current_time = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')  # edit the format
        message_data = {
            "channel_id": channel_id,
            "sender_zid": sender_zid,
            "content": content,
            "sent_at": current_time,
            "is_ai_response": False
        }
        
        response = supabase.table("channel_messages").insert(message_data).execute()
        
        if response.data:
            # Broadcast a new message to all clients on the channel
            room = f"channel_{channel_id}"
            socketio.emit('new_message', response.data[0], room=room)
        
        return jsonify({"status": "success", "data": response.data})
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error sending message: {error_msg}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to send message", "error": error_msg}), 500

# API Routing: Get Channel Members
@app.route('/api/channels/<string:channel_id>/members', methods=['GET'])
def get_channel_members(channel_id):
    try:
        # Query using the standard API - note that the field name is zid and not user_id
        members_response = supabase.table("channel_members")\
            .select("channel_id, zid")\
            .eq("channel_id", channel_id)\
            .execute()
            
        print(f"Channel members result: {members_response.data}")
        return jsonify({"status": "success", "data": members_response.data})
    except Exception as e:
        print(f"Error getting channel members: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to get channel members", "error": str(e)}), 500

# API Routing: Adding Users to Channels
@app.route('/api/channels/<string:channel_id>/members', methods=['POST'])
def add_channel_member(channel_id):
    data = request.json
    if not data:
        return jsonify({"status": "fail", "message": "No data provided"}), 400
    
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({"status": "fail", "message": "User ID is required"}), 400
    
    try:
        print(f"Adding channel member, channel ID: {channel_id}, user ID: {user_id}")
        
        # First check if the channel exists
        channel_check = supabase.table("channels").select("id").eq("id", channel_id).execute()
        print(f"Channel check result: {channel_check.data}")
        
        if not channel_check.data:
            return jsonify({"status": "fail", "message": "Channel does not exist"}), 404
        
        # Check if the user is already a channel member
        check_query = supabase.table("channel_members")\
            .select("channel_id, zid")\
            .eq("channel_id", channel_id)\
            .eq("zid", user_id)\
            .execute()
            
        if check_query.data:
            return jsonify({"status": "fail", "message": "User is already a channel member"}), 409
        
        # Add new member - use the correct field name: zid instead of user_id
        member_data = {
            "channel_id": channel_id,
            "zid": user_id
        }
        
        print(f"Member data to be inserted: {member_data}")
        response = supabase.table("channel_members").insert(member_data).execute()
        print(f"Add channel member result: {response.data}")
        return jsonify({"status": "success", "data": response.data})
    except Exception as e:
        error_msg = str(e)
        print(f"Error adding channel member: {error_msg}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to add channel member", "error": error_msg}), 500

# API Routing: Delete Channel Members
@app.route('/api/channels/<string:channel_id>/members/<string:zid>', methods=['DELETE'])
def remove_channel_member(channel_id, zid):
    try:
        print(f"Removing channel member, channel ID: {channel_id}, member ID: {zid}")
        
        # Check if the member exists
        check_query = supabase.table("channel_members")\
            .select("channel_id, zid")\
            .eq("channel_id", channel_id)\
            .eq("zid", zid)\
            .execute()
            
        if not check_query.data:
            return jsonify({"status": "fail", "message": "User is not a channel member"}), 404
        
        # Delete member
        response = supabase.table("channel_members")\
            .delete()\
            .eq("channel_id", channel_id)\
            .eq("zid", zid)\
            .execute()
            
        print(f"Remove channel member result: {response.data}")
        return jsonify({"status": "success", "message": "Successfully removed channel member"})
    except Exception as e:
        error_msg = str(e)
        print(f"Error removing channel member: {error_msg}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to remove channel member", "error": error_msg}), 500

# API Routing: Delete Channel
@app.route('/api/channels/<string:channel_id>', methods=['DELETE'])
def delete_channel(channel_id):
    try:
        # Verify that the requestor is the channel creator (optional)
        creator_check = True  # Permission validation logic can be added here
        
        if not creator_check:
            return jsonify({"status": "fail", "message": "Only channel creator can delete the channel"}), 403
        
        # First delete all relevant messages
        supabase.table("channel_messages").delete().eq("channel_id", channel_id).execute()
        
        # Then delete all channel memberships
        supabase.table("channel_members").delete().eq("channel_id", channel_id).execute()
        
        # Finally delete the channel itself
        response = supabase.table("channels").delete().eq("id", channel_id).execute()
        
        if not response.data:
            return jsonify({"status": "fail", "message": "Channel not found"}), 404
            
        return jsonify({"status": "success", "message": "Channel successfully deleted"})
    except Exception as e:
        error_msg = str(e)
        print(f"Error deleting channel: {error_msg}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to delete channel", "error": error_msg}), 500

# Generic Functions for Handling Database Errors
def handle_database_error(e):
    error_message = str(e)
    if "duplicate key" in error_message:
        return jsonify({"status": "fail", "message": "Data already exists"}), 409
    elif "foreign key" in error_message:
        return jsonify({"status": "fail", "message": "Related data does not exist"}), 400
    return jsonify({"status": "fail", "message": "Database operation failed"}), 500

# Modify the startup code
if __name__ == '__main__':
    import logging
    logging.basicConfig(level=logging.DEBUG)
    
    print("Starting channel service...")
    print(f"Server will run on http://127.0.0.1:5002")
    print("Use Ctrl+C to stop the server")
    
    socketio.run(
        app,
        debug=True,
        port=5002,
        host='0.0.0.0',
        allow_unsafe_werkzeug=True
    )