import React, { useState, useEffect } from 'react';
import TeacherDashboard from './TeacherDashboard';
import './Assignment.css';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Assignment() {
  // State variables
  const [open, setOpen] = useState(false); // Modal visibility
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file selected');
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for selected course
  const [selectedCourse, setSelectedCourse] = useState('COMP1010');
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Fetch available courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data, error } = await supabase.from('courses').select('code, name');
        if (error) throw error;
        setCourses(data);
      } catch (error) {
        console.error('Error fetching courses:', error);
        setError('Failed to load courses');
      }
    };

    fetchCourses();
  }, []);

  // Fetch assignments based on selected course
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!selectedCourse) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('id, name, course_code, due_date, pdf_url')
          .eq('course_code', selectedCourse);
          
        if (error) throw error;
        
        // Transform data to match component's expected format
        const formattedAssignments = data.map(item => ({
          id: item.id,
          assignmentTitle: item.name,
          dueDate: item.due_date,
          fileName: item.pdf_url ? decodeURIComponent(new URL(item.pdf_url).pathname.split('/').pop()) : 'No file',
          fileUrl: item.pdf_url,
          course_code: item.course_code,
          state: 'Available'
        }));
        
        setAssignments(formattedAssignments);
      } catch (error) {
        console.error('Error fetching assignments:', error);
        setError('Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [selectedCourse]);

  // Handle course selection change
  const handleCourseChange = (e) => {
    setSelectedCourse(e.target.value);
  };

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
    }
  };

  // Save or update an assignment, upload file if needed
  const handleSave = async () => {
    if (!title || !dueDate || !selectedCourse) {
      alert('Please fill in all required fields');
      return;
    }
    setUploading(true);
    
    try {
      console.log("Starting file upload...");
      
      // 1. Upload file to Storage if there is one
      let fileUrl = null;
      
      if (file) {
        const filePath = `${selectedCourse}/${file.name}`;
        console.log("File to upload:", file);
        console.log("Target path:", filePath);
        
        // Upload file to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('assignments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true  // Change to true so that if the file already exists it will be overwritten
          });
        
        console.log("Upload response:", uploadData);
        console.log("Upload error:", uploadError);
        
        if (uploadError) throw uploadError;
        
        // Get the public URL of the file
        const { data: urlData } = supabase.storage
          .from('assignments')
          .getPublicUrl(filePath);
        
        console.log("File URL:", urlData.publicUrl);
        fileUrl = urlData.publicUrl;
      }
      
      // 2. Update or create assignment record
      if (isEdit) {
        // Edit existing assignment
        const { error } = await supabase
          .from('assignments')
          .update({
            name: title,
            due_date: dueDate,
            pdf_url: fileUrl || undefined // Only update if new file was uploaded
          })
          .eq('id', editingId);
          
        if (error) throw error;
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('assignments')
          .insert([{
            name: title,
            course_code: selectedCourse,
            due_date: dueDate,
            pdf_url: fileUrl
          }]);
          
        if (error) throw error;
      }
      
      // 3. Refresh assignments list
      const { data, error } = await supabase
        .from('assignments')
        .select('id, name, course_code, due_date, pdf_url')
        .eq('course_code', selectedCourse);
        
      if (error) throw error;
      
      const formattedAssignments = data.map(item => ({
        id: item.id,
        assignmentTitle: item.name,
        dueDate: item.due_date,
        fileName: item.pdf_url ? new URL(item.pdf_url).pathname.split('/').pop() : 'No file',
        fileUrl: item.pdf_url,
        course_code: item.course_code,
        state: 'Available'
      }));
      
      setAssignments(formattedAssignments);
      
      // Reset form and close modal
      setTitle('');
      setDueDate('');
      setFile(null);
      setFileName('No file selected');
      setOpen(false);
      setIsEdit(false);
      setEditingId(null);
      
    } catch (error) {
      console.error('Error saving assignment:', error);
      alert('Error saving assignment: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Delete an assignment (with optional file removal)
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    
    try {
      // First, get the assignment to check if it has a file
      const { data, error: fetchError } = await supabase
        .from('assignments')
        .select('pdf_url')
        .eq('id', id)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Delete the assignment record
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);
        
      if (deleteError) throw deleteError;
      
      // If there was a file, optionally delete it from storage
      // (You might want to keep files for record-keeping purposes)
      if (data.pdf_url) {
        const filePath = data.pdf_url.split('/').pop();
        // Uncomment if you want to delete the file too
        // const { error: storageError } = await supabase.storage
        //  .from('assignments')
        //  .remove([filePath]);
        //
        // if (storageError) console.error('Error deleting file:', storageError);
      }
      
      // Update the UI by removing the deleted assignment
      setAssignments(assignments.filter(item => item.id !== id));
      
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to delete assignment: ' + error.message);
    }
  };

  // Populate edit form when editing existing assignment
  const handleEdit = (item) => {
    setTitle(item.assignmentTitle);
    setDueDate(item.dueDate);
    setFileName(item.fileName);
    setFile(null);
    setEditingId(item.id);
    setIsEdit(true);
    setOpen(true);
  };

  // Test connection to Supabase storage
  const testStorageConnection = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('assignments')
        .getPublicUrl('test.txt');
      
      console.log("Storage bucket test:", data, error);
      
      if (error) {
        alert(`Storage connection error: ${error.message}`);
      } else {
        alert("Storage connection successful!");
      }
    } catch (e) {
      console.error("Test failed:", e);
      alert(`Test failed: ${e.message}`);
    }
  };

  return (
    <>
      <TeacherDashboard />
      <div className="px-4 sm:px-6 lg:px-8" id="asscontainer">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Assignment List</h1>
            <p className="mt-2 text-base text-gray-700">
              A list of all the assignments.
            </p>
          </div>
          
          {/* Course selector */}
          <div className="mt-4 sm:ml-16 sm:mt-0">
            <select
              value={selectedCourse}
              onChange={handleCourseChange}
              className="block rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              {courses.map((course) => (
                <option key={course.code} value={course.code}>
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Test Storage Connection Button */}
          <div className="mt-4 sm:ml-4 sm:mt-0">
            <button
              type="button"
              onClick={testStorageConnection}
              className="px-3 py-2 bg-gray-500 text-white rounded"
            >
              Test Storage Connection
            </button>
          </div>
          
          <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <button
              type="button"
              className="block rounded-md bg-indigo-600 px-3 py-2.5 text-center text-base font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              onClick={() => {
                setTitle('');
                setDueDate('');
                setFile(null);
                setFileName('No file selected');
                setIsEdit(false);
                setEditingId(null);
                setOpen(true);
              }}
            >
              Add New Assignment
            </button>
          </div>
        </div>
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-lg font-semibold text-gray-900 sm:pl-6">
                        Assignment
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-lg font-semibold text-gray-900">
                        Due Date
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-lg font-semibold text-gray-900">
                        State
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-lg font-semibold text-gray-900">
                        File
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="py-10 text-center text-gray-500">
                          Loading assignments...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan="5" className="py-10 text-center text-red-500">
                          {error}
                        </td>
                      </tr>
                    ) : assignments.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-10 text-center text-gray-500">
                          No assignments found for this course
                        </td>
                      </tr>
                    ) : (
                      assignments.map((item) => (
                        <tr key={item.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-base font-medium text-gray-900 sm:pl-6">
                            {item.assignmentTitle}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-base text-gray-500">
                            {new Date(item.dueDate).toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-base text-gray-500">
                            {item.state}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-base text-gray-500">
                            {item.fileUrl ? (
                              <button
                                onClick={() => downloadFile(item.fileUrl, item.fileName)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                {item.fileName}
                              </button>
                            ) : (
                              'No file'
                            )}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div className="space-x-3">
                              <button
                                type="button"
                                className="inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                                onClick={() => handleDelete(item.id)}
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal for creating/editing assignments */}
      {open && (
        <Dialog open={open} onClose={() => setOpen(false)} className="relative z-10">
          <DialogBackdrop
            transition
            className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
          />

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <DialogPanel
                transition
                className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
              >
                <div>
                  <div className="-mt-5 text-center">
                    <DialogTitle as="h3" className="text-lg font-semibold text-gray-900">
                      {isEdit ? 'Edit Assignment' : 'Create New Assignment'}
                    </DialogTitle>
                    <div className="mt-2">
                      <label htmlFor="assignmentTitle" className="block text-base font-bold text-gray-900 text-left">
                        Assignment Title
                      </label>
                      <input
                        id="assignmentTitle"
                        name="assignmentTitle"
                        type="text"
                        value={title}
                        placeholder="Assignment Title"
                        className="block w-full rounded-md bg-white px-3 py-1.5 mt-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                        onChange={(e) => setTitle(e.target.value)}
                      />
                      
                      <label htmlFor="dueDate" className="block text-base mt-2 font-bold text-gray-900 text-left">
                        Due Date
                      </label>
                      <input
                        id="dueDate"
                        name="dueDate"
                        value={dueDate}
                        type="datetime-local"
                        className="block w-full rounded-md bg-white px-3 py-1.5 mt-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                      
                      {!isEdit && (
                        <div className="mt-2">
                          <label htmlFor="courseCode" className="block text-base font-bold text-gray-900 text-left">
                            Course
                          </label>
                          <select
                            id="courseCode"
                            name="courseCode"
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            className="block w-full rounded-md bg-white px-3 py-1.5 mt-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                          >
                            {courses.map((course) => (
                              <option key={course.code} value={course.code}>
                                {course.code} - {course.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      <label htmlFor="assignmentFile" className="block text-base mt-2 font-bold text-gray-900 text-left">
                        Upload File
                      </label>
                      <input
                        id="assignmentFile"
                        name="assignmentFile"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="block w-full mt-2 text-base text-gray-900 file:mr-4 file:py-1.5 file:px-4
                            file:rounded-md file:border-0 file:text-sm file:font-semibold
                            file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
                        onChange={handleFileChange}
                      />
                      {isEdit && !file && (
                        <p className="mt-1 text-sm text-gray-500 text-left">
                          {fileName !== 'No file' 
                            ? `Current file: ${fileName}` 
                            : 'No file currently uploaded. Upload a new one to replace.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    onClick={handleSave}
                    disabled={uploading}
                  >
                    {uploading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </DialogPanel>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

// Utility function: download file with a signed URL
const downloadFile = async (fileUrl, fileName) => {
  try {
    console.log("Starting download:", fileUrl);
    
    // Extract course code from the file URL
    const courseCode = fileUrl.split('/').slice(-2)[0];
    console.log("Course code:", courseCode);
    
    // Get signed URL for download
    const { data: { signedUrl }, error: signedUrlError } = await supabase.storage
      .from('assignments')
      .createSignedUrl(`${courseCode}/${fileName}`, 60); // URL valid for 60 seconds
      
    if (signedUrlError) {
      throw signedUrlError;
    }
    
    // Download file using signed URL
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Create blob and trigger download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    a.remove();
  } catch (error) {
    console.error("Download error:", error);
    alert('Failed to download file: ' + error.message);
  }
};