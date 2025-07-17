// src/components/CourseContext.js
import React, { createContext, useContext, useState } from 'react';

const CourseContext = createContext();

export const useCourse = () => useContext(CourseContext);

export const CourseProvider = ({ children }) => {
  // Get the previously selected course from localStorage, defaults to ‘Course’ if not available.
  const initialCourse = localStorage.getItem("selectedCourse") || 'Course';
  const [selectedCourse, setSelectedCourse] = useState(initialCourse);

  // Encapsulate the update function to store the value in localStorage while updating the state and refreshing the page.
  const updateCourse = (course) => {
    localStorage.setItem("selectedCourse", course);
    setSelectedCourse(course);
    window.location.reload(); // Refresh the page
  };

  return (
    <CourseContext.Provider value={{ selectedCourse, setSelectedCourse: updateCourse }}>
      {children}
    </CourseContext.Provider>
  );
};
