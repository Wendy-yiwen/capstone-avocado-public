import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Register.css';
import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { toast } from 'react-toastify';
import logo from './assets/Logo.png'
import 'bootstrap/dist/css/bootstrap.min.css';

const RegisterPage = () => {
  const [zid, setZid] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [isLeader, setIsLeader] = useState(false);
  const [isNewGroup, setIsNewGroup] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [roles, setRoles] = useState([]);
  const [courses, setCourses] = useState([]);  // Added: Course List
  const [groups, setGroups] = useState([]);  // Added: Course List

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  // Get the list of characters
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await axios.get('http://localhost:5001/roles');
        setRoles(response.data); // Setting up a list of roles
      } catch (error) {
        setErrorMessage('Failed to load roles list');
      }
    };
    fetchRoles();
  }, []);

  // Get course list
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get('http://localhost:5001/courses');
        setCourses(response.data); // Setting up a course list
      } catch (error) {
        setErrorMessage('Failed to load courses list');
      }
    };
    fetchCourses();
  }, []);

  // Get group list
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await axios.get('http://localhost:5001/groups');
        setGroups(response.data); // Setting up a course list
      } catch (error) {
        setErrorMessage('Failed to load courses list');
      }
    };
    fetchGroups();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        zid,
        name,
        password,
        role_id: roleId,
        course_code: courseCode,
        is_leader: isLeader,
        is_new_group: isNewGroup,
        ...(isNewGroup ? { group_name: groupName } : { group_id: groupId })
      };

      const response = await axios.post('http://localhost:5001/register', payload);

      if (response.data.status === 'success') {
        toast.success('🎉 Registration successful!');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed';
      const code = error.response?.data?.code || 'UNKNOWN';
    
      switch (code) {
        case 'GROUP_MISMATCH':
          toast.error('Group and course do not match !');
          break;
        case 'ALREADY_EXISTS':
          toast.warn('User already exists !');
          break;
        case 'MISSING_FIELDS':
          toast.warn('Please complete all fields !');
          break;
        default:
          toast.error(`Registration failed !`);
      }
    }
    
  };

  return (
    <div class="flex min-h-full flex flex-col justify-center px-4 py-12 lg:px-8 ">
      <img class="mx-auto h-20 w-auto mt-2" src={logo} alt="logo" />
      <h2 class=" text-center text-2xl/9 font-bold tracking-tight text-gray-900">Create an account</h2>
      <div class="mt-2 sm:mx-auto sm:w-full sm:max-w-sm">
        <form class="space-y-3" onSubmit={handleRegister}>
          <label for="ZID" class="block text-sm/6 font-semibold text-gray-900">
            ZID
          </label>
          <div class="mt-2">
            <input name="zid" id="zid" autocomplete="zid" required=""
              class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              value={zid}
              onChange={(e) => setZid(e.target.value)}
            />
          </div>

          <div class="flex items-center justify-between">
            <label for="password" class="block text-sm/6 font-semibold text-gray-900">Password
            </label>
          </div>
          <div class="mt-2">
            <input type="password" name="password" id="password" autocomplete="current-password" required=""
              class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              onChange={(e) => setPassword(e.target.value)}
              value={password}
            />
          </div>

          <label for="ZID" class="block text-sm/6 font-semibold text-gray-900" >
            Name
          </label>
          <div class="mt-2">
            <input name="name" id="name" autocomplete="name" required=""
              class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <label for="location" class="block text-sm/6 font-semibold text-gray-900">Role</label>
          <div class="mt-2 grid grid-cols-1">
            <select id="location" name="location"
              class="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              value={roleId || ''}  // Ensure default value is empty string
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option>Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4" aria-hidden="true" />
          </div>



          <label for="location" class="block text-sm/6 font-semibold text-gray-900">Course code</label>
          <div class="mt-2 grid grid-cols-1">
            <select id="location" name="location"
              class="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              value={courseCode || ''}  // Ensure default value is empty string
              onChange={(e) => setCourseCode(e.target.value)}
            >
              <option>Select a course</option>
              {courses.map((course) => (
                <option key={course.code} value={course.code}>
                  {course.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4" aria-hidden="true" />
          </div>

          <div class="form-check">
            <input class="form-check-input" type="checkbox" value="" id="checkDefault"
              checked={isLeader}
              onChange={(e) => setIsLeader(e.target.checked)}
            />
            <label class="form-check-label" for="checkDefault">
              Leader
            </label>
          </div>


          <label for="location" class="block text-sm/6 font-semibold text-gray-900">New group</label>
          <div class="mt-2 grid grid-cols-1">
            <select id="location" name="location"
              class="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              value={isNewGroup ? 'yes' : 'no'}
              onChange={(e) => setIsNewGroup(e.target.value === 'yes')}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            {isNewGroup ? (
              <div>
                <label className="block text-sm/6 font-semibold text-gray-900">Group Name</label>
                <input type="password" name="password" id="password" autocomplete="current-password" required=""
                  class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm/6 font-semibold text-gray-900">Group ID</label>
                <select
                  className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  value={groupId || ''}  // Ensure default value is empty string
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">Select a group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <ChevronDownIcon class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4" aria-hidden="true" />
          </div>

          <button type="submit"
            class="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            Register
          </button>

        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
