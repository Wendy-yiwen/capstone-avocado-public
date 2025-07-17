-- Insert Roles
INSERT INTO roles (name) VALUES 
('student'), ('lecturer'), ('tutor');

-- Insert Users
INSERT INTO users (zid, name, password, role_id) VALUES
('z1234567', 'Alice Smith', 'securehash1', 1),
('z2345678', 'Bob Johnson', 'securehash2', 1),
('z3456789', 'Dr. White', 'securehash3', 2),
('z4567890', 'Ms. Brown', 'securehash4', 3);

-- Insert Courses
INSERT INTO courses (code, name, lecturer_zid, tutor_zid) VALUES
('COMP1010', 'Introduction to Computing', 'z3456789', 'z4567890');

-- Insert Assignments
INSERT INTO assignments (course_code, name, pdf_url, due_date) VALUES
('COMP1010', 'Group Project 1', 'https://example.com/project1.pdf', '2023-12-15');

-- Insert Groups
INSERT INTO groups (course_code, name) VALUES
('COMP1010', 'Alpha Team');

-- Insert Group-Members
INSERT INTO group_members (group_id, member_zid, is_leader) VALUES
(1, 'z1234567', true),
(1, 'z2345678', false);

-- Insert Meetings
INSERT INTO meetings (group_id, assignment_id, agenda, start_time, end_time) VALUES
(1, 1, 'Project kickoff meeting', 
 '2023-11-01 14:00:00+10', 
 '2023-11-01 15:30:00+10');

-- Insert Tasks
INSERT INTO tasks (meeting_id, assigned_to, description, weight) VALUES
(1, 'z1234567', 'Develop login module', 40),
(1, 'z2345678', 'Design database schema', 60);

-- Insert Contributions
INSERT INTO contributions (task_id, member_zid, rating, evidence) VALUES
(1, 'z1234567', 5, 'Git commit: a1b2c3d'),
(2, 'z2345678', 4, 'Figma design link');