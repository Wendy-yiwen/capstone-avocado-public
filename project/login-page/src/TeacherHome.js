import React, { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import TeacherDashboard from './TeacherDashboard';
import { useCourse } from './components/CourseContext';
import { Link } from 'react-router-dom';

const TeacherHomePage = () => {
  const { selectedCourse } = useCourse();
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);

  // Mock data acquisition
  useEffect(() => {
    const fetchData = async () => {
      try {
        const assRes = await fetch('http://localhost:5001/assignments');
        const assData = await assRes.json();
        setAssignmentCount(assData.length);

        const groupRes = await fetch('http://localhost:5001/groups');
        const groupData = await groupRes.json();
        setGroupCount(groupData.length);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <TeacherDashboard />
      <div className="pl-80 pr-14 pt-10">
        <div className="text-3xl font-bold text-gray-800 mb-8">👋 Welcome back, Teacher</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Courses */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">📘 Current Course</h3>
            <p className="text-indigo-600 text-xl font-bold">{selectedCourse || 'Not selected'}</p>
          </div>

          {/* Assignments */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">📂 Assignments</h3>
            <p className="text-indigo-600 text-xl font-bold">{assignmentCount}</p>
          </div>

          {/* Groups */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">👥 Groups</h3>
            <p className="text-indigo-600 text-xl font-bold">{groupCount}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherHomePage;
