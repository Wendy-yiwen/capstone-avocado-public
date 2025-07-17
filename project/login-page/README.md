# 🧑‍💻 Login Page Frontend - README

Welcome to the project! This is the frontend part of our COMP9900 project, built with React + TailwindCSS + Headless UI.

---

## 🚀 Tech Stack

| Tool/Library         | Purpose                                       |
|----------------------|-----------------------------------------------|
| React                | Build user interfaces                         |
| TailwindCSS          | Quickly create responsive styles              |
| @headlessui/react    | Unstyled components (e.g., dialogs, menus)    |
| @heroicons/react     | Official icon component library               |
| react-icons          | Import Bootstrap icons (e.g., `BsChatDots`)   |
| bootstrap            | Optional fallback style library               |
| react-router-dom     | Routing between pages                         |
| axios                | Make API requests                             |

---

## 📦 Install Dependencies

After cloning the project, run the following command in the root directory to install dependencies:

```bash
npm install
```

If you only want to install the UI/icon related dependencies:

```bash
npm install @headlessui/react @heroicons/react react-icons bootstrap
```

---

## 📁 Project Structure Overview

```
login-page/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable components
│   ├── pages/              # Page-level components
│   ├── App.js              # Route entry
│   ├── index.js            # Project entry point
│   └── index.css           # Tailwind import location
├── package.json            # Dependency declarations
├── tailwind.config.js      # Tailwind configuration
└── postcss.config.js       # Used for Tailwind build
```

---

## 🧪 Start the Project

```bash
npm start
```

After launching, it will automatically open `http://localhost:3000` in the browser.

---

## ✨ Features

- Login page (supports username and password)
- Sidebar navigation (with icon display and active page highlighting)
- User avatar dropdown menu (showing username and logout button)
- Responsive layout (collapsible sidebar for mobile)

---

## 🛠️ Common Issues

### 📍 Icons not showing up?
Make sure `react-icons` is installed and icons are imported correctly:

```js
import { BsChatDots } from 'react-icons/bs';
```

### 📍 Tailwind not working?
Check the following:

- Whether `@tailwind base;` and others are included in `index.css`
- Whether `tailwind.config.js` has correct `content` path settings

---

## 👨‍👩‍👧‍👦 Authors / Team Members

- Wenwen (Frontend Development)
- Other team members can be added...

---

## 📬 Contact

If you encounter problems during setup or usage, please contact team members or leave a message in the Teams group.

---

Contributions and suggestions are welcome! 🎉
