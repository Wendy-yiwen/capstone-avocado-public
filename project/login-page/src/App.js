import React, { useState } from 'react';
import LoginPage from './LoginPage';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CourseProvider } from './components/CourseContext';
import DashboardPage from './Dashboard'
import MeetingPage from './Meeting';
import NewMeetingPage from './NewMeeting';
import HomePage from './Homepage';
import RegisterPage from './Register';
import EvaluationPage from './Evaluation';
import TaskPage from './Task';
import ChannelPage from './channelpage';
import TeacherDashboard from './TeacherDashboard'
import TeacherHomePage from './TeacherHome'
import Assignment from './Assignment'
import GroupPage from './Group';

// App component: main entry point with all route definitions
function App() {
  const [username, setUsername] = useState(""); // Store logged-in username

  return (
    <CourseProvider>
      <Router>
        {/* Define routes for student and teacher pages */}
        <Routes>
          <Route path="/" element={<LoginPage setUsername={setUsername} />} />
          <Route path="/Login" element={<LoginPage />} />
          <Route path="/Register" element={<RegisterPage />} />
          {/* Student-specific pages */}
          <Route path="/Dashboard" element={<DashboardPage setUsername={username} />} />
          <Route path="/Meeting" element={<MeetingPage setUsername={username} />} />
          <Route path="/New-Meeting" element={<NewMeetingPage setUsername={username} />} />
          <Route path="/Home" element={<HomePage setUsername={username} />} />
          <Route path="/Task" element={<TaskPage setUsername={username} />} />
          <Route path="/Channel" element={<ChannelPage setUsername={username} />} />
          <Route path="/Evaluation" element={<EvaluationPage setUsername={username} />} />
          {/* Teacher-specific pages */}
          <Route path="/teacher/TeacherDashboard" element={<TeacherDashboard setUsername={username} />} />
          <Route path="/teacher/TeacherHome" element={<TeacherHomePage setUsername={username} />} />
          <Route path="/teacher/Assignment" element={<Assignment setUsername={username} />} />
          <Route path="/teacher/Group" element={<GroupPage setUsername={username} />} />
        </Routes>
        {/* Global toast message display */}
        <ToastContainer position="top-center" autoClose={2000} />
      </Router>
    </CourseProvider>
  );
}

export default App;