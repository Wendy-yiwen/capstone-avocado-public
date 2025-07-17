import React, { useState } from 'react';
import './ch-sidebar.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/css/bootstrap.min.css';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function SideBar({ channels, selectedChannel, setSelectedChannel, onCreate, onDelete }) {
  const [showModal, setShowModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [members, setMembers] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      setError('Channel name cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Integrate with backend APIs to create channels
      const response = await fetch('http://localhost:5002/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newChannelName.trim(),
          created_by: localStorage.getItem('zid')
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create channel');
      }

      const responseData = await response.json();

      if (responseData.status === 'success' && responseData.data && responseData.data.length > 0) {
        const newChannel = responseData.data[0];

        // If it is a private channel, you need to add members
        if (isPrivate && members.trim()) {
          const memberZids = members.split(',').map(m => m.trim());

          for (const zid of memberZids) {
            try {
              await fetch(`http://localhost:5002/api/channels/${newChannel.id}/members`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  user_id: zid
                })
              });
            } catch (memberError) {
              console.error(`Failed to add member ${zid}:`, memberError);
              // Continue to add other members
            }
          }
        }

        // Notify the parent component
        onCreate(newChannel);

        // Reset Forms
        setShowModal(false);
        setNewChannelName('');
        setIsPrivate(false);
        setMembers('');
      } else {
        throw new Error('Invalid server response');
      }
    } catch (err) {
      console.error('Error creating channel:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChannel = async (channel) => {
    if (window.confirm(`Are you sure you want to delete the channel "${channel.name}"?`)) {
      try {
        // Calls the parent component's delete function
        onDelete(channel);
      } catch (err) {
        console.error('Error deleting channel:', err);
        setError(err.message);
      }
    }
  };

  return (
    <div>
      <div className="sidebar-container">
        <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-white" id="sidebar">
          <button id="add-btn"
            className="inline-flex w-full justify-center eroundd-md border border-gray-200 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => setShowModal(true)}
          >
            <i className="bi bi-plus-square-fill" id="add-icon" />
            New Channel
          </button>
          {(channels || []).map((channel) => (
            <div key={channel.id} className="flex items-center mb-2">
              <button
                className={classNames(
                  selectedChannel?.id === channel.id
                    ? 'bg-gray-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600',
                  'group flex gap-2 rounded-md px-3 py-2 text-lg font-semibold w-full text-left'
                )}
                onClick={() => setSelectedChannel(channel)}
              >
                <i className="bi bi-hash" />
                {channel.name}
              </button>
              <button
                className="ml-2 px-2 py-1 rounded-md border border-red-300 text-red-600 hover:bg-red-100"
                title="Delete"
                onClick={() => handleDeleteChannel(channel)}
              >
                <i className="bi bi-trash" />
              </button>
            </div>
          ))}
        </div>

      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-20">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Create a new channel</h2>

            {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3"
              placeholder="Channel name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              maxLength={50}
            />

            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  checked={!isPrivate}
                  onChange={() => setIsPrivate(false)}
                />
                Public
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  checked={isPrivate}
                  onChange={() => setIsPrivate(true)}
                />
                Private
              </label>
            </div>

            {isPrivate && (
              <div className="mb-3">
                <label className="block text-sm mb-1">Invite members (comma separated zIDs)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={members}
                  onChange={(e) => setMembers(e.target.value)}
                  placeholder="z1234567, z7654321"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-sm rounded-md bg-gray-200 hover:bg-gray-300"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={handleCreateChannel}
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
