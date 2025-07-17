require("dotenv").config(); // ✅ This must be at the top, loading the .env environment variable

const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 5001;

// Initializing the Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Using the server key
);

// Middleware
app.use(cors());
app.use(express.json());

/** 🚀 Login API */
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Queries whether the user exists in the database
    const { data, error } = await supabase
      .from('users')
      .select('zid, name, password, role_id')
      .eq('zid', username); // Match using username as zid

    if (error) throw error;
    if (data.length === 0) {
      return res.status(401).json({ message: 'User not found', status: 'fail' });
    }

    const user = data[0];

    // 📝 Direct comparison of passwords (unencrypted storage)
    if (user.password !== password) {
      return res.status(401).json({ message: 'Incorrect password', status: 'fail' });
    }
    // 📝 Get the group_id of the user
    const { data: groupData, error: groupError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('member_zid', user.zid);

    if (groupError) throw groupError;

    const groupId = groupData.length > 0 ? groupData[0].group_id : null;


    return res.json({
      message: 'success',
      status: 'success',
      user: { id: user.zid, name: user.name, role_id: user.role_id, groupid: groupId }
    });

  }

  catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 User Registration API (integration group function) */
app.post('/register', async (req, res) => {
  const {
    zid,
    name,
    password,
    role_id,
    course_code,
    is_leader,
    group_name,
    group_id,
    is_new_group
  } = req.body;

  try {
    // Basic field validation
    const requiredFields = ['zid', 'name', 'password', 'role_id', 'course_code', 'is_leader', 'is_new_group'];
    if (is_new_group) requiredFields.push('group_name');
    else requiredFields.push('group_id');

    const missingFields = requiredFields.filter(field => req.body[field] === undefined);
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Handle group logic
    let targetGroup;
    if (is_new_group) {
      // Create a new group (with course validation)
      const { data: newGroup, error } = await supabase
        .from('groups')
        .insert([{
          course_code,
          name: group_name.substring(0, 50) // Ensure it fits VARCHAR(50)
        }])
        .select()
        .single();

      if (error) throw new Error(`Group creation failed: ${error.message}`);
      targetGroup = newGroup;
    } else {
      // Validate existing group affiliation
      const { data: existingGroup, error } = await supabase
        .from('groups')
        .select('id, course_code')
        .eq('id', group_id)
        .single();

      if (error) throw new Error(`Group query failed: ${error.message}`);
      if (existingGroup.course_code !== course_code) {
        throw new Error('Group and course do not match');
      }
      targetGroup = existingGroup;
    }

    // Create user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([{
        zid,
        name,
        password,
        role_id
      }])
      .select()
      .single();

    if (userError) throw new Error(`User creation failed: ${userError.message}`);

    // Add group member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert([{
        group_id: targetGroup.id,
        member_zid: zid,
        is_leader
      }]);

    if (memberError) {
      // Transaction rollback
      await supabase.from('users').delete().eq('zid', zid);
      if (is_new_group) {
        await supabase.from('groups').delete().eq('id', targetGroup.id);
      }
      throw new Error(`Failed to join group: ${memberError.message}`);
    }

    // Return result (filter sensitive fields)
    res.status(201).json({
      status: 'success',
      data: {
        user: { ...newUser, password: undefined },
        group: {
          id: targetGroup.id,
          name: targetGroup.name,
          course_code: targetGroup.course_code
        }
      }
    });

  }
  catch (error) {
    console.error('Registration error:', error.message);
    let code = 'UNKNOWN';

    if (error.message.includes('Group and course do not match')) {
      code = 'GROUP_MISMATCH';
    } else if (error.message.includes('Missing required fields')) {
      code = 'MISSING_FIELDS';
    } else if (error.message.includes('Group creation failed')) {
      code = 'MISSING_FIELDS';
    } else if (error.message.includes('User creation failed')) {
      code = 'ALREADY_EXISTS';
    } else if (error.message.includes('Failed to join group')) {
      code = 'GROUP_JOIN_FAIL';
    }

    const statusCode = code === 'ALREADY_EXISTS' ? 409 : 500;
    res.status(statusCode).json({
      status: 'fail',
      message: error.message,
      code: code
    });
  }
});

/** 🚀 New-Meetings API */
app.post('/new-meetings', async (req, res) => {
  const { group_id, assignment_id, start, end, goal, meeting_title } = req.body;

  try {
    // Validating Required Fields
    const requiredFields = ['group_id', 'start', 'end'];
    const missingFields = requiredFields.filter(field => req.body[field] === undefined);
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Verification time
    if (new Date(end) <= new Date(start)) {
      return res.status(400).json({
        status: 'fail',
        message: 'End time must be greater than start time.'
      });
    }

    // Insert meeting
    const { data: meetingData, error: insertMeetingError } = await supabase
      .from('meetings')
      .insert([{
        group_id,
        assignment_id: assignment_id || null,
        goal: goal || null,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        status: 'scheduled',
        meeting_title: meeting_title
      }])
      .select()
      .single();

    if (insertMeetingError) {
      throw new Error(`Meeting creation failed: ${insertMeetingError.message}`);
    }

    const meeting_id = meetingData.id;

    // Queries all members of the group
    const { data: groupMembers, error: groupMemberError } = await supabase
      .from('group_members')
      .select('member_zid')
      .eq('group_id', group_id);

    if (groupMemberError) {
      throw new Error(`Fetching group members failed: ${groupMemberError.message}`);
    }

    // Constructs the records to be inserted into meeting_attendances.
    const attendanceRows = groupMembers.map(member => ({
      meeting_id,
      member_zid: member.member_zid,
      group_id,
      join_time: new Date(start).toISOString(),
      leave_time: new Date(start).toISOString(),
      meeting_duration_hour: 0,
      participation_duration_hour: 0
    }));

    if (attendanceRows.length > 0) {
      const { error: insertAttendanceError } = await supabase
        .from('meeting_attendances')
        .insert(attendanceRows);

      if (insertAttendanceError) {
        throw new Error(`Inserting meeting_attendances failed: ${insertAttendanceError.message}`);
      }
    }

    // Successful response
    res.status(201).json({
      status: 'success',
      data: meetingData
    });

  } catch (error) {
    console.error('Meeting creation error:', error.message);
    res.status(500).json({
      status: 'fail',
      message: error.message
    });
  }
});


/** 🚀 Fetch meeting details */
app.get("/meetings", async (req, res) => {
  const groupId = req.query.groupId;
  if (!groupId) {
    return res.status(400).json({ status: "fail", message: "Missing groupId" });
  }

  try {
    const { data, error } = await supabase
      .from("meetings")
      .select(`
        id,
        start_time,
        end_time,
        agenda,
        assignment_id,
        meeting_title,
        assignments:assignment_id(name, due_date),
        groups:group_id(name)
      `)
      .eq("group_id", groupId)
      .order("start_time", { ascending: true });

    if (error) throw error;

    res.json({ status: "success", data }); // Raw data
  } catch (err) {
    console.error("Error fetching meetings:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

/** ✅ Update meeting status */
app.patch("/meetings/:id/status", async (req, res) => {
  const meetingId = req.params.id;
  const { status } = req.body;

  // Validate status value
  const allowedStatuses = ["scheduled", "completed", "canceled"];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ status: "fail", message: "Invalid status value" });
  }

  try {
    const { error } = await supabase
      .from("meetings")
      .update({ status })
      .eq("id", meetingId);

    if (error) throw error;

    res.json({ status: "success", message: "Meeting status updated" });
  } catch (err) {
    console.error("Error updating meeting status:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

/** 🚀 GET Username */
app.get('/username', async (req, res) => {
  const zid = req.query.zid;
  if (!zid) return res.status(400).json({ error: "Missing zid parameter" });

  try {
    const { data, error } = await supabase
      .from('users')
      .select('name')
      .eq('zid', zid);

    if (error) throw error;
    if (data.length === 0) return res.status(404).json({ error: "User not found" });

    res.json(data[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 Insert/Update meeting-attendance */
app.post('/meeting-attendance', async (req, res) => {
  const {
    meeting_id,
    member_zid,
    join_time,
    leave_time,
    meeting_duration_hour,
    participation_duration_hour,
    group_id,
    is_present
  } = req.body;

  if (!meeting_id || !member_zid || !group_id) {
    return res.status(400).json({ error: 'meeting_id, member_zid, and group_id are required.' });
  }

  const { data, error } = await supabase
    .from('meeting_attendances')
    .upsert(
      [
        {
          meeting_id,
          member_zid,
          join_time,
          leave_time,
          meeting_duration_hour,
          participation_duration_hour,
          group_id,
          is_present
        }
      ],
      {
        onConflict: ['meeting_id', 'member_zid']  // Joint Primary Key or Unique Constraint Fields
      }
    );

  if (error) {
    console.error('Insert error:', error);
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ status: 'success', data });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

/** 🚀 Fetch meeting attendance record by meeting_id and member_zid */
app.get('/meeting-attendance', async (req, res) => {
  const { meeting_id, member_zid } = req.query;

  // Required field validation to ensure that both meeting_id and member_zid are provided
  if (!meeting_id || !member_zid) {
    return res.status(400).json({ error: 'Both meeting_id and member_zid are required.' });
  }

  try {
    // Querying Attendance Records from Supabase using a Joint Primary Key Query
    const { data, error } = await supabase
      .from('meeting_attendances')
      .select('*')
      .eq('meeting_id', meeting_id)  // Filter by meeting_id
      .eq('member_zid', member_zid); // Filter by member_zid

    if (error) {
      throw error;
    }

    // Returns 404 if there are no records
    if (data.length === 0) {
      return res.status(404).json({ message: 'No attendance records found.' });
    }

    // Return query results
    res.status(200).json({ status: 'success', data });

  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET roles list */
app.get('/roles', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('id, name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET course list */
app.get('/courses', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('code, name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET groups list */
app.get('/groups', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('id, course_code, name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: error.message });
  }
});



/** 🚀 GET Assignment info */
app.get('/assignments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('id, name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET Assignment info based on course ID*/
app.get('/assignments-Course-Based', async (req, res) => {
  try {
    const course_code = req.query.course_code;
    const { data, error } = await supabase
      .from('assignments')
      .select('id, name')
      .eq('course_code', course_code);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET Team-members by user ID */
app.get("/team-members", async (req, res) => {
  try {
    const groupId = req.query.groupId;
    console.log("✅ Received groupId:", groupId);
    const zid = req.query.zid;
    console.log("✅ Received zid:", zid);

    // 2: Obtain all members of the group
    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select('member_zid, is_leader')
      .eq('group_id', groupId);

    if (membersError) throw membersError;

    // 3: Get member details
    const memberZids = membersData.map(m => m.member_zid);
    console.log("✅ Fetched member zids:", memberZids);
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('zid, name')
      .in('zid', memberZids);

    if (usersError) throw usersError;

    // Formatting response data
    const formattedData = membersData.map(member => {
      const user = usersData.find(u => u.zid === member.member_zid);
      return {
        zid: member.member_zid,
        name: user?.name || "Unknown",
        is_leader: member.is_leader,
        group_id: groupId  // Add group_id to the response
      };
    });
    console.log("✅ FormattedData:", formattedData);
    res.json({
      status: 'success',
      data: {
        group_id: groupId,
        members: formattedData
      }
    });

  } catch (error) {
    console.error('Error fetching user group:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/** 🚀 GET group-id: by zid + course_code */
app.get("/group-id", async (req, res) => {
  try {
    const { zid, course_code } = req.query;

    if (!zid) return res.status(400).json({ error: "Missing zid parameter" });
    if (!course_code) return res.status(400).json({ error: "Missing course_code parameter" });

    // Filter by associating group_members with groups
    const { data: groupData, error } = await supabase
      .from('group_members')
      .select('group_id, groups(course_code)')
      .eq('member_zid', zid);

    if (error) throw error;

    // Filter group_id by course_code
    const match = groupData.find(item => item.groups?.course_code === course_code);

    if (!match) {
      return res.status(404).json({ error: 'User not found in any group for this course' });
    }

    return res.json({ group_id: match.group_id });

  } catch (error) {
    console.error("Error in /group-id:", error);
    return res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET group-members by user-id */
app.get("/group-members", async (req, res) => {
  try {
    const groupId = req.query.group_id;
    if (!groupId) return res.status(400).json({ error: "Missing group_id parameter" });

    // Get the list of members
    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select('member_zid, is_leader')
      .eq('group_id', groupId);

    if (membersError) throw membersError;

    // Extract all zids
    const memberZids = membersData.map(m => m.member_zid);
    if (memberZids.length === 0) {
      return res.json({ group_id: groupId, members: [] });  // no one in the group
    }

    // Get member details
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('zid, name')
      .in('zid', memberZids);

    if (usersError) throw usersError;

    const result = membersData.map(member => {
      const user = usersData.find(u => u.zid === member.member_zid);
      return {
        zid: member.member_zid,
        name: user?.name || "Unknown",
        is_leader: member.is_leader
      };
    });

    return res.json({
      group_id: groupId,
      members: result
    });

  } catch (error) {
    console.error("Error in /group-members:", error);
    return res.status(500).json({ error: error.message });
  }
});

/** ✅ PATCH group_member evaluation (final_score, is_evaluated) */
app.patch("/group-members/evaluation", async (req, res) => {
  try {
    const { group_id, member_zid, final_score, is_evaluated } = req.body;

    if (!group_id || !member_zid)
      return res.status(400).json({ error: "Missing group_id or member_zid" });

    const { error } = await supabase
      .from("group_members")
      .update({ final_score, is_evaluated })
      .eq("group_id", group_id)
      .eq("member_zid", member_zid);

    if (error) throw error;

    return res.json({ success: true, message: "Group member evaluation updated" });

  } catch (error) {
    console.error("Error in /group-members/evaluation:", error);
    return res.status(500).json({ error: error.message });
  }
});

/** ✅ PATCH group evaluation status (is_evaluated) */
app.patch("/groups/evaluation", async (req, res) => {
  try {
    const { group_id, is_evaluated } = req.body;

    if (!group_id)
      return res.status(400).json({ error: "Missing group_id" });

    const { error } = await supabase
      .from("groups")
      .update({ is_evaluated })
      .eq("id", group_id);

    if (error) throw error;

    return res.json({ success: true, message: "Group evaluation status updated" });

  } catch (error) {
    console.error("Error in /groups/evaluation:", error);
    return res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET Tutors */
app.get("/tutors", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('zid, name')
      .eq('role_id', 3); // Role ID = 3 is assumed to be a mentor

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching tutors:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 Fetch user's role */
app.get("/user-role", async (req, res) => {
  try {
    const zid = req.query.zid;
    if (!zid) return res.status(400).json({ error: "Missing zid parameter" });

    const { data, error } = await supabase
      .from('users')
      .select('role_id')
      .eq('zid', zid);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching tutors:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET my-tasks */
app.get("/my-tasks", async (req, res) => {
  try {
    const zid = req.query.zid;
    if (!zid) return res.status(400).json({ error: "Missing zid parameter" });

    const { data, error } = await supabase
      .from("task_view")
      // Rename the joined tasks relation as "task"
      .select("*")
      // filter by the current user's zid
      .eq("assignee_id", zid);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET tasks */
app.get("/tasks", async (req, res) => {
  try {
    const zid = req.query.zid;
    const courseCode = req.query.course_code;
    if (!zid) return res.status(400).json({ error: "Missing zid parameter" });
    if (!courseCode) return res.status(400).json({ error: "Missing course_code parameter" });

    const { data, error } = await supabase
      .from("task_view")
      // Rename the joined tasks relation as "task"
      .select("*")
      // filter by the current user's zid
      .eq("course_code", courseCode)
      .eq("assignee_id", zid);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

//** 🚀 Create tasks */
app.post("/create-task", async (req, res) => {
  // Extract the assignment field to be inserted and the assignee assignee_id (should be a zid) from the request body
  const {
    task_name,
    description,
    status_id,
    type,
    group_id,        // If type is ‘Group’ then this value cannot be null (there are triggers in the database for checking)
    parent_task_id,
    assignment_id,
    due_date,
    assignee_id      // The assignee_id here indicates the assignee of the task (from user input or other logic)
  } = req.body;

  try {
    // Phase 1: Insert tasks into the tasks table and return the inserted records (note that the return is an array)
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .insert([
        {
          task_name,
          description,
          status_id,
          type,
          group_id,
          parent_task_id,
          assignment_id,
          due_date
        }
      ])
      .select();

    if (taskError) throw taskError;
    if (!taskData || taskData.length === 0) {
      throw new Error("Error inserting task into tasks table");
    }

    // Get the newly inserted task record from the returned results
    const insertedTask = taskData[0];

    // Phase 2: If assignee_id exists, insert the corresponding data into the task_assignees table
    if (assignee_id) {
      const { error: assigneeError } = await supabase
        .from('task_assignees')
        .insert([
          {
            task_id: insertedTask.task_id,
            assignee_id: assignee_id  // The assignee_id here corresponds to the zid of the users table.
          }
        ]);

      if (assigneeError) throw assigneeError;
    }

    res.status(201).json(insertedTask);
  } catch (error) {
    console.error("Error inserting task and task_assignees:", error);
    res.status(500).json({ error: error.message });
  }
});

//** 🚀 Updated mission information */
app.put("/tasks/:taskId/:origin_assignee_id", async (req, res) => {
  // Extract the fields to be updated from the request parameters and request body
  const { taskId, origin_assignee_id } = req.params;
  const {
    task_name,
    description,
    status_id,
    type,
    group_id,         // If type is ‘Group’, this value cannot be null (the database already has triggers for checking)
    parent_task_id,   // Pass null if there is no parent task
    assignment_id,
    due_date,
    assignee_id       // This field indicates the assigner of the task (should be a zid)
  } = req.body;

  try {
    // Phase 1: Update the tasks table and filter by task_id
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .update({
        task_name,
        description,
        status_id,
        type,
        group_id,
        parent_task_id,
        assignment_id,
        due_date
      })
      .eq('task_id', taskId)
      .select();

    if (taskError) throw taskError;
    if (!taskData || taskData.length === 0) {
      throw new Error("Error updating task in tasks table");
    }

    // Getting the updated mission log
    const updatedTask = taskData[0];

    // Phase 2: If assignee_id exists, update the corresponding record in the task_assignees table
    if (taskId && origin_assignee_id && assignee_id) {
      const { error: assigneeError } = await supabase
        .from('task_assignees')
        .update({ assignee_id: assignee_id })
        .eq('task_id', taskId)
        .eq('assignee_id', origin_assignee_id);

      if (assigneeError) throw assigneeError;
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Error updating task and task_assignees:", error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 Delete tasks */
app.delete("/tasks/:taskId/:assignee_id", async (req, res) => {
  // Get the taskId and assignee_id from the URL parameters
  const { taskId, assignee_id } = req.params;

  try {
    // Phase 1: Delete records corresponding to tasks in the task_assignees table
    const { error: taError } = await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId)
      .eq('assignee_id', assignee_id);

    if (taError) {
      throw taError;
    }

    // Phase 2: Delete the corresponding task records in the tasks table
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .delete()
      .eq('task_id', taskId)
      .select();

    if (taskError) {
      throw taskError;
    }
    if (!taskData || taskData.length === 0) {
      throw new Error("Error deleting task in tasks table");
    }

    res.status(200).json(taskData[0]);
  } catch (error) {
    console.error("Error deleting task and task_assignees:", error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET my-contributions */
app.get("/my-contributions", async (req, res) => {
  try {
    const zid = req.query.zid;
    if (!zid) return res.status(400).json({ error: "Missing zid parameter" });

    const { data, error } = await supabase
      .from("contributions")
      .select("meeting_attendance, channel_activity, task_completion")
      .eq("member_zid", zid);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Error fetching contributions:", error);
    res.status(500).json({ error: error.message });
  }
});

/** 🚀 GET status list */
app.get('/statuses', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('statuses')
      .select('status_id, status_name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching types:', error);
    res.status(500).json({ error: error.message });
  }
});

/** ✅ GET /group-contributions?course_code=COMP1010 */
app.get("/group-contributions", async (req, res) => {
  const { course_code } = req.query;

  if (!course_code) {
    return res.status(400).json({ status: "fail", message: "Missing course_code" });
  }

  try {
    const { data, error } = await supabase
      .from("group_contributions")
      .select("*")
      .eq("course_code", course_code);

    if (error) throw error;

    res.json({ status: "success", data });
  } catch (err) {
    console.error("Error fetching group contributions:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

/** ✅ GET /private-contributions/:group_id */
app.get("/private-contributions/:group_id", async (req, res) => {
  const groupId = parseInt(req.params.group_id, 10);

  if (isNaN(groupId)) {
    return res.status(400).json({ status: "fail", message: "Invalid group_id" });
  }

  try {
    const { data, error } = await supabase
      .from("private_contributions")
      .select("*")
      .eq("group_id", groupId); // return all group member's contribution

    if (error) throw error;

    res.json({ status: "success", data });
  } catch (err) {
    console.error("Error fetching private contributions:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
  // const PORT = process.env.PORT || port;
  // app.listen(PORT, () => {
  //   console.log(`Server running on http://localhost:${PORT}`);
  // });
}

module.exports = app;


app.post('/api/peer-reviews/analyze', async (req, res) => {
  const { group_id, assignment_id } = req.body;

  try {
    // Getting Group Members
    const { data: members, error: memberError } = await supabase
      .from('group_members')
      .select('member_zid')
      .eq('group_id', group_id);

    if (memberError) throw memberError;
    const memberZIDs = members.map(m => m.member_zid);

    // Access to scoring data
    const { data: reviews, error: reviewError } = await supabase
      .from('peer_reviews')
      .select('reviewer_zid, reviewee_zid, score, comment')
      .eq('group_id', group_id)
      .eq('assignment_id', assignment_id);

    if (reviewError) throw reviewError;

    // Aggregated rating
    const scores = {};
    const commentsByMember = {};

    for (const zid of memberZIDs) {
      const received = reviews.filter(r => r.reviewee_zid === zid);
      const avgScore =
        received.length > 0
          ? received.map(r => r.score).reduce((a, b) => a + b, 0) / received.length
          : 0;
      scores[zid] = avgScore;

      commentsByMember[zid] = received.map(r => ({
        from: r.reviewer_zid,
        score: r.score,
        comment: r.comment,
      }));
    }

    // Build prompt
    const prompt = `
      You are an AI peer review assistant. The following students are in a team.
      Each student's peer review scores are listed. Please assess:
      1. Is the evaluation fair overall?
      2. Is anyone rated unfairly high or low?
      3. Suggest adjusted scores if needed.
      4. Output JSON with: summary, fairness, fairness_issues (if any), suggested_adjustments.

      Peer review data:\n${JSON.stringify(commentsByMember, null, 2)}
      Average scores:\n${JSON.stringify(scores, null, 2)}
    `;

    // Calling OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices[0].message.content;
    const aiResult = JSON.parse(content.match(/\{[\s\S]*\}/)[0]);

    // Storing Analysis Results
    const { error: insertError } = await supabase
      .from('contribution_analyses')
      .insert([{
        group_id,
        assignment_id,
        summary: aiResult.summary,
        fairness: aiResult.fairness ?? true,
        fairness_issues: aiResult.fairness_issues ?? [],
        suggested_adjustments: aiResult.suggested_adjustments ?? {},
        created_at: new Date().toISOString(),
      }]);

    if (insertError) throw insertError;

    res.status(200).json({
      status: "success",
      data: {
        analysis: aiResult
      }
    });

  } catch (error) {
    console.error("[Analyze Error]", error.message);
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});
