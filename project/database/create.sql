-- Roles Form
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE CHECK (name IN ('student', 'lecturer', 'tutor'))
);

-- Users Form
CREATE TABLE users (
    zid VARCHAR(8) PRIMARY KEY CHECK (zid ~ '^z\d{7}$'),
    name VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Courses Form
CREATE TABLE courses (
    code VARCHAR(8) PRIMARY KEY CHECK (code ~ '^[A-Z]{4}\d{4}$'),
    name VARCHAR(100) NOT NULL,
    lecturer_zid VARCHAR(8) REFERENCES users(zid),
    tutor_zid VARCHAR(8) REFERENCES users(zid)
);

-- Assignments Form
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(8) NOT NULL REFERENCES courses(code),
    name VARCHAR(100) NOT NULL,
    pdf_url TEXT NOT NULL,
    due_date DATE NOT NULL
);

-- Groups Form
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(8) NOT NULL REFERENCES courses(code),
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Group_Members Form (n-to-n relationships)
CREATE TABLE group_members (
    group_id INTEGER REFERENCES groups(id),
    member_zid VARCHAR(8) REFERENCES users(zid),
    is_leader BOOLEAN DEFAULT false,
    PRIMARY KEY (group_id, member_zid)
);

-- Meetings Form
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    assignment_id INTEGER REFERENCES assignments(id),
    agenda TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    summary TEXT,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled'))
);

-- Tasks Form
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id),
    assigned_to VARCHAR(8) NOT NULL REFERENCES users(zid),
    description TEXT NOT NULL,
    weight INTEGER CHECK (weight BETWEEN 1 AND 100),
    completed BOOLEAN DEFAULT false
);

-- Contributions Form
CREATE TABLE contributions (
    task_id INTEGER PRIMARY KEY REFERENCES tasks(id),
    member_zid VARCHAR(8) REFERENCES users(zid),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    evidence TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Creating Indexes
CREATE INDEX idx_meetings_group ON meetings(group_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_groups_course ON groups(course_code);