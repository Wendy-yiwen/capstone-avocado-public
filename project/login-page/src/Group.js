import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Group.css';
import TeacherDashboard from './TeacherDashboard'
import { FaChevronDown, FaChevronUp, FaInfoCircle, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useCourse } from './components/CourseContext';


// Animated progress bar component
const AnimatedProgressBar = ({ value, getColor }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const target = parseInt(value);

  useEffect(() => {
    let val = 0;
    const interval = setInterval(() => {
      if (val < target) {
        val++;
        setDisplayValue(val);
      } else {
        clearInterval(interval);
      }
    }, 1);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <div className="progress">
      <div
        className={`progress-bar ${getColor(target)}`}
        role="progressbar"
        style={{ width: `${displayValue}%` }}
      />
      <div className="progress-bar-text">{displayValue}%</div>
    </div>
  );
};

// Main Contents
const GroupPage = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?.id;
  console.log('userId:', userId);
  const { selectedCourse } = useCourse();
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [groupFinalScores, setGroupFinalScores] = useState({});
  const [groupMembers, setGroupMembers] = useState({});
  const [groups, setGroups] = useState([]);
  
  const getGroupEvaluationStatus = (groupId) => {
    const mems = groupMembers[groupId] || [];
    return mems.every(m => groupFinalScores[m.zid]?.released)
      ? 'Done'
      : 'Open';
  }

  // returns true if every member in the group is released
  const isGroupDone = (groupId) => {
    const mems = groupMembers[groupId] || [];
    return mems.every(m => groupFinalScores[m.zid]?.released);
  };

  // Fetch group list
  useEffect(() => {
    if (!selectedCourse) return;
  
    const fetchGroups = async () => {
      try {
        const res = await fetch(
          `http://localhost:5001/group-contributions?course_code=${selectedCourse}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { data } = await res.json();
        const formatted = data.map(g => ({
          id: g.gid,
          name: g.group_name,
          meetingCount: g.total_finished_meeting,
          taskTotal: g.total_group_tasks,
          totalMember: g.total_group_member,
          isEvaluated: g.is_evaluated,
          evaluation: g.is_evaluated ? 'Done' : 'Open'
        }));
        setGroups(formatted);
      } catch (err) {
        console.error('Error fetching groups:', err);
      }
    };
  
    fetchGroups();
  }, [selectedCourse]);            

  // Fetch members when expanding group
  const fetchGroupMembers = async (groupId) => {
    try {
      const res = await fetch(
        `http://localhost:5001/private-contributions/${groupId}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
  
      const mapped = data.map(m => ({
        zid: m.zid,
        name: m.name,
        role: m.is_leader ? 'Leader': 'Member',
        participation: m.attended_meetings.toString(), 
        activity: m.channel_message_count,
        completion: m.total_group_tasks
          ? `${Math.round((m.completed_tasks / m.total_group_tasks) * 100)}%`
          : '0%',
        peerScore: m.peer_score, 
        finalScore: m.final_score, // fetching final score
        isValuated: m.is_evaluated, // fetching evaluation status
        // aiScore: null,
        taskCompleted: m.completed_tasks,
        taskQuantityScore: m.total_group_tasks
          ? Math.round((m.completed_tasks / m.total_group_tasks) * 10)
          : 0,
        taskDifficulty: { avgDifficulty: 0, weightedEffort: 0, difficultyScore: 0 },
        peerRatingDetail: []
      }));

      const initialScores = {};
      mapped.forEach(m => {
        initialScores[m.zid] = {
          score: m.finalScore != null ? m.finalScore : '',
          released: m.isValuated
        };
      });
      setGroupFinalScores(prev => ({ ...prev, ...initialScores }));

      setGroupMembers(prev => ({
        ...prev,
        [groupId]: mapped
      }));
    } catch (err) {
      console.error('Error fetching private contributions:', err);
    }
  };
      
  // Toggle release/unrelease a member's final score
  const handleReleaseToggle = async (memberZid, groupId) => {
    const prev = groupFinalScores[memberZid] || {};
    const newReleased = !prev.released;
  
    // Prevent releasing if no score has been entered
    if (newReleased && (prev.score === '' || prev.score == null)) {
      toast.warn('⚠️ Please enter a score before releasing.');
      return;
    }
  
    // 1) Compute the updated local scores object
    const updatedScores = {
      ...groupFinalScores,
      [memberZid]: { ...prev, released: newReleased }
    };
  
    // 2) Build an array of all member ZIDs in this group
    const memberZids = (groupMembers[groupId] || []).map(m => m.zid);
  
    // 3) Determine if *all* members have been released
    const allDone = memberZids.every(zid => updatedScores[zid]?.released);
  
    // 4) Update local state in one go:
    //    - final scores
    //    - each member’s evaluated status
    //    - the group’s overall evaluation status
    setGroupFinalScores(updatedScores);
  
    setGroupMembers(prev => ({
      ...prev,
      [groupId]: prev[groupId].map(m =>
        m.zid === memberZid
          ? { ...m, isValuated: newReleased }
          : m
      )
    }));
  
    setGroups(prev =>
      prev.map(g =>
        g.id === groupId
          ? { ...g, evaluation: allDone ? 'Done' : 'Open' }
          : g
      )
    );
  
    // 5) Sync changes with the backend
    try {
      // Update this member’s evaluation
      await fetch('http://localhost:5001/group-members/evaluation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: groupId,
          member_zid: memberZid,
          final_score: parseFloat(prev.score) || 0,
          is_evaluated: newReleased
        })
      });
  
      // Update the group’s overall evaluation flag
      await fetch('http://localhost:5001/groups/evaluation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: groupId,
          is_evaluated: allDone
        })
      });
  
      toast[newReleased ? 'success' : 'info'](
        newReleased ? '✅ Final score released!' : '🗑️ Final score withdrawn.'
      );
    } catch (err) {
      console.error(err);
      toast.error('❌ Error updating evaluation.');
    }
  };

  const toggleGroup = (groupId) => {
    const willExpand = !expandedGroups[groupId];
    setExpandedGroups(prev => ({ ...prev, [groupId]: willExpand }));

    if (willExpand && !groupMembers[groupId]) {
      fetchGroupMembers(groupId);
    }
  };

  const getProgressBarColor = (value) => {
    if (parseInt(value) >= 80) return 'bg-success';
    if (parseInt(value) > 50) return 'bg-warning';
    return 'bg-danger';
  };

  const renderEvaluationIcon = (done) => {
    if (done) {
      return (
        <span className="whitespace-nowrap flex items-center gap-1">
          <FaCheckCircle className="text-success" />
          <span className="text-gray-600">Evaluation: Done</span>
        </span>
      );
    }
    return (
      <span className="whitespace-nowrap flex items-center gap-1">
        <FaTimesCircle className="text-danger" />
        <span className="text-gray-600">Evaluation: Open</span>
      </span>
    );
  };

  return (
    <>
      <TeacherDashboard />
      <div className="pl-80 pr-14" id="container">
        <div className="group-content">
          <div className="text-left text-3xl font-bold my-8">Groups</div>

          {/* Group Cards List */}
          {groups.map(group => (
            <div key={group.id} className="card mb-4 rounded-lg border shadow-sm overflow-hidden bg-white">
              {/* Header */}
              <div
                className="flex items-center justify-between cursor-pointer px-6 py-4 
                  bg-gradient-to-r from-[#deeefc] to-[#f8f9fa] border-b border-gray-300"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-1 md:gap-1">
                  <h5 className="text-xl font-semibold text-gray-800">{group.name}</h5>
                  <div className="flex flex-wrap gap-3 text-base font-semibold text-gray-600">
                    <span>👥 {group.totalMember} members</span>
                    <span>📊 Tasks: {group.taskTotal}</span>
                    <span>📅 Meetings: {group.meetingCount}</span>
                    {/* <span>{renderEvaluationIcon(getGroupEvaluationStatus(group.id))}</span> */}
                    {/* <span>{renderEvaluationIcon(group.evaluation ? 'Done':'Open')}</span> */}
                    {/* <span>{renderEvaluationIcon(group.evaluation)}</span> */}
                    {/* <span>{renderEvaluationIcon(isGroupDone(group.id))}</span> */}
                    <span>{renderEvaluationIcon(group.isEvaluated)}</span>
                    {/* <span>{renderEvaluationIcon(isGroupDone(group.id, group.isEvaluated))}</span> */}
                  </div>
                </div>
                <div className="ml-4 text-gray-500">
                  {expandedGroups[group.id] ? <FaChevronUp /> : <FaChevronDown />}
                </div>
              </div>

              {/* Expanded Table */}
              {expandedGroups[group.id] && (
                <div className="px-6 py-4">
                  <table className="min-w-full text-base border-t text-center align-middle">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Role</th>
                        <th className="py-2 px-3">Meeting Attendance</th>
                        <th className="py-2 px-3">Channel Messages</th>
                        <th className="py-2 px-3">Task Completion</th>
                        <th className="py-2 px-3">Peer Score</th>
                        <th className="py-2 px-3"></th>
                        <th className="py-2 px-3">Final Score & Release</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(groupMembers[group.id] || []).map(member => (
                        <tr key={member.zid}>
                          {/* Name */}
                          <td className="py-2 px-3">{member.name}</td>

                          {/* Role */}
                          <td className="py-2 px-3">
                            <span
                              className={`badge ${member.role === 'Leader' ? 'bg-blue-600' : 'bg-gray-500'}`}
                            >
                              {member.role}
                            </span>
                          </td>

                          {/* Meeting Attendance */}
                          <td className="py-2 px-3 min-w-[50px]">
                            <AnimatedProgressBar
                              value={Math.round((parseInt(member.participation) / group.meetingCount) * 100).toString()}
                              getColor={getProgressBarColor}
                            />
                          </td>

                          {/* Channel Activity */}
                          <td className="py-2 px-3">{member.activity}</td>

                          {/* Tasks Completion */}
                          <td className="py-2 px-3 min-w-[100px]">
                            <AnimatedProgressBar value={member.completion} getColor={getProgressBarColor} />
                          </td>

                          {/* Peer Score */}
                          <td className="py-2 px-3">{member.peerScore !== null ? member.peerScore.toFixed(1) : '—'}</td>

                          {/* AI Score */}
                          {/* <td className="py-2 px-3">{member.aiScore !== null ? member.aiScore : '—'}</td> */}

                          {/* Detail Information */}
                          <td className="py-2 px-3">
                            <button
                              className="rounded-full flex justify-center items-center bg-white hover:bg-blue-100 hover:text-blue-600 transition"
                              onClick={() => {
                                setSelectedMember({ ...member, groupId: group.id });
                                setShowModal(true);
                              }}
                            >
                              <FaInfoCircle />
                            </button>
                          </td>

                          {/* Final Score & Release */}
                          <td className="py-2 px-3">
                            <div className="d-flex justify-content-center align-items-center gap-3">
                              {/* Final Score Input Box */}
                              <input
                                type="number"
                                step="0.1"
                                className="form-control form-control-sm"
                                placeholder="Score"
                                value={groupFinalScores[member.zid]?.score ?? ''}
                                disabled={groupFinalScores[member.zid]?.released}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (val < 0 || val > 10) return;
                                  setGroupFinalScores(prev => ({
                                    ...prev,
                                    [member.zid]: {
                                      ...(prev[member.zid] || {}),
                                      score: e.target.value
                                    }
                                  }))
                                }}
                                style={{ width: '80px' }}
                              />
                              {/* Release Toggle Switch */}
                              <div className="form-check form-switch">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`release-toggle-${member.zid}`}
                                  checked={groupFinalScores[member.zid]?.released || false}
                                  // disabled={groupFinalScores[member.zid]?.released}
                                  disabled={
                                    !groupFinalScores[member.zid]?.released
                                    && (groupFinalScores[member.zid]?.score === '' 
                                    || groupFinalScores[member.zid]?.score == null)
                                  }
                                  onChange={() => handleReleaseToggle(member.zid, group.id)}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Member Detail Modal */}
      {showModal && selectedMember && (
        <div className="modal-overlay">
          <div className="modal-content-group">
            <div className="modal-header custom-modal-header">
              <div className="d-flex flex-column text-center w-100">
                <div className="modal-title fw-bold">
                  {selectedMember.name} · {groups.find(g => g.id === selectedMember.groupId)?.name}
                </div>
              </div>
              <button
                className="btn-close"
                aria-label="Close"
                onClick={() => {
                  setShowModal(false);
                  setSelectedMember(null);
                }}
              ></button>
            </div>

            <div className="modal-body pt-3">
              {(() => {
                // const group = mockGroups.find(g => g.id === selectedMember.groupId);
                const group = groups.find(g => g.id === selectedMember.groupId);
                if (!group) return <p className="text-danger">Group not found</p>;

                const totalTasks = group.taskTotal || 0;
                const completed = selectedMember.taskCompleted || 0;
                const completionPercent = totalTasks ? ((completed / totalTasks) * 100).toFixed(1) : 0;

                return (
                  <>
                    {/* Task Quantity */}
                    <div className="mb-4 text-lg border-bottom pb-1">
                      <strong>📝 Task Quantity:</strong> {selectedMember.taskQuantityScore} / 10
                      <ul className="mt-1 ps-3 text-muted text-base">
                        <li>Completed {completed} / {totalTasks} group tasks ({completionPercent}%)</li>
                      </ul>
                    </div>

                    {/* Task Difficulty */}
                    <div className="mb-4 text-lg border-bottom pb-1">
                      <strong>🎯 Task Difficulty:</strong> {selectedMember.taskDifficulty?.difficultyScore} / 10
                      <ul className="mt-1 ps-3 text-muted text-base">
                        <li>Avg Difficulty: {selectedMember.taskDifficulty?.avgDifficulty} / 5</li>
                        <li>Total Weighted Effort: {selectedMember.taskDifficulty?.weightedEffort}</li>
                      </ul>
                    </div>

                    {/* Meeting Attendance */}
                    <div className="mb-4 border-bottom pb-1 text-lg">
                      <strong>💬 Meeting Attendance:</strong> {
                        Math.round((parseInt(selectedMember.participation) / group.meetingCount) * 10)
                      } / 10
                      <ul className="mt-1 ps-3 text-muted text-base">
                        <li>Attended {selectedMember.participation} / {group.meetingCount} meetings</li>
                      </ul>
                    </div>

                    {/* Channel Activity */}
                    <div className="mb-4 border-bottom pb-1 text-lg">
                      <strong>🧩 Channel Activity:</strong> {selectedMember.activity || 0} / 10
                      <ul className="mt-1 ps-3 text-muted text-base">
                        <li>Based on participation in group discussions</li>
                      </ul>
                    </div>

                    {/* Peer Rating */}
                    <div className="mb-4 border-bottom pb-2 text-lg">
                      <strong>🌟 Peer Rating:</strong> {selectedMember.peerScore} / 10
                      <ul className="mt-1 ps-3 text-muted text-base">
                        {selectedMember.peerRatingDetail?.map((entry, idx) => (
                          <li key={idx}>
                            {entry.from}: {entry.score} / 10
                            {entry.comment && (
                              <div className="text-muted text-base">"{entry.comment}"</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* AI Suggestion Score */}
                    {/* <div className="mb-2 text-lg">
                      <strong>🤖AI Suggestion Score:</strong> {selectedMember.aiScore} / 10
                    </div> */}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GroupPage;