const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let dbType = 'sqlite';
let mysqlPool = null;
let sqliteDb = null;

// Determine which database to use
const useMySQL = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;

async function initDb() {
    if (useMySQL) {
        try {
            mysqlPool = mysql.createPool({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
            // Test connection
            const connection = await mysqlPool.getConnection();
            connection.release();
            dbType = 'mysql';
            console.log('✅ Connected to MySQL database successfully.');
        } catch (err) {
            console.error('⚠️ MySQL connection failed. Error:', err.message);
            console.log('🔄 Falling back to SQLite...');
            setupSQLite();
        }
    } else {
        console.log('ℹ️ MySQL credentials not provided in .env. Using SQLite...');
        setupSQLite();
    }

    await createTables();
    await seedDefaultData();
}

function setupSQLite() {
    dbType = 'sqlite';
    const dbPath = path.resolve(__dirname, 'drone_academy.db');
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Failed to connect to SQLite database:', err.message);
        } else {
            console.log('✅ Connected to SQLite database at:', dbPath);
        }
    });
}

// Helper to run query in a unified way (returns array of rows for SELECT, or action summary)
async function query(sql, params = []) {
    // Standardize query placeholders from MySQL (?) to SQLite (?) - they are the same.
    if (dbType === 'mysql') {
        const [rows] = await mysqlPool.execute(sql, params);
        return rows;
    } else {
        return new Promise((resolve, reject) => {
            // Check query type
            const isSelect = sql.trim().toLowerCase().startsWith('select');
            if (isSelect) {
                sqliteDb.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            } else {
                sqliteDb.run(sql, params, function(err) {
                    if (err) reject(err);
                    else {
                        resolve({
                            insertId: this.lastID,
                            affectedRows: this.changes
                        });
                    }
                });
            }
        });
    }
}

async function createTables() {
    // MySQL table declarations
    const queries = {
        mysql: [
            `CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'student',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                duration VARCHAR(50) NOT NULL,
                level VARCHAR(50) NOT NULL,
                image VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS enrollments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                mobile VARCHAR(20) NOT NULL,
                city VARCHAR(100) NOT NULL,
                course_name VARCHAR(100) NOT NULL,
                message TEXT,
                status VARCHAR(20) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS contacts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                mobile VARCHAR(20) NOT NULL,
                city VARCHAR(100) NOT NULL,
                course_name VARCHAR(100) NOT NULL,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ],
        sqlite: [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'student',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                duration TEXT NOT NULL,
                level TEXT NOT NULL,
                image TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS enrollments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                mobile TEXT NOT NULL,
                city TEXT NOT NULL,
                course_name TEXT NOT NULL,
                message TEXT,
                status TEXT DEFAULT 'Pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                mobile TEXT NOT NULL,
                city TEXT NOT NULL,
                course_name TEXT NOT NULL,
                message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ]
    };

    const activeQueries = dbType === 'mysql' ? queries.mysql : queries.sqlite;
    for (const sql of activeQueries) {
        await query(sql);
    }
    
    // Add payment columns if they don't exist
    try {
        if (dbType === 'mysql') {
            await query("ALTER TABLE enrollments ADD COLUMN payment_status VARCHAR(20) DEFAULT 'Unpaid'");
            await query("ALTER TABLE enrollments ADD COLUMN payment_id VARCHAR(100) DEFAULT NULL");
        } else {
            await query("ALTER TABLE enrollments ADD COLUMN payment_status TEXT DEFAULT 'Unpaid'");
            await query("ALTER TABLE enrollments ADD COLUMN payment_id TEXT DEFAULT NULL");
        }
    } catch (e) {
        // Columns likely already exist, safely ignore
    }
    
    console.log('✅ Database tables verified/created successfully.');
}

async function seedDefaultData() {
    // Seed default admin if not exists
    const users = await query('SELECT * FROM users WHERE email = ?', ['admin@droneacademy.com']);
    if (users.length === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            ['Admin Instructor', 'admin@droneacademy.com', hashedPassword, 'admin']
        );
        console.log('👤 Seeded default admin user: admin@droneacademy.com / admin123');
    }

    // Seed default courses if missing
    const defaultCourses = [
        ['DGCA Drone Pilot Training', 'Official certification course following DGCA rules. Includes flight simulators and live flying.', '5 Days', 'Beginner to Advanced', 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=400&q=80'],
        ['Agriculture Drone Training', 'Learn crop health monitoring, multi-spectral mapping, and precision drone spraying techniques.', '7 Days', 'Intermediate', 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=400&q=80'],
        ['Survey & Mapping', 'Master drone mapping, photogrammetry, 3D model generation, and GIS coordinates mapping.', '6 Days', 'Intermediate', 'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=400&q=80'],
        ['FPV Drone Training', 'First-Person View drone flying training, including high-speed acrobatics, drone setup, and goggles pairing.', '4 Days', 'Advanced', 'https://images.unsplash.com/photo-1521737711867-e3b904737d88?auto=format&fit=crop&w=400&q=80'],
        ['Drone Building Workshop', 'Hands-on practical training on parts selection, soldering, assembly, flight controller tuning and troubleshooting.', '3 Days', 'Beginner', 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80'],
        ['Drone Repair & Maintenance', 'Diagnostics, replacement of components (motors, ESCs, arms), and calibrating flight parameters.', '4 Days', 'Beginner', 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=400&q=80'],
        ['Aerial Photography & Videography', 'Cinematic flight maneuvers, camera configurations, lighting, composition, and post-production workflows.', '3 Days', 'Beginner', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'],
        ['GIS & Spatial Analysis', 'Data processing using ArcGIS, QGIS, and overlays of drone survey imagery on real maps.', '5 Days', 'Intermediate', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80'],
        ['Autonomous Drone Coding & Python', 'Program micro-drones using Scratch and Python. Master waypoint navigation, indoor obstacle loops, and automated flip sequences.', '5 Days', 'STEM / Beginner', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80'],
        ['AI & Computer Vision for Drones', 'Deploy OpenCV and YOLO models on Raspberry Pi / Jetson edge devices for real-time target tracking and gesture control.', '7 Days', 'Advanced', 'https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&w=400&q=80'],
        ['3D CAD Design & Drone Printing', 'Design customized quadcopter frames in Fusion 360, print with carbon-fiber filament, and run stress analysis.', '4 Days', 'STEM / Intermediate', 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80'],
        ['Thermal Inspection & Industrial UAV', 'Radiometric sensor calibration, solar panel hotspot detection, wind turbine integrity audits, and thermal reporting.', '6 Days', 'Enterprise', 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=400&q=80'],
        ['Drone Swarm Robotics', 'Multi-agent communication protocols, swarm path planning algorithms, synchronized flight mesh, and sky light shows.', '5 Days', 'Advanced', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'],
        ['Search & Rescue (SAR) Drone Ops', 'Thermal search grid protocols, payload release mechanisms for survival gear, emergency comms, and disaster field ops.', '4 Days', 'Intermediate', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80']
    ];

    for (const [name, desc, dur, lvl, img] of defaultCourses) {
        const existing = await query('SELECT id FROM courses WHERE name = ?', [name]);
        if (existing.length === 0) {
            await query(
                'INSERT INTO courses (name, description, duration, level, image) VALUES (?, ?, ?, ?, ?)',
                [name, desc, dur, lvl, img]
            );
        }
    }
    console.log('📚 Seeded/verified full course catalog (14 courses).');
}

module.exports = {
    initDb,
    query
};
