import React, { use } from 'react';
import { Link, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Task.css';
import WorklogTable from './components/WorklogTable';
import DashboardPage from './Dashboard';
import { useEffect, useState } from 'react';
import { useCourse } from './components/CourseContext';

const TaskPage = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?.id;
  console.log('userId:', userId);
  const { selectedCourse } = useCourse();
  const [username, setUsername] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assignments, setAssignments] = useState([]); // Stores the list of jobs obtained from the API
  const [errors, setErrors] = useState({ tasks: null });
  const [loading, setLoading] = useState({ tasks: true });
  const [groupId, setGroupId] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);

  // Get username via api username
  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      try {
        const response = await fetch(`http://localhost:5001/username?zid=${userId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        setUsername(data.name);  // Setting the retrieved user name
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    fetchUser();
  }, [userId]);

  // Getting Task Status
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const response = await fetch('http://localhost:5001/statuses');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        setStatuses(data);  // Sets the status data retrieved
      } catch (error) {
        console.error("Error fetching statuses:", error);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchStatuses();
  }, []);

  console.log('username: ', username);
  console.log(selectedCourse);

  // Get a list of assignments for the current course
  useEffect(() => {
    if (!selectedCourse) return;

    const fetchAssignments = async () => {
      try {
        const response = await fetch(`http://localhost:5001/assignments-Course-Based?course_code=${selectedCourse}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setAssignments(data);
      } catch (error) {
        setErrors(prev => ({ ...prev, assignments: error.message }));
        console.error("Error fetching assignments:", error);
      }
    };

    fetchAssignments();
  }, [selectedCourse]);

  /** GET groupId **/
  useEffect(() => {
    if (!userId) return;
    if (!selectedCourse) return;

    const fetchGroupId = async () => {
      try {
        const response = await fetch(`http://localhost:5001/group-id?zid=${userId}&course_code=${selectedCourse}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        setGroupId(data.group_id);  // Set the fetched groupId
      } catch (error) {
        console.error("Error fetching groupId:", error);
      }
    };

    fetchGroupId();
  }, [userId, selectedCourse]);

  console.log(username);
  console.log(groupId);


  /** GET group member **/
  useEffect(() => {
    if (!groupId) return;

    const fetchGroupMembers = async () => {
      try {
        const response = await fetch(`http://localhost:5001/group-members?group_id=${groupId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        setTeamMembers(data.members);  // Set the fetched team members
      } catch (error) {
        console.error("Error fetching group members:", error);
      }
    };

    fetchGroupMembers();
  }, [groupId]);

  console.log(teamMembers);

  /** Get User Tasks */
  useEffect(() => {
    if (!userId) return;
    if (!selectedCourse) return;

    const fetchTasks = async () => {
      try {
        const response = await fetch(`http://localhost:5001/tasks?zid=${userId}&course_code=${selectedCourse}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        // ⚙️ Into the structure of todoWorklog
        const formattedTasks = data.map(task => ({
          taskId: task.task_id,
          name: task.task_name,
          type: task.type,
          description: task.description,
          statusId: task.status_id,
          status: task.status_name,
          parentId: task.parent_task_id,
          assignmentId: task.assignment_id,
          assignmentName: task.assignment_name,
          courseCode: task.course_code,
          groupId: task.group_id,
          assigneeId: task.assignee_id,
          assignee: task.assignee_names,
          dueDate: task.due_date || null // optional: format if needed
        }));

        setTasks(formattedTasks); // ✅ Deposit status in new format
        // setTasks(data);
      } catch (error) {
        setErrors(prev => ({ ...prev, tasks: error.message }));
        console.error("Error fetching tasks:", error);
      } finally {
        setLoading(prev => ({ ...prev, tasks: false }));
      }
    };

    fetchTasks();
  }, [userId]);

  /** Refresh Task List **/
  const refreshTasks = async () => {
    if (!userId) return;
    if (!selectedCourse) return;
    try {
      const response = await fetch(`http://localhost:5001/tasks?zid=${userId}&course_code=${selectedCourse}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      // Convert the returned data into the format needed by the front-end
      const formattedTasks = data.map(task => ({
        taskId: task.task_id,
        name: task.task_name,
        type: task.type,
        description: task.description,
        statusId: task.status_id,
        status: task.status_name,
        parentId: task.parent_task_id,
        assignmentId: task.assignment_id,
        assignmentName: task.assignment_name,
        courseCode: task.course_code,
        groupId: task.group_id,
        assigneeId: task.assignee_id,
        assignee: task.assignee_names,
        dueDate: task.due_date || null // optional: format if needed
      }));

      setTasks(formattedTasks);
    } catch (error) {
      setErrors(prev => ({ ...prev, tasks: error.message }));
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(prev => ({ ...prev, tasks: false }));
    }
    console.log("✅ Refreshed tasks");
  };


  const tasksByStatus = {
    todo: tasks.filter(task => task.status === 'To Do'),
    inProgress: tasks.filter(task => task.status === 'In Progress'),
    done: tasks.filter(task => task.status === 'Done')
  };

  const renderTasks = (tasks) =>
    tasks.map((task, index) => (
      <div key={index} className="task-card mb-3">
        <div className="task-title">{task.name}</div>
      </div>
    ));

  return (
    <>
      <DashboardPage />
      {/* Right side task display */}
      <div className="pl-80 px-5" id="task-container">
        <div className="task-content">
          <h2 className="my-4 text-center">My Tasks</h2>

          {/* 3 Lists */}
          <h5 className="worklog-title">Board</h5>
          <div className="row align-items-stretch">
            <div className="col-md-4">
              <div className="task-column">
                <h5 className="task-status-title">To Do</h5>
                {renderTasks(tasksByStatus.todo)}
              </div>
            </div>
            <div className="col-md-4">
              <div className="task-column">
                <h5 className="task-status-title">In Progress</h5>
                {renderTasks(tasksByStatus.inProgress)}
              </div>
            </div>
            <div className="col-md-4">
              <div className="task-column">
                <h5 className="task-status-title">Done</h5>
                {renderTasks(tasksByStatus.done)}
              </div>
            </div>
          </div>

          {/* Worklog */}
          <WorklogTable
            data={tasks}
            statuses={statuses}
            assignments={assignments}
            loading={loading}
            groupId={groupId}
            teamMembers={teamMembers}
            username={username}
            userId={userId}
            onCreate={refreshTasks}
          />
        </div>
      </div>
    </>
  );
};

export default TaskPage;
