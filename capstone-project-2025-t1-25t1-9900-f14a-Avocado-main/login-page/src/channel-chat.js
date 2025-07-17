import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './ch-chat.css';
import ChatInput from './channel-input';
import { io } from 'socket.io-client';

// Uniformly use port 5002, consistent with channel_service.py
const socket = io('http://localhost:5002', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// Add Socket.IO Connection Status Listener
socket.on('connect', () => {
  console.log('Socket.IO connected successfully');
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO connection error:', error);
});

export default function ChatPage({ channel }) {
  const [messagesByChannel, setMessagesByChannel] = useState({});
  const [currentMessages, setCurrentMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const messagesEndRef = useRef(null);

  // Output debugging information
  useEffect(() => {
    console.log("ChatPage render - channel:", channel);
    console.log("Socket connected:", socket.connected);
    setSocketConnected(socket.connected);
  }, [channel]);

  // Listening for Socket.IO connection status changes
  useEffect(() => {
    const onConnect = () => {
      console.log('Socket connected event fired');
      setSocketConnected(true);
    };

    const onDisconnect = () => {
      console.log('Socket disconnected event fired');
      setSocketConnected(false);
    };

    const onConnectError = (err) => {
      console.error('Socket connection error:', err);
      setSocketConnected(false);
      setError(`Failed to connect to the server: ${err.message}`);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  // Functions for loading messages
  const loadMessages = async () => {
    console.log("loadMessages called, channel:", channel);
    if (!channel?.id) {
      console.warn("No channel ID available, cannot load messages");
      return;
    }

    try {
      setIsLoading(true);
      console.log(`Fetching messages for channel ID: ${channel.id}`);

      // Use the correct backend port 5002
      const response = await fetch(`http://localhost:5002/api/channels/${channel.id}/messages`);

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        throw new Error(errorData.message || 'Failed to load messages');
      }

      const data = await response.json();
      console.log("Messages response data:", data);

      if (data.status === 'success' && Array.isArray(data.data)) {
        console.log(`Loaded ${data.data.length} messages for channel ${channel.id}`);

        // Sample message format checking
        if (data.data.length > 0) {
          console.log("Sample message format:", data.data[0]);
        }

        setMessagesByChannel(prev => ({
          ...prev,
          [channel.id]: data.data
        }));
        setCurrentMessages(data.data);
      } else {
        console.error("Invalid response format:", data);
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handling Socket.IO events and loading messages when the channel changes
  useEffect(() => {
    console.log("Channel changed effect triggered, channel:", channel);

    if (channel?.id) {
      console.log(`Setting up for channel: ${channel.id}`);

      // Listen for new messages
      const handleNewMessage = (message) => {
        console.log("New message received:", message);
        // Processes only the current channel's messages
        if (message.channel_id === channel.id) {
          console.log(`Adding new message to channel ${channel.id}`);
          setMessagesByChannel(prev => ({
            ...prev,
            [channel.id]: [...(prev[channel.id] || []), message]
          }));
          setCurrentMessages(prev => [...prev, message]);
        }
      };

      // Join the channel
      console.log(`Joining channel room: ${channel.id}`);
      socket.emit('join', { channel_id: channel.id });
      socket.on('new_message', handleNewMessage);

      // Load history messages
      loadMessages();

      // Cleanup Functions
      return () => {
        console.log(`Cleaning up listeners for channel: ${channel.id}`);
        socket.off('new_message', handleNewMessage);
        socket.emit('leave', { channel_id: channel.id });
      };
    } else {
      console.log("No valid channel selected");
    }
  }, [channel]);

  // Load the corresponding channel's messages from the cache when the channel changes
  useEffect(() => {
    console.log("Current messages update effect triggered");
    if (channel && channel.id && messagesByChannel[channel.id]) {
      console.log(`Setting current messages from cache for channel ${channel.id}`);
      setCurrentMessages(messagesByChannel[channel.id]);
    } else {
      console.log("No cached messages found, clearing current messages");
      setCurrentMessages([]);
    }
  }, [channel, messagesByChannel]);

  // Handler functions for sending messages
  const handleSend = async (messageHtml) => {
    if (!messageHtml.trim() || !channel?.id) {
      console.warn("Cannot send: empty message or no channel selected");
      return;
    }

    // Simple Content Length Limit
    if (messageHtml.length > 2000) {
      setError('Message too long. Maximum 2000 characters allowed.');
      return;
    }

    console.log(`Sending message to channel ${channel.id}`);

    try {
      // Check User ID
      const senderZid = localStorage.getItem('zid');
      if (!senderZid) {
        throw new Error('User ID not found. Please login again.');
      }

      console.log(`Sending as user: ${senderZid}`);

      const response = await fetch(`http://localhost:5002/api/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          sender_zid: senderZid,
          content: messageHtml
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error sending message:", errorData);
        throw new Error(errorData.message || 'Failed to send message');
      }

      const responseData = await response.json();
      console.log("Message send response:", responseData);

      // If it is a normal message, the server will return the message data directly
      // If @assistant is included, the server returns the user message and AI response
      if (responseData.status === 'success') {
        console.log("Message sent successfully, reloading messages");
        // Load the latest news to ensure synchronization with the server
        loadMessages();
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError(`Failed to send message: ${error.message}`);

      // Error message cleared after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  };

  // Automatic scrolling to the bottom
  useEffect(() => {
    console.log("Scrolling to bottom");
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  // Checking the necessary conditions
  if (!channel) {
    return <div className="chat-area">
      <div className="chat-header">No channel selected</div>
      <div className="chat-messages">
        <div className="no-channel-message">Please select a channel from the sidebar</div>
      </div>
    </div>;
  }

  return (
    <div className="flex flex-col h-full p-4 bg-white border border-gray-200 rounded-lg" id="chat-area">
      {/* Top Channel Name */}
      <div className="text-xl font-semibold mb-4 text-indigo-700">#{channel.name}</div>

      {/* Connection Status */}
      {!socketConnected && (
        <div className="mb-2 p-2 text-sm text-yellow-700 bg-yellow-100 rounded">
          ⚠️ Not connected to message server. Messages may not be delivered in real-time.
        </div>
      )}

      {/* Message Area */}
      <div className="flex flex-col flex-1 overflow-y-auto space-y-4 pr-2 bg-white border border-gray-200 rounded-lg">
        {currentMessages.length === 0 && !isLoading && (
          <div className="text-gray-400 text-sm italic">
            No messages yet. Be the first to send a message!
          </div>
        )}

        {currentMessages.map((msg, index) => {
          const isSelf = msg.sender_zid === localStorage.getItem('zid')
          const isAI = msg.sender_zid === 'AI_ASSISTANT'
          return (
            <div
              key={msg.id || index}
              className={classNames(
                'max-w-xl px-4 py-2 rounded-lg shadow-sm',
                isSelf
                  ? 'bg-indigo-100 self-end text-right'
                  : isAI
                    ? 'bg-green-100 self-start'
                    : 'bg-gray-100 self-start'
              )}
            >
              <div className="text-sm font-semibold mb-1 text-gray-700">
                {isAI ? 'Assistant' : msg.sender_zid}
              </div>
              <div
                className="text-sm text-gray-800"
                dangerouslySetInnerHTML={{ __html: msg.content }}
              />
              <div className="text-xs text-gray-400 mt-1">
                {new Date(msg.sent_at).toLocaleString()}
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef}></div>
      </div>

      {/* Loading and Errors */}
      {isLoading && <div className="text-sm text-gray-400 mt-2">Loading messages...</div>}
      {error && <div className="text-sm text-red-500 mt-2">{error}</div>}

      {/* Input Box */}
      <ChatInput onSend={handleSend} />
    </div>
  )
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

