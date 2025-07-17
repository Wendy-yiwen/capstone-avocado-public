[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=18239177&assignment_repo_type=AssignmentRepo)

#  [capstone-project-2025-t1-25t1-9900-f14a-Avocado](https://github.com/unsw-cse-comp99-3900/capstone-project-2025-t1-25t1-9900-f14a-Avocado)

# Start Project

## Deployment (Using Docker Compose)

### Prerequisites

- **Docker** installed and running, [you can install by clicking here](https://www.docker.com/).
- **Docker Compose** (v2+; included with Docker Desktop)  

### Quick Start

1. **Ensure Docker is running**  
   - **Windows/Mac**: Open Docker Desktop and wait until it shows “Docker is running”.  
   - **Linux**:
     ```bash
     sudo systemctl start docker
     ```

2. **Build and launch all services**  
   From the project root (where `docker-compose.yml` lives), run:
   ```bash
   # If you have Docker Compose v2 (built into Docker CLI):
   docker compose up --build -d
   
   # Or, if you’re using the standalone docker-compose binary:
   docker-compose up --build -d

## How to Use

1. Open in browser

2. Navigate to:

```arduio
http://localhost:3000/
```

3. You should see the login page. The app may take a few seconds on first load while it initializes—please be patient.

4. Register for an account or log in.

# Development (Manual)

## 1. start server

```bash
cd initialpage
npm start
```

## 2. start client
```bash
cd login-page
npm start
```

## 3. Start AI Agent Files

```
cd ai_agent
pip install -r requirements.txt
python channel_service.py
```



### 3.1 Set Up Environment


```bash
cd ai_agent
pip install -r requirements.txt
python channel_service.py
```

#### 1.Login API

**Request**:

```json
POST /login
{
  "username": "z1234567",
  "password": "your_password"
}
```

**Response**:

```json
{
  "status": "success",
  "user": {
    "id": "z1234567",
    "name": "Alice Smith",
    "role": "student"
  }
}
```

### 2. Get Team Members

**Request**:

```
GET /team-members?group_id=1
```

**Response**:

```json
[
  {
    "id": "z1234567",
    "name": "Alice Smith",
    "role": "Leader",
    "isLeader": true
  }
]
```

### 3. Get Tutors List

**Request**:

```
GET /tutors
```

**Response**:

```json
[
  {
    "id": "z4567890",
    "name": "Ms. Brown"
  }
]
```



### 4. User Registration API (Integrated Group Function)

#### POST /register

This API allows users to register, either by joining an existing group or creating a new group, based on the provided information. It supports group affiliation and user role management during registration.

---

### Request Body Parameters

| Parameter      | Type    | Description                                                                                                                                                                | Required |
|----------------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| `zid`          | String  | The student's ID (e.g., `123456`).                                                                                                                                          | Yes      |
| `name`         | String  | The user's full name.                                                                                                                                                       | Yes      |
| `password`     | String  | The user's password (should be securely hashed before storing).                                                                                                           | Yes      |
| `role_id`      | String  | The role ID assigned to the user (e.g., `student`, `admin`, etc.).                                                                                                         | Yes      |
| `course_code`  | String  | The course code associated with the group (e.g., `CS101`).                                                                                                               | Yes      |
| `is_leader`    | Boolean | A flag indicating whether the user is the group leader (`true` or `false`).                                                                                               | Yes      |
| `group_name`   | String  | The name of the new group. Required if the user is creating a new group.                                                                                                  | Conditional (Required if `is_new_group` is `true`) |
| `group_id`     | String  | The ID of the existing group to join. Required if the user is not creating a new group.                                                                                   | Conditional (Required if `is_new_group` is `false`) |
| `is_new_group` | Boolean | A flag indicating whether the user is creating a new group (`true` or `false`). If `true`, `group_name` must be provided.                                                  | Yes      |

---

### Response

The response returns the status of the registration process. If successful, it includes the created user data and the associated group data.

#### Success Response (201 Created)

```json
{
  "status": "success",
  "data": {
    "user": {
      "zid": "123456",
      "name": "John Doe",
      "role_id": "student",
      "password": null
    },
    "group": {
      "id": "group123",
      "name": "Group A",
      "course_code": "CS101"
    }
  }
}
```

- `status`: The status of the request (`success`).
- `user`: The user object containing details about the registered user (password will be excluded from the response).
- `group`: The group object containing details about the group (including `id`, `name`, and `course_code`).

#### Error Response (400 Bad Request)

If required fields are missing or invalid data is provided, the API returns a `400` error with a message indicating which fields are missing.

```json
{
  "status": "fail",
  "message": "Missing required fields: group_name"
}
```

- `status`: The status of the request (`fail`).
- `message`: The error message detailing what went wrong.

#### Error Response (409 Conflict)

If a conflict occurs (e.g., the group already exists or there's a mismatch between group and course), the API returns a `409` error with the relevant error message.

```json
{
  "status": "fail",
  "message": "Group and course do not match"
}
```

#### Error Response (500 Internal Server Error)

If an unexpected error occurs (e.g., database errors), the API returns a `500` error with the relevant error message.

```json
{
  "status": "fail",
  "message": "User creation failed: <error_message>"
}
```

- `status`: The status of the request (`fail`).
- `message`: The error message providing more details about the failure.

---

### **Process Flow**

1. **Field Validation**: The API first checks that all required fields are present in the request body.
2. **Group Handling**:
   - If the user is creating a new group, the API attempts to create the group with the provided `group_name` and `course_code`.
   - If the user is joining an existing group, the API verifies that the group exists and that the group’s `course_code` matches the provided course.
3. **User Creation**: The API creates a new user in the system with the provided `zid`, `name`, `password`, and `role_id`.
4. **Group Membership**: The API adds the user to the specified group as a member, with the role of leader or member (`is_leader`).
5. **Error Handling**: In case of any errors, the API handles transaction rollback to ensure data consistency, and an appropriate error message is returned to the user.

---

### **Notes**
- The password field should be securely hashed before storing it in the database.
- The `group_name` parameter is required only if the `is_new_group` flag is set to `true`.
- In case of errors, the transaction is rolled back to maintain data integrity (e.g., deleting the user if adding to the group fails).

---

Let me know if you need further details or adjustments!
