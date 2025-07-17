import React, { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import DashboardPage from './Dashboard';
import { useLocation } from 'react-router-dom';
import './Homepage.css';
import { useCourse } from './components/CourseContext';

// HomePage component: displays user, group, and course information
const HomePage = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?.id;
  const { selectedCourse } = useCourse();
  const location = useLocation();
  const [username, setUsername] = useState(userId || '');

  // State variables for data
  const [groupId, setGroupId] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [errors, setErrors] = useState({ team: null, tutors: null, tasks: null, contributions: null });
  const [loading, setLoading] = useState({ team: true, tutors: true, tasks: true, contributions: true });

  // Helper function to render loading, error, or actual content
  const renderContent = (loadingState, error, data, renderFn) => {
    if (loadingState) return <div className="text-muted">Loading...</div>;
    if (error) return <div className="text-danger">Error: {error}</div>;
    return renderFn(data);
  };

  // Update username from location state
  useEffect(() => {
    if (location.state?.username) {
      setUsername(location.state.username);
      localStorage.setItem('username', location.state.username);
    }
  }, [location.state]);

  // Fetch user's group ID
  useEffect(() => {
    if (!userId || !selectedCourse) return;
    fetch(`http://localhost:5001/group-id?zid=${userId}&course_code=${selectedCourse}`)
      .then(res => res.json())
      .then(data => setGroupId(data.group_id))
      .catch(err => console.error("Error fetching groupId:", err));
  }, [userId, selectedCourse]);

  // Fetch team members
  useEffect(() => {
    if (!username || !groupId) return;
    fetch(`http://localhost:5001/team-members?groupId=${groupId}&zid=${userId}`)
      .then(res => res.json())
      .then(data => data.status === 'success' ? setTeamMembers(data.data.members) : setErrors(prev => ({ ...prev, team: data.message })))
      .catch(err => setErrors(prev => ({ ...prev, team: err.message })))
      .finally(() => setLoading(prev => ({ ...prev, team: false })));
  }, [groupId, userId, username]);

  // Fetch tutors list
  useEffect(() => {
    fetch("http://localhost:5001/tutors")
      .then(res => res.json())
      .then(data => setTutors(data))
      .catch(err => setErrors(prev => ({ ...prev, tutors: err.message })))
      .finally(() => setLoading(prev => ({ ...prev, tutors: false })));
  }, []);

  // Fetch task list
  useEffect(() => {
    if (!username) return;
    if (!selectedCourse) return;
    fetch(`http://localhost:5001/tasks?zid=${userId}&course_code=${selectedCourse}`)
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(err => setErrors(prev => ({ ...prev, tasks: err.message })))
      .finally(() => setLoading(prev => ({ ...prev, tasks: false })));
  }, [username, selectedCourse]);

  // Fetch contribution data
  useEffect(() => {
    if (!username) return;
    fetch(`http://localhost:5001/my-contributions?zid=${username}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setContributions(data[0]); // ✅ Take only the first object
        } else {
          setContributions(null);
        }
      })
      .catch(err => setErrors(prev => ({ ...prev, contributions: err.message })))
      .finally(() => setLoading(prev => ({ ...prev, contributions: false })));
  }, [username]);

  return (
    <>
      <DashboardPage />
      <div className="pl-80 pr-14 pt-10">
        {/* Welcome Banner */}
        <div className="text-3xl font-bold text-gray-800 mb-8">👋 Welcome, {user?.name || 'Student'}</div>

        {/* Grid: Course Info, Tutors, Contributions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">📘 Current Course</h3>
            <p className="text-indigo-600 text-xl font-bold">{selectedCourse || 'Not selected'}</p>
          </div>

          {/* Tutors */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">🎓 Tutor(s)</h3>
            {renderContent(loading.tutors, errors.tutors, tutors, (tutors) => (
            <ul className="text-base text-gray-700 list-disc pl-4">
              {tutors.map((t) => <li key={t.id}>{t.name}</li>)}
            </ul>
          ))}
          </div>

          {/* My Contributions */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">📊 My Contributions</h3>
            {renderContent(loading.contributions, errors.contributions, contributions, (c) => (
              c ? (
                <ul className="text-base text-gray-700 list-disc pl-4">
                  <li><strong>Meeting Attendance:</strong> {(c.meeting_attendance * 100).toFixed(0)}%</li>
                  <li><strong>Task Completion:</strong> {(c.task_completion * 100).toFixed(0)}%</li>
                  <li><strong>Channel Activity:</strong> {c.channel_activity}</li>
                </ul>
              ) : <p className="text-gray-500">No contribution data</p>
            ))}
          </div>
        </div>

        {/* Grid: Group Members, Task List */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Group Members */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">👥 My Group Members</h3>
            {renderContent(loading.team, errors.team, teamMembers, (members) => (
              <ul className="text-base text-gray-700 list-disc pl-4">
                {members.map((m) => <li key={m.zid}>{m.name} {m.is_leader && '(Leader)'}</li>)}
              </ul>
            ))}
          </div>

          {/* Task List */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">📂 Task List</h3>
            {renderContent(loading.tasks, errors.tasks, tasks, (list) => (
              list.length > 0 ? (
                <ul className="text-base text-gray-700 list-disc pl-4">
                  {list.map((task, index) => (
                    <li key={index}>
                      <span className="font-medium">{task.task_name}</span> – <span className="italic text-gray-500">{task.status_name}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-500">No tasks assigned</p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;