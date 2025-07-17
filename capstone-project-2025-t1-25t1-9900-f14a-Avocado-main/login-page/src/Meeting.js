import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useLocation } from 'react-router-dom';
import DashboardPage from './Dashboard';
import './Meeting.css';
import meetingIcon from './assets/meetingroom.svg';
import { useCourse } from './components/CourseContext';

const fetchMeetingsByGroup = async (groupId) => {
  try {
    const response = await fetch(`http://localhost:5001/meetings?groupId=${groupId}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    if (result.status === 'success') return { meetings: result.data, error: null };
    return { meetings: [], error: result.message || 'Failed to fetch meetings' };
  } catch (err) {
    return { meetings: [], error: err.message };
  }
};

const MeetingPage = () => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?.id;
  const { selectedCourse } = useCourse();

  const [groupId, setGroupId] = useState(null);
  const [meetingsData, setMeetingsData] = useState({ meetings: [], isLoading: true });
  const [categorizedMeetings, setCategorizedMeetings] = useState({ upcoming: [], current: [], previous: [] });
  const [isEditingMeeting, setIsEditingMeeting] = useState(false)
  const [editedStart, setEditedStart] = useState('')
  const [editedEnd, setEditedEnd] = useState('')


  // Modal & attendance states
  const [showModal, setShowModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Row editing state
  const [editingMember, setEditingMember] = useState(null);
  const [editedJoin, setEditedJoin] = useState('');
  const [editedLeave, setEditedLeave] = useState('');

  // Duration helpers
  const formatSecondsToDuration = sec => {
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
    return `${h}h ${m}m ${s}s`;
  };

  // Fetch groupId
  useEffect(() => {
    if (!userId || !selectedCourse) return;
    (async () => {
      const res = await fetch(`http://localhost:5001/group-id?zid=${userId}&course_code=${selectedCourse}`);
      const data = await res.json();
      setGroupId(data.group_id);
    })();
  }, [userId, selectedCourse]);

  // Load meetings
  useEffect(() => {
    if (!groupId) return;
    (async () => {
      setMeetingsData(prev=>({ ...prev, isLoading:true }));
      const data = await fetchMeetingsByGroup(groupId);
      setMeetingsData({ ...data, isLoading:false });
      if (data.meetings.length) {
        const now = new Date();
        const sec = { upcoming:[], current:[], previous:[] };
        data.meetings.forEach(m=>{
          const S=new Date(m.start_time), E=new Date(m.end_time);
          if (S>now) sec.upcoming.push(m);
          else if (S<=now&&E>=now) sec.current.push(m);
          // else sec.previous.push(m);
          else {
            // push into previous and then call PATCH to mark it completed
            sec.previous.push(m);
            fetch(`http://localhost:5001/meetings/${m.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed' })
            })
            .then(res => {
              if (!res.ok) throw new Error(`Status update failed: ${res.status}`);
              return res.json();
            })
            .catch(err => console.error('Error updating meeting status:', err));
          }
        });
        setCategorizedMeetings(sec);
      }
    })();
  }, [groupId]);

// Fetch attendance records for all team members
  const fetchAttendance = async meeting => {
    // 1. First get all the members of the group
    const teamRes = await fetch(`http://localhost:5001/team-members?groupId=${groupId}&zid=${userId}`);
    const teamJson = await teamRes.json();
    const members = teamJson.status === 'success'
      ? teamJson.data.members
      : [];
    setTeamMembers(members);

    // 2. Parallel pulling of attendance for each individual
    const attendanceLists = await Promise.all(
      members.map(m =>
        fetch(`http://localhost:3001/meeting-attendance?meeting_id=${meeting.id}&member_zid=${m.zid}`)
          .then(r => r.json())
          .then(j => j.status === 'success' ? j.data : [])
      )
    );
    const allRecs = attendanceLists.flat();

    // 3. Harmonization of computing hours and status
    const totalSec = (new Date(meeting.end_time) - new Date(meeting.start_time)) / 1000;
    const formatted = allRecs.map(rec => {
      const join = new Date(rec.join_time);
      const leave = new Date(rec.leave_time);
      const durSec = (leave - join) / 1000;
      const durHour = durSec / 3600;
      return {
        ...rec,
        duration: formatSecondsToDuration(durSec),
        attendance_status: durHour >= 0.7 * (totalSec / 3600) ? 'Present' : 'Absent'
      };
    });

    setAttendanceData(formatted);
  };

  // Fetch team members for names
  const fetchTeamMembers = async (groupId, userId) => {
    const res = await fetch(`http://localhost:5001/team-members?groupId=${groupId}&zid=${userId}`);
    const result = await res.json();
    setTeamMembers(result.status==='success'?result.data.members:[]);
  };

  const handleSaveMeetingTime = async () => {
    if (!selectedMeeting) return
    // 1. Conversion of user-modified values to ISO
    const newStartISO = new Date(editedStart).toISOString()
    const newEndISO   = new Date(editedEnd).toISOString()
    // 2. Calculation of the length of new meetings (hours)
    const meetingDurHour = (new Date(newEndISO) - new Date(newStartISO)) / 3600000
  
    // 3. Update the meetings table (assuming your backend supports PUT /meetings/:id)
    await fetch(`http://localhost:5001/meetings/${selectedMeeting.rawData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: newStartISO,
        end_time: newEndISO,
        duration_hour: meetingDurHour
      })
    })
  
    // 4. Get the current teamMembers and put a new meeting_duration_hour on each person's attendance record.
    await Promise.all(teamMembers.map(rec => {
      // rec.zid, rec.participation_duration_hour, rec.join_time, rec.leave_time ARE IN attendanceData
      const att = attendanceData.find(a=>a.member_zid===rec.zid)
      return fetch('http://localhost:3001/meeting-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id:       selectedMeeting.rawData.id,
          member_zid:        rec.zid,
          join_time:         att.join_time,
          leave_time:        att.leave_time,
          meeting_duration_hour:       meetingDurHour,
          participation_duration_hour: att.participation_duration_hour,
          group_id:          groupId,
          is_present:        att.attendance_status === 'Present'
        })
      })
    }))
  
    // 5. Refresh UI
    setIsEditingMeeting(false)
    setSelectedMeeting(prev=>({
      ...prev,
      rawData: {
        ...prev.rawData,
        start_time: newStartISO,
        end_time:   newEndISO
      }
    }))
    fetchAttendance({ 
      id: selectedMeeting.rawData.id, 
      start_time: newStartISO,
      end_time:   newEndISO 
    })
  }  

  // Open modal
  const handleOpenModal = meeting => {
    setSelectedMeeting(meeting);
    setShowModal(true);
    fetchTeamMembers(groupId, userId);
    setEditedStart(meeting.rawData.start_time.slice(0,16))
    setEditedEnd(meeting.rawData.end_time.slice(0,16))
    fetchAttendance(meeting);
  };

  // Save edit
  // const handleSave = async zid => {
  //   if (!selectedMeeting) return;
  //   const m = selectedMeeting;
  //   const joinISO = new Date(editedJoin).toISOString();
  //   const leaveISO = new Date(editedLeave).toISOString();
  //   const durHour = (new Date(leaveISO)-new Date(joinISO))/3600000;
  //   const meetHour = (new Date(m.end_time)-new Date(m.start_time))/3600000;
  //   const isPresent = durHour >= 0.7*meetHour;
  //   await fetch('http://localhost:3001/meeting-attendance',{
  //     method:'POST',headers:{'Content-Type':'application/json'},
  //     body:JSON.stringify({
  //       meeting_id:m.id, member_zid:zid,
  //       join_time:joinISO, leave_time:leaveISO,
  //       meeting_duration_hour: meetHour,
  //       participation_duration_hour: durHour,
  //       group_id:groupId, is_present: isPresent
  //     })
  //   });
  //   setEditingMember(null);
  //   fetchAttendance(m);
  // };
  const handleSave = async zid => {
    if (!selectedMeeting) return;
    // Taking out the original session information
    const { rawData } = selectedMeeting;
  
    // 1. Calculation of participant duration (hours)
    const joinISO = new Date(editedJoin).toISOString();
    const leaveISO = new Date(editedLeave).toISOString();
    const participationHour = (new Date(leaveISO) - new Date(joinISO)) / 3600000;
  
    // 2. Dynamically calculate the total duration of the meeting (in hours), using the latest start / end
    const meetingHour = (
      new Date(rawData.end_time) - new Date(rawData.start_time)
    ) / 3600000;
  
    // 3. Attendance determination
    const isPresent = participationHour >= 0.7 * meetingHour;
  
    // 4. Updating the back end
    await fetch('http://localhost:3001/meeting-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_id:               rawData.id,
        member_zid:               zid,
        join_time:                joinISO,
        leave_time:               leaveISO,
        meeting_duration_hour:    meetingHour,
        participation_duration_hour: participationHour,
        group_id:                 groupId,
        is_present:               isPresent
      })
    });
  
    // 5. Refresh interface
    setEditingMember(null);
    fetchAttendance({ 
      id: rawData.id, 
      start_time: rawData.start_time, 
      end_time: rawData.end_time 
    });
  };

  const handleClose = () => {
    setShowModal(false);
    setSelectedMeeting(null);
    setAttendanceData([]);
    setTeamMembers([]);
    setEditingMember(null);
  };

  const { isLoading } = meetingsData;
  return (<>
      <DashboardPage />
      <div className="pl-80 d-flex justify-content-center">
        <div className="meeting-content">
          {['upcoming', 'current', 'previous'].map(section => (
            <div key={section} className="meeting-section mb-5">
              <h2 className="text-center">
                {section === 'upcoming' && 'Upcoming Meetings'}
                {section === 'current' && 'Current Meetings'}
                {section === 'previous' && 'Previous Meetings'}
              </h2>

              {isLoading ? (
                <div className="d-flex justify-content-center mt-5">
                  <div className="loading-spinner"></div>
                </div>
              ) : categorizedMeetings[section].length === 0 ? (
                <p className="text-center text-muted">No {section} meetings</p>
              ) : (
                categorizedMeetings[section].map(meeting => {
                  const start = new Date(meeting.start_time);
                  const end = new Date(meeting.end_time);

                  const formatted = {
                    id: meeting.id,
                    title: (() => {
                      const prefix = meeting.assignments?.name ? meeting.assignments.name + ": " : "";
                      const mainTitle = meeting.meeting_title || "General Meeting";
                      return prefix + mainTitle;
                    })(),
                    date: start.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Australia/Sydney"
                    }),
                    timeRange: `${start.toLocaleTimeString("en-AU", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: "Australia/Sydney"
                    })} - ${end.toLocaleTimeString("en-AU", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: "Australia/Sydney"
                    })}`,
                    group: meeting.groups?.name,
                    rawData: meeting,
                  };

                  return (
                    <div key={formatted.id} className="meeting-card mb-3">
                      <div className="meeting-left">
                        <img src={meetingIcon} alt="Meeting" className="svg-icon" />
                        <div className="meeting-info">
                          <h5>{formatted.title}</h5>
                          <div className="meeting-meta">
                            <span className="inline-block bg-[#A6BFFF] text-[#495057] text-xs font-medium px-3 py-1 rounded-full">{formatted.group}</span>
                            <span>📅 {formatted.date}</span>
                            <span>⏰ {formatted.timeRange} (AEST)</span>
                          </div>
                        </div>
                      </div>
                      {(section === 'previous') && (
                        <button className="meeting-plan-btn" onClick={() => handleOpenModal(formatted)}>
                          View Attendance
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      </div>
    {showModal&&selectedMeeting&&<div className="modal-overlay"><div className="modal-content2">
      <div className="modal-header"><h2 className="modal-title">Meeting Details</h2></div>
      <div className="modal-body">
        <h3>{selectedMeeting.meeting_title||'Meeting'}</h3>

        {/* Start/finish and length of meeting */}
        <div className="mb-3">
          {isEditingMeeting ? (
            <>
              <label>Start Time</label>
              <input
                type="datetime-local"
                className="form-control mb-2"
                value={editedStart}
                onChange={e => setEditedStart(e.target.value)}
              />
              <label>End Time</label>
              <input
                type="datetime-local"
                className="form-control mb-2"
                value={editedEnd}
                onChange={e => setEditedEnd(e.target.value)}
              />

              <p>
                <strong>Meeting Duration:</strong>{' '}
                {formatSecondsToDuration(
                  (new Date(editedEnd) - new Date(editedStart)) / 1000
                )}
              </p>

              <button
                className="btn btn-success me-2"
                onClick={handleSaveMeetingTime}
              >
                Save Meeting Time
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setIsEditingMeeting(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <p>
                <strong>Start:</strong>{' '}
                {new Date(selectedMeeting.rawData.start_time)
                  .toLocaleString('en-GB', {
                    hour12: true,
                    timeZone: 'Australia/Sydney',
                  })}
              </p>
              <p>
                <strong>End:</strong>{' '}
                {new Date(selectedMeeting.rawData.end_time)
                  .toLocaleString('en-GB', {
                    hour12: true,
                    timeZone: 'Australia/Sydney',
                  })}
              </p>
              <p>
                <strong>Meeting Duration:</strong>{' '}
                {formatSecondsToDuration(
                  (new Date(selectedMeeting.rawData.end_time) -
                    new Date(selectedMeeting.rawData.start_time)) /
                    1000
                )}
              </p>
              <button
                className="btn btn-outline-primary"
                onClick={() => setIsEditingMeeting(true)}
              >
                Edit Meeting Time
              </button>
            </>
          )}
        </div>

        <table className="table"><thead><tr>
          <th>Member</th><th>First Join</th><th>Last Leave</th><th>In-Meeting Duration</th><th>Attendance</th><th>Action</th>
        </tr></thead><tbody>
          {attendanceData.map(rec=>{
            const isEd = editingMember===rec.member_zid;
            const name = teamMembers.find(tm=>tm.zid===rec.member_zid)?.name||rec.member_zid;
            const joinVal = isEd?editedJoin:rec.join_time;
            const leaveVal= isEd?editedLeave:rec.leave_time;
            const dur = isEd?formatSecondsToDuration((new Date(editedLeave)-new Date(editedJoin))/1000):rec.duration;
            const status = isEd?( (new Date(editedLeave)-new Date(editedJoin))/(new Date(selectedMeeting.end_time)-new Date(selectedMeeting.start_time))>=0.7?'Present':'Absent'):
                          rec.attendance_status;
            return <tr key={rec.member_zid}><td>{name}</td>
              <td>{isEd?
                <input type="datetime-local" className="form-control" value={editedJoin} onChange={e=>setEditedJoin(e.target.value)}/>
                :new Date(rec.join_time).toLocaleString('en-GB',{hour12:true,timeZone:'Australia/Sydney'})}</td>
              <td>{isEd?
                <input type="datetime-local" className="form-control" value={editedLeave} onChange={e=>setEditedLeave(e.target.value)}/>
                :new Date(rec.leave_time).toLocaleString('en-GB',{hour12:true,timeZone:'Australia/Sydney'})}</td>
              <td>{dur}</td><td>{status}</td>
              <td>{isEd?
                <><button className="btn btn-success btn-sm" onClick={()=>handleSave(rec.member_zid)}>Save</button>
                  <button className="btn btn-secondary btn-sm ms-2" onClick={()=>setEditingMember(null)}>Cancel</button></>
                :<button className="btn btn-outline-primary btn-sm" onClick={()=>{setEditingMember(rec.member_zid);
                  setEditedJoin(rec.join_time.slice(0,16));setEditedLeave(rec.leave_time.slice(0,16));}}>Edit</button>}
              </td></tr>})}
        </tbody></table>
      </div>
      <div className="modal-footer"><button className="btn btn-primary" onClick={handleClose}>Close</button></div>
    </div></div>}
  </>);
};

export default MeetingPage;
