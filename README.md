# 🚁 Aerox Drone Academy

> A full-stack web application for a professional Drone Training Academy, featuring course enrollment, student/admin portals, authentication, payment integration, and database management.

---

## 📑 Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [License](#-license)

---

## ✨ Features

- **🌐 Interactive Website**: Clean, responsive frontend pages including Home, About, Courses, Gallery, and Contact.
- **🎓 Course Enrollment**: Online enrollment system allowing students to register for various drone pilot certification courses.
- **🔐 User Authentication**: Secure login and registration system powered by JWT (JSON Web Tokens) and `bcryptjs` password hashing.
- **👨‍🎓 Student Dashboard**: Dedicated portal for students to track course progress, view enrolled courses, and manage profiles.
- **🛡️ Admin Dashboard**: Administrative management portal to manage student enrollments, course listings, and incoming inquiries.
- **💳 Payment Gateway**: Integrated with **Razorpay** for seamless online fee payment.
- **🗄️ Flexible Database**: Supports both **SQLite3** for lightweight local development and **MySQL** for production deployments.

---

## 🛠️ Tech Stack

### **Frontend**
- **HTML5** & **CSS3** (Custom Responsive Styling)
- **JavaScript (ES6+)** for client-side interactivity

### **Backend**
- **Node.js** & **Express.js** REST API framework
- **SQLite3** / **MySQL2** database engines
- **JWT (`jsonwebtoken`)** for stateless authentication
- **Bcryptjs** for secure password hashing
- **Razorpay SDK** for payment processing
- **Dotenv** for environment configuration

---

## 📁 Project Structure

```text
Aerox_Drone/
├── css/                  # Styling & CSS files
├── js/                   # Client-side script files
├── images/               # Media & banner assets
├── pdfs/                 # Course brochures & documents
├── index.html            # Landing / Homepage
├── about.html            # About Us page
├── courses.html          # Course offerings & details
├── enroll.html           # Online enrollment form
├── student.html          # Student Portal / Dashboard
├── admin.html            # Admin Dashboard
├── gallery.html          # Image & video gallery
├── contact.html          # Contact form & location
├── server.js             # Main Express server entry point
├── database.js           # Database connection & setup script
├── package.json          # Dependencies and scripts
└── .gitignore            # Git exclusion rules
```

---

## ⚙️ Prerequisites

Before running this project locally, make sure you have:
- [Node.js](https://nodejs.org/) (v16.0.0 or higher)
- [npm](https://www.npmjs.com/) (Node Package Manager)

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR-USERNAME/Aerox_Drone.git
cd Aerox_Drone
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (refer to [Environment Variables](#-environment-variables)).

### 4. Start the Server
- **Development Mode** (with auto-reload using nodemon):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

Open your browser and navigate to `http://localhost:3000` (or your configured PORT).

---

## 🔑 Environment Variables

Create a `.env` file in the root directory and add the following variables:

```env
PORT=3000
JWT_SECRET=your_jwt_secret_key_here
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Database Configuration (if using MySQL)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=drone_academy
```

> ⚠️ **Note**: Do not commit your `.env` file to version control. It is excluded by `.gitignore`.

---

## 🗄️ Database Setup

By default, the application runs with an **SQLite3** database (`drone_academy.db`) created automatically on server initialization via `database.js`. 

To switch to **MySQL**:
1. Update database connection settings in `database.js`.
2. Configure your MySQL credentials in `.env`.

---

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
