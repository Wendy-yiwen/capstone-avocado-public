import React, { useState, useEffect, useRef } from 'react';
import './WorklogTable.css';

// WorklogTable component: display and manage editable task table
const WorklogTable = ({ data, statuses, assignments, loading, groupId, teamMembers, username, userId, onCreate }) => {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editIndex, setEditIndex] = useState(null);  // Row currently being edited
  const [editedData, setEditedData] = useState({});  // Temporary storage of edited data
  const [addingNew, setAddingNew] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState(null);

  const [newTask, setNewTask] = useState({
    type: 'Private',
    assignmentId: '', // The ID of the assignment selected by select
    name: '',
    description: '',
    status: 'To Do',   // The initial state is To Do, prompting the user to select the
    assignee: '',     // If the type is Group, the user needs to select assignee (where the zid of the selected member is stored).
    dueDate: ''
  });

  // Filtered task list based on dropdown selections
  const filteredData = data.filter(task =>
    (typeFilter === "all" || task.type === typeFilter) &&
    (statusFilter === "all" || task.status === statusFilter)
  );

  // Deletion handler (currently only updates local state)
  const handleDeleteRow = (indexToDelete) => {
    const updated = data.filter((_, i) => i !== indexToDelete);
    console.log("🗑️ Deleted row index:", indexToDelete);
    setEditIndex(null);
    // 👉 If onChange was passed in, you can call it to pass updated.
  };

  // If it is a Group, and it is transferred from Private, rowData.assignee is checked by default.
  const prevType = useRef();
  useEffect(() => {
    if (editIndex !== null && prevType.current === "Private" && editedData.type === "Group") {
      setEditedData((prev) => ({
        ...prev,
        assignee: editedData.origin_assignee_id || ""
      }));
    }
    prevType.current = editedData.type;
  }, [editedData.type, editIndex]);

  return (
    <>
      <hr />
      <h5 className="worklog-title">Worklog</h5>
      <table className="table worklog-table">
        {/* ===== Table Header: includes filter dropdowns ===== */}
        <thead>
          <tr>
            <th className="text-center">
              <select
                className="form-select form-select-sm worklog-header-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Type</option>
                <option value="Group">Group</option>
                <option value="Private">Private</option>
              </select>
            </th>
            <th>Assignment ID</th>
            <th>Task Name</th>
            <th>Description</th>
            <th className="text-center">
              <select
                className="form-select form-select-sm worklog-header-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Status</option>
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            </th>
            <th>Assignee</th>
            <th>Due Date</th>
            <th className="text-center">Action</th>
          </tr>
        </thead>

        {/* ===== Table Body: editable task rows + new task form ===== */}
        <tbody>
          {filteredData.length === 0 ? (
            // No task
            <tr>
              <td colSpan="8" className="text-muted text-center">No tasks found</td>
            </tr>
          ) : (
            filteredData.map((task, index) => {
              const isEditing = editIndex === index;
              const rowData = isEditing ? editedData : task;

              return (
                <tr key={index}>
                  {/* Type */}
                  <td className="text-center">
                    {isEditing ? (
                      <select
                        className="form-select form-select-sm worklog-select"
                        value={rowData.type}
                        onChange={(e) => {
                          const type = e.target.value;
                          setEditedData({
                            ...editedData,
                            type,
                            // If the type is Private, assign username directly.
                            assignee: type === "Private" ? username : editedData.origin_assignee_id || ""
                          });
                        }}
                      >
                        <option value="Private">Private</option>
                        <option value="Group">Group</option>
                      </select>
                    ) : (
                      rowData.type
                    )}
                  </td>

                  {/* Assignment Name */}
                  <td>
                    {isEditing ? (
                      <select
                        className="form-select form-select-sm"
                        value={editedData.assignmentId}  // Use assignmentId as value
                        onChange={(e) =>
                          setEditedData({ ...editedData, assignmentId: e.target.value })
                        }
                      >
                        <option value="">Select Assignment</option>
                        {assignments.map((assignment) => (
                          <option key={assignment.id} value={assignment.id}>
                            {assignment.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      rowData.assignmentName
                    )}
                  </td>

                  {/* Task Name */}
                  <td>
                    {isEditing ? (
                      <input
                        className="form-control form-control-sm"
                        value={rowData.name}
                        onChange={(e) =>
                          setEditedData({ ...rowData, name: e.target.value })
                        }
                      />
                    ) : (
                      rowData.name
                    )}
                  </td>

                  {/* Description */}
                  <td title={rowData.description}>
                    {isEditing ? (
                      <input
                        className="form-control form-control-sm"
                        value={rowData.description}
                        onChange={(e) =>
                          setEditedData({ ...rowData, description: e.target.value })
                        }
                      />
                    ) : (
                      rowData.description
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    {isEditing ? (
                      <select
                        className="form-select form-select-sm worklog-select"
                        value={rowData.status}
                        onChange={(e) =>
                          setEditedData({ ...rowData, status: e.target.value })
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status.status_id} value={status.status_name}>
                            {status.status_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      rowData.status
                    )}
                  </td>

                  {/* Assignee */}
                  <td>
                    {isEditing ? (
                      editedData.type === "Group" ? (
                        <select
                          className="form-select form-select-sm"
                          value={editedData.assignee} // For saving new selections
                          onChange={(e) => setEditedData({ ...editedData, assignee: e.target.value })}
                        >
                          <option value="">Select Assignee</option>
                          {teamMembers.map((member) => (
                            <option key={member.zid} value={member.zid}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="form-control form-control-sm"
                          value={username}
                          disabled
                        />
                      )
                    ) : (
                      rowData.assignee
                    )}
                  </td>

                  {/* Due Date */}
                  <td>
                    {isEditing ? (
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={rowData.dueDate}
                        onChange={(e) =>
                          setEditedData({ ...rowData, dueDate: e.target.value })
                        }
                      />
                    ) : (
                      rowData.dueDate
                    )}
                  </td>

                  {/* Edit Button */}
                  <td className="text-center">
                    {isEditing ? (
                      <div className="text-center">
                        {/* Save Button */}
                        <div>
                          <button
                            className="btn btn-outline-success btn-sm mb-1"
                            onClick={async () => {
                              // Validate Required Fields
                              if (!editedData.name.trim()) {
                                alert("Task name is required.");
                                return;
                              }
                              if (editedData.status === "None") {
                                alert("Please select a valid status.");
                                return;
                              }
                              if (!editedData.assignmentId) {
                                alert("Please select an assignment.");
                                return;
                              }
                              if (!editedData.dueDate) {
                                alert("Due date is required.");
                                return;
                              }
                              if (editedData.type === "Group") {
                                if (!groupId) {
                                  alert("Group ID is required for group tasks.");
                                  return;
                                }
                                if (!editedData.assignee || editedData.assignee === "") {
                                  alert("Please select an assignee for group tasks.");
                                  return;
                                }
                              }

                              // Get status objects from statuses
                              const statusObj = statuses.find(s => s.status_name === editedData.status);
                              if (!statusObj) {
                                alert("Invalid status selected.");
                                return;
                              }

                              // Construct the payload, where assignment_id is also converted to an integer
                              const payload = {
                                task_name: editedData.name,
                                description: editedData.description,
                                status_id: statusObj.status_id,
                                type: editedData.type,
                                group_id: editedData.type === "Group" ? groupId : null,
                                parent_task_id: editedData.parentId ? editedData.parentId : null,
                                assignment_id: parseInt(editedData.assignmentId),
                                due_date: editedData.dueDate,
                                assignee_id: editedData.type === "Private" ? userId : editedData.assignee
                              };

                              try {
                                // Note the use of editedData.origin_assignee_id as a filter Note the use of editedData.origin_assignee_id as a filter
                                console.log(editedData.origin_assignee_id);
                                const response = await fetch(`http://localhost:5001/tasks/${editedData.taskId}/${editedData.origin_assignee_id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(payload)
                                });
                                if (!response.ok) {
                                  const errData = await response.json();
                                  throw new Error(errData.error || "Error updating task.");
                                }
                                const updatedTask = await response.json();
                                console.log("✅ Updated task:", updatedTask);

                                if (onCreate) {
                                  onCreate(); // refresh task list
                                }
                                setEditIndex(null);
                              } catch (error) {
                                console.error("Error updating task:", error);
                                alert("Failed to update task: " + error.message);
                              }
                            }}
                          >
                            Save
                          </button>
                        </div>
                        {/* Delete Button */}
                        <div>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={async () => {
                              if (!editedData.taskId) {
                                alert("Invalid task identifier.");
                                return;
                              }
                              // Save the original assigneeId to editedData, 
                              // named origin_assignee_id Determine the assignee_id to use for deletion based on the type of assignment
                              const deleteAssigneeId = editedData.type === "Private"
                                ? userId
                                : editedData.origin_assignee_id;
                              if (!deleteAssigneeId) {
                                alert("Original assignee id not found.");
                                return;
                              }

                              try {
                                const response = await fetch(`http://localhost:5001/tasks/${editedData.taskId}/${deleteAssigneeId}`, {
                                  method: "DELETE",
                                  headers: { "Content-Type": "application/json" }
                                });
                                if (!response.ok) {
                                  const errData = await response.json();
                                  throw new Error(errData.error || "Error deleting task.");
                                }
                                const deletedTask = await response.json();
                                console.log("✅ Deleted task:", deletedTask);
                                if (onCreate) {
                                  onCreate(); // refresh task list
                                }
                                setEditIndex(null);
                              } catch (error) {
                                console.error("Error deleting task:", error);
                                alert("Failed to delete task: " + error.message);
                              }
                            }}
                          >
                            Delete
                          </button>

                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => {
                          // Save the original assigneeId to editedData, named origin_assignee_id
                          setEditIndex(index);
                          setEditedData({ ...task, origin_assignee_id: task.assigneeId, assignee: task.assigneeId });
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}

          {/* ===== Row for creating a new task ===== */}
          {addingNew ? (
            <tr>
              {/* Type */}
              <td>
                <select
                  className="form-select form-select-sm worklog-select"
                  value={newTask.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    setNewTask({
                      ...newTask,
                      type,
                      assignee: type === "Private" ? username : newTask.assignee,
                    });
                  }}
                >
                  <option value="Private">Private</option>
                  <option value="Group">Group</option>
                </select>
              </td>
              {/* assignmentName */}
              <td>
                <select
                  className="form-select form-select-sm"
                  value={newTask.assignmentId}
                  onChange={(e) => setNewTask({ ...newTask, assignmentId: e.target.value })}
                >
                  <option value="">Select</option>
                  {assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.name}
                    </option>
                  ))}
                </select>
              </td>
              {/* Task Name */}
              <td>
                <input
                  className="form-control form-control-sm"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                />
              </td>
              {/* Description */}
              <td>
                <input
                  className="form-control form-control-sm"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
              </td>
              {/* Status */}
              <td>
                <select
                  className="form-select form-select-sm worklog-select"
                  value={newTask.status}
                  onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </td>
              {/* Assignee */}
              <td>
                {newTask.type === "Group" ? (
                  <select
                    className="form-select form-select-sm"
                    value={newTask.assignee}
                    onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                  >
                    <option value="">Select Assignee</option>
                    {teamMembers.map((member) => (
                      <option key={member.zid} value={member.zid}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-control form-control-sm"
                    value={username}
                    disabled
                  />
                )}
              </td>
              {/* Due Date */}
              <td>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </td>
              {/* New Save button */}
              <td className="text-center">
                <div>
                  <button
                    className="btn btn-outline-success btn-sm mb-1"
                    onClick={async () => {
                      // 1. Validating required fields
                      if (!newTask.name.trim()) {
                        alert("Task name is required.");
                        return;
                      }
                      if (newTask.status === "None") {
                        alert("Please select a valid status.");
                        return;
                      }
                      if (!newTask.assignmentId) {
                        alert("Please select an assignment.");
                        return;
                      }
                      if (!newTask.dueDate) {
                        alert("Due date is required.");
                        return;
                      }
                      if (newTask.type === "Group") {
                        if (!groupId) {
                          alert("Group ID is required for group tasks.");
                          return;
                        }
                        if (!newTask.assignee) {
                          alert("Please select an assignee for group tasks.");
                          return;
                        }
                      }

                      // 2. look up the corresponding status_id from statuses based on newTask.status
                      const statusObj = statuses.find(s => s.status_name === newTask.status);
                      if (!statusObj) {
                        alert("Invalid status selected.");
                        return;
                      }

                      // 3. Assembling the payload
                      const payload = {
                        task_name: newTask.name,
                        description: newTask.description,
                        status_id: statusObj.status_id,
                        type: newTask.type,
                        group_id: newTask.type === "Group" ? groupId : null,
                        parent_task_id: null, // change to null
                        assignment_id: parseInt(newTask.assignmentId), // Make sure to pass in integers
                        due_date: newTask.dueDate,
                        assignee_id: newTask.type === "Private" ? userId : newTask.assignee
                      };

                      try {
                        const response = await fetch("http://localhost:5001/create-task", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json"
                          },
                          body: JSON.stringify(payload)
                        });

                        if (!response.ok) {
                          const errData = await response.json();
                          throw new Error(errData.error || "Error inserting task.");
                        }
                        const insertedTask = await response.json();
                        console.log("✅ Created task:", insertedTask);

                        // Call the onCreate callback passed by the parent component to update the task list (if any)
                        if (onCreate) {
                          onCreate(insertedTask);
                          console.log('save!')
                        }

                        // Clear the new line status and exit the new line mode
                        setNewTask({ type: 'Private', assignmentId: '', name: '', description: '', status: 'To Do', assignee: '', dueDate: '' });
                        setAddingNew(false);
                      } catch (error) {
                        console.error("Error inserting task:", error);
                        alert("Failed to create task: " + error.message);
                      }
                    }}
                  >
                    Save
                  </button>


                </div>
                <div>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    style={{ minWidth: '70px' }}
                    onClick={() => {
                      setAddingNew(false);
                      setNewTask({ type: 'Private', assignmentName: '', name: '', description: '', status: 'To Do', assignee: '', dueDate: '' });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          ) : (
            <tr
              onClick={() => setAddingNew(true)}
              className="create-row"
              style={{ cursor: 'pointer' }}
            >
              <td colSpan="8" className="text-center fw-bold" style={{ color: "#515258" }}>
                + Create
              </td>
            </tr>
          )}

        </tbody>
      </table>

      {/* ===== Delete confirmation modal ===== */}
      {showDeleteModal && (
        <div
          className="modal show fade"
          style={{ display: 'block', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ borderBottom: 'none' }}>
                <h2 className="modal-title">Confirm Deletion</h2>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete this task?</p>
              </div>
              <div className="modal-footer" style={{ borderTop: 'none' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    handleDeleteRow(deleteTargetIndex);
                    setShowDeleteModal(false);
                    setDeleteTargetIndex(null);
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default WorklogTable;
