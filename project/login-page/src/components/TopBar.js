// src/components/Topbar.js
import React, { useState, useEffect } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems, } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { useCourse } from './CourseContext';

// Topbar component that displays and allows course selection
const Topbar = ({ username }) => {
  const { selectedCourse, setSelectedCourse } = useCourse();
  const [courses, setCourses] = useState([]);

  // Fetch all available courses on component mount
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch('http://localhost:5001/courses');
        const data = await response.json();
        setCourses(data);
      } catch (error) {
        console.error('Error fetching courses:', error);
      }
    };

    fetchCourses();
  }, []);

  return (
    <Menu as="div" className="relative">
      {/* Topbar dropdown button */}
      <MenuButton className="flex items-center h-16 px-3 gap-1 text-lg text-gray-800 hover:text-indigo-600 focus:outline-none">
        <span className="font-semibold">{selectedCourse}</span>
        <ChevronDownIcon className="w-4 h-4 text-gray-500" aria-hidden="true" />
      </MenuButton>

      {/* Dropdown menu listing available courses */}
      <MenuItems className="absolute z-10 mt-2.5 w-64 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in  no-underline">
        <div className="py-1">
          {courses.length === 0 ? (
            <MenuItem disabled>
              <div className="px-4 py-2 text-sm text-gray-400">Loading...</div>
            </MenuItem>
          ) : (
            courses.map(course => (
              <MenuItem key={course.code}>
                {({ active }) => (
                  <button
                    onClick={() => setSelectedCourse(course.code)}
                    className={`block w-full px-4 py-2 text-left text-sm ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                      }`}
                  >
                    {course.code} - {course.name}
                  </button>
                )}
              </MenuItem>
            ))
          )}
        </div>
      </MenuItems>
    </Menu>
  );
};

export default Topbar;
