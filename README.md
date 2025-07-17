# Capstone 项目：Avocado AI 协作平台

> 📍 本项目为新南威尔士大学信息技术硕士 Capstone 项目，开发了一个集 AI 助理、团队协作与用户管理于一体的全栈平台。支持用户注册、登录、组队、AI 问答服务等核心功能，适用于课程项目协作、学生导师互动等场景。

---

## 🚀 项目启动方式

### Docker 启动方式（推荐）

#### 先决条件：

- 安装并运行 [Docker Desktop](https://www.docker.com/)
- 支持 Docker Compose（v2+，Docker Desktop 已内置）

#### 快速启动命令：

在项目根目录执行：

```bash
# Docker CLI v2+
docker compose up --build -d

# 或使用独立 docker-compose
docker-compose up --build -d
```

浏览器访问 [http://localhost:3000](http://localhost:3000) 即可使用系统。

---

### 手动启动方式（开发调试用）

#### 1. 启动前端

```bash
cd initialpage
npm start
```

#### 2. 启动登录页面

```bash
cd login-page
npm start
```

#### 3. 启动 AI 助手服务

```bash
cd ai_agent
pip install -r requirements.txt
python channel_service.py
```

---

## 🧠 项目功能说明

### ✅ 用户系统

- 用户注册/登录
- 分组功能：支持加入已有小组或创建新小组
- 角色分配：学生、导师、组长等角色管理

### ✅ API 示例：用户注册

**POST /register**

请求体参数说明：

| 参数 | 类型 | 描述 | 必填 |
|------|------|------|------|
| zid | String | 学号（如 z1234567） | ✔️ |
| name | String | 用户姓名 | ✔️ |
| password | String | 登录密码 | ✔️ |
| role_id | String | 用户角色（如 student/admin） | ✔️ |
| course_code | String | 所属课程编号 | ✔️ |
| is_leader | Boolean | 是否为组长 | ✔️ |
| group_name | String | 创建新组时提供 | 条件必填 |
| group_id | String | 加入已有组时提供 | 条件必填 |
| is_new_group | Boolean | 是否创建新组 | ✔️ |

成功响应：

```json
{
  "status": "success",
  "data": {
    "user": { "zid": "123456", "name": "张三", "role_id": "student" },
    "group": { "id": "group123", "name": "组A", "course_code": "CS101" }
  }
}
```

---

## 🔧 技术栈

- 前端：React + Ant Design
- 后端：FastAPI + Python
- AI 模块：OpenAI 接口集成
- 数据存储：MongoDB
- 部署方式：Docker Compose / 本地开发

---

## 👩‍💻 作者与贡献

本项目由新南威尔士大学 9900 Capstone 小组开发。主要开发者：

- Wendy Yiwen（系统设计、后端开发、AI 模块集成）

---

## 📎 附加说明

- `.env` 环境变量文件已忽略，部署时请自行添加。
- 建议使用 Python 3.11 及以上版本。
- 所有依赖项见 `requirements.txt`，通过 `pip install -r requirements.txt` 安装。

---

感谢您的查阅！如有问题欢迎联系我 👋
