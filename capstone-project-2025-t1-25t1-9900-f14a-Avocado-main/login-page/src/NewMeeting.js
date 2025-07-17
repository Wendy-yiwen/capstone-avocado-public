import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './NewMeeting.css';
import { Link, useLocation } from 'react-router-dom';
import DashboardPage from './Dashboard';
import axios from 'axios';
import { useCourse } from './components/CourseContext';
import { toast } from 'react-toastify';

// New Meeting creation page
const NewMeetingPage = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?.id;
  const { selectedCourse } = useCourse();

  // Form input states
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [assignmentName, setAssignmentName] = useState('');
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [timeError, setTimeError] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Fetch all courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get('http://localhost:5001/courses');
        setCourses(response.data);
        const courseObj = response.data.find(c => c.code === selectedCourse);
        if (courseObj) {
          setCourseName(courseObj.name);
        }
      } catch (error) {
        console.error('Failed to load courses list', error);
      }
    };
    fetchCourses();
  }, [selectedCourse]);

  // Fetch assignments for the selected course
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!selectedCourse) return;
      try {
        const response = await axios.get(`http://localhost:5001/assignments-Course-Based?course_code=${selectedCourse}`);
        setAssignments(response.data);
      } catch (error) {
        console.error('Failed to load assignments', error);
      }
    };
    fetchAssignments();
  }, [selectedCourse]);

  // Validate start and end time
  useEffect(() => {
    if (!start || !end) return;
    if (end <= start) {
      setTimeError('End time must be after start time.');
    } else {
      setTimeError('');
    }
  }, [start, end]);

  // When user picks start time, auto suggest end time
  const handleStartChange = (e) => {
    const newStart = e.target.value;
    setStart(newStart);
    const [hour, minute] = newStart.split(':').map(Number);
    const endHour = hour + 1;
    const suggestedEnd = `${endHour < 10 ? '0' : ''}${endHour}:${minute < 10 ? '0' : ''}${minute}`;
    setEnd(suggestedEnd);
  };

  // Handle assignment dropdown selection
  const handleAssignmentChange = (e) => {
    const selectedId = Number(e.target.value);
    setAssignmentId(selectedId);
    const selectedAssignment = assignments.find(
      assignment => assignment.id === selectedId
    );
    setAssignmentName(selectedAssignment ? selectedAssignment.name : '');
  };

  // Convert local Sydney time to UTC
  const convertToUTC = (dateStr, timeStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);

    // Create Date object in Sydney local time zone
    const sydneyDate = new Date(year, month - 1, day, hour, minute);

    // Convert Sydney time to UTC
    const utcDate = new Date(sydneyDate.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    return utcDate.toISOString();  // Return UTC ISO string
  };

  // When user submits, show confirmation modal
  const handleSubmit = (e) => {
    e.preventDefault();
    setShowModal(true);
  };

  // Confirm and send booking request to server
  const handleConfirm = async () => {
    try {
      const groupId_response = await axios.get(`http://localhost:5001/group-id?zid=${userId}&course_code=${selectedCourse}`);
      const groupId = groupId_response.data.group_id;

      const startDateTime = convertToUTC(date, start);
      const endDateTime = convertToUTC(date, end);

      const meetingData = {
        group_id: groupId,
        assignment_id: assignmentId,
        start: startDateTime,
        end: endDateTime,
        goal,
        meeting_title: title
      };

      const createResponse = await axios.post('http://localhost:5001/new-meetings', meetingData);
      toast.success('🎉 Meeting booked successfully!');
      setShowModal(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || '❌ Failed to book meeting');
      setShowModal(false);
    }
  };

  // Close the modal without submitting
  const handleReturn = () => setShowModal(false);

  return (
    <>
      <DashboardPage />
      <div className="pl-80 d-flex justify-content-center">
        <div className="new-meeting-content">
          <h2 className="text-center">New Meeting</h2>

          {/* Meeting booking form */}
          <form onSubmit={handleSubmit}>
            {/* Meeting Date */}
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {/* Meeting Start and End Time */}
            <div className="form-row1">
              <div className="form-group">
                <label className="form-label">Start</label>
                <input type="time" className="form-input form-time" value={start} onChange={handleStartChange} />
              </div>
              <div className="form-group">
                <label className="form-label">End</label>
                <input type="time" className="form-input form-time" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            {/* Time Error */}
            {timeError && (
              <div style={{ color: 'red', marginBottom: '12px', marginTop: '-8px' }}>
                {timeError}
              </div>
            )}

            {/* Assignment Selector */}
            <div className="form-row2">
              <div className="form-group">
                <label className="form-label">Assignment</label>
                <select className="form-select" value={assignmentId} onChange={handleAssignmentChange}>
                  <option value="">Select an assignment</option>
                  {assignments.length > 0 ? (
                    assignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>{assignment.name}</option>
                    ))
                  ) : (
                    <option value="" disabled>No assignments available</option>
                  )}
                </select>
              </div>
            </div>

            {/* Meeting Title and Goal */}
            <div className="form-group">
              <label className="form-label">Title</label>
              <input type="text" className="form-textarea" placeholder="Enter the title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Goal</label>
              <textarea className="form-textarea" rows="3" placeholder="Enter your goal" value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>

            {/* Submit Button */}
            <button type="submit" className="submit-button">Book</button>
          </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content1">
            <div className="modal-header">
              <h2 className="font-bold text-gray-800">Confirm the information</h2>
            </div>
            <div className="modal-info">
              <p><strong>Title:</strong> {title}</p>
              <p><strong>Date:</strong> {date}</p>
              <p><strong>Start:</strong> {start}</p>
              <p><strong>End:</strong> {end}</p>
              <p><strong>Course:</strong> {selectedCourse} - {courseName}</p>
              <p><strong>Assignment:</strong> {assignmentName || 'N/A'}</p>
              <p><strong>Goal:</strong> {goal}</p>
            </div>
            <div className="modal-buttons">
              <button onClick={handleConfirm} className="modal-button confirm-button">Confirm</button>
              <button onClick={handleReturn} className="modal-button return-button">Back</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewMeetingPage;
