import React, { useState, useEffect } from 'react';
import SideBar from './channel-sidebar';
import ChatPage from './channel-chat';
import CreateChannelForm from './createchannelform';
import DashboardPage from './Dashboard';

export default function ChannelPage() {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load Channel List
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5002/api/channels');

        if (!response.ok) {
          throw new Error('Failed to fetch channels');
        }

        const data = await response.json();

        if (data.status === 'success' && Array.isArray(data.data)) {
          console.log("Loaded channels from server:", data.data);
          setChannels(data.data);

          // Optional: automatic selection of the first channel
          if (data.data.length > 0 && !selectedChannel) {
            console.log("Auto-selecting first channel:", data.data[0]);
            setSelectedChannel(data.data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching channels:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  const handleCreateChannel = async (newChannel) => {
    try {
      // If your createchannelform already handles API calls, here's how it can be simplified
      setChannels(prev => [...prev, newChannel]);
      setSelectedChannel(newChannel); // Automatic selection of new channels
    } catch (error) {
      console.error("Error creating channel:", error);
      setError(error.message);
    }
  };

  const handleDeleteChannel = async (channelToDelete) => {
    try {
      const response = await fetch(`http://localhost:5002/api/channels/${channelToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete channel');
      }

      // Remove the channel from the list
      setChannels(prev => prev.filter(channel => channel.id !== channelToDelete.id));

      // If the currently selected channel is deleted, clears the selection
      if (selectedChannel && selectedChannel.id === channelToDelete.id) {
        setSelectedChannel(null);
      }
    } catch (err) {
      console.error('Error deleting channel:', err);
      setError(err.message);
    }
  };

  const hasChannels = channels.length > 0;

  // Adding debug logs
  useEffect(() => {
    console.log("Current channels:", channels);
    console.log("Selected channel:", selectedChannel);
  }, [channels, selectedChannel]);

  if (loading) {
    return <div className="d-flex justify-content-center align-items-center h-100">Loading channels...</div>;
  }

  return (
    <div style={{ height: '100vh' }}>
      {!hasChannels ? (
        // No channel → Display the channel creation page
        <div className="d-flex justify-content-center align-items-center h-100">
          <CreateChannelForm onCreate={handleCreateChannel} />
        </div>
      ) : (
        // With channel → show sidebar + chat
        <div className="d-flex h-100">
          <SideBar
            channels={channels}
            setSelectedChannel={setSelectedChannel}
            onCreate={handleCreateChannel}
            onDelete={handleDeleteChannel}
          />
          <div className="flex-fill">
            {selectedChannel ? (
              <ChatPage channel={selectedChannel} />
            ) : (
              <div className="d-flex h-100 align-items-center justify-content-center text-muted">
                Choose channel or create a new channel
              </div>
            )}
          </div>
        </div>
      )}
      <DashboardPage />
    </div>
  );
}
