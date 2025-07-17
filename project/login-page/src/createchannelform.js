import React, { useState } from 'react';

export default function CreateChannelForm({ onCreate }) {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [members, setMembers] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('please input channel name');

    const newChannel = {
      _id: Date.now(), // Analog ID
      name: name.trim(),
      isPrivate,
      members: members.split(',').map(m => m.trim()), // Simplified
    };

    onCreate(newChannel);
  };

  return (
    <div className="card p-4" style={{ width: '500px', height: '400px', fontSize: '20px' }}>
      <h5 className="mb-3">create a channel</h5>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">channel name</label>
          <input
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="channel name"
          />
        </div>
        <div className="mb-3">
          <label className="form-label"></label><br />
          <div className="form-check form-check-inline">
            <input
              type="radio"
              className="form-check-input"
              checked={!isPrivate}
              onChange={() => setIsPrivate(false)}
            />
            <label className="form-check-label">public</label>
          </div>
          <div className="form-check form-check-inline">
            <input
              type="radio"
              className="form-check-input"
              checked={isPrivate}
              onChange={() => setIsPrivate(true)}
            />
            <label className="form-check-label">private</label>
          </div>
          {/* Show invitation email input box only in private channel */}
          {isPrivate && (
            <div className="mb-3">
              <label className="form-label">Invite members to channel</label>
              <input
                type="text"
                className="form-control"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
                placeholder="like jack@ad.unsw.edu.au"
              />
            </div>
          )}
        </div>
        <button className="btn btn-primary w-100" type="submit">
          save
        </button>
      </form>
    </div>
  );
}
