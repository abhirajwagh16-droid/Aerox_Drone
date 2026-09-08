const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');
const Razorpay = require('razorpay');
require('dotenv').config();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'drone_academy_secret_token_key_2026';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend files from current directory
app.use(express.static(path.join(__dirname)));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// Admin Auth Middleware
const requireAdmin = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        }
        next();
    });
};

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// Get public statistics
app.get('/api/stats', async (req, res) => {
    try {
        const enrollments = await db.query('SELECT COUNT(*) as count FROM enrollments');
        const contacts = await db.query('SELECT COUNT(*) as count FROM contacts');
        const courses = await db.query('SELECT COUNT(*) as count FROM courses');
        
        // SQLite returns count in a specific way, MySQL slightly differently if we don't alias correctly.
        // With 'as count', we can access the value.
        const enrollCount = enrollments[0]?.count || enrollments[0]?.['COUNT(*)'] || 0;
        const contactCount = contacts[0]?.count || contacts[0]?.['COUNT(*)'] || 0;
        const courseCount = courses[0]?.count || courses[0]?.['COUNT(*)'] || 0;

        res.json({
            enrollments: enrollCount,
            contacts: contactCount,
            courses: courseCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all courses
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await db.query('SELECT * FROM courses ORDER BY id DESC');
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit contact form
app.post('/api/contact', async (req, res) => {
    const { name, email, mobile, city, course, message } = req.body;
    if (!name || !email || !mobile || !city || !course) {
        return res.status(400).json({ error: 'All fields except message are required.' });
    }

    try {
        await db.query(
            'INSERT INTO contacts (name, email, mobile, city, course_name, message) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, mobile, city, course, message || '']
        );
        res.status(201).json({ success: true, message: 'Message sent successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student course enrollment
app.post('/api/enroll', async (req, res) => {
    const { name, email, mobile, city, course, message, userId } = req.body;
    if (!name || !email || !mobile || !city || !course) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        await db.query(
            'INSERT INTO enrollments (user_id, name, email, mobile, city, course_name, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId || null, name, email, mobile, city, course, message || '']
        );
        res.status(201).json({ success: true, message: 'Enrollment application submitted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// AUTHENTICATION API ENDPOINTS
// ==========================================

// Student Registration
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    try {
        // Check if user exists
        const existing = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'student']
        );

        res.status(201).json({ success: true, message: 'Registration successful! You can now log in.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Unified Login (Student & Admin)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// STUDENT API ENDPOINTS
// ==========================================

// Get my enrollments
app.get('/api/student/enrollments', authenticateToken, async (req, res) => {
    try {
        const enrollments = await db.query(
            'SELECT * FROM enrollments WHERE user_id = ? OR email = ? ORDER BY id DESC',
            [req.user.id, req.user.email]
        );
        res.json(enrollments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PAYMENT API ENDPOINTS
// ==========================================

// Create Razorpay Order (With Mock Fallback for Development)
app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
    const { enrollmentId, amount } = req.body;
    if (!enrollmentId || !amount) {
        return res.status(400).json({ error: 'Enrollment ID and amount are required.' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Check if Razorpay keys are placeholder or missing
    if (!keyId || !keySecret || keyId.includes('your_original') || keySecret.includes('your_original')) {
        return res.json({
            success: true,
            isMock: true,
            order: {
                id: `order_mock_${Date.now()}_${enrollmentId}`,
                amount: amount * 100,
                currency: "INR"
            },
            key_id: "mock_key"
        });
    }

    try {
        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: `receipt_enrollment_${enrollmentId}`
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, isMock: false, order, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (err) {
        console.error("Razorpay API Error, using interactive payment gateway fallback:", err.message || err);
        res.json({
            success: true,
            isMock: true,
            order: {
                id: `order_mock_${Date.now()}_${enrollmentId}`,
                amount: amount * 100,
                currency: "INR"
            },
            key_id: "mock_key"
        });
    }
});

// Verify Payment
app.post('/api/payment/verify', authenticateToken, async (req, res) => {
    const { enrollmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    // Check if mock order
    if (razorpay_order_id && razorpay_order_id.startsWith('order_mock_')) {
        try {
            const payId = razorpay_payment_id || `PAY_AEROX_${Date.now()}`;
            await db.query(
                'UPDATE enrollments SET payment_status = ?, payment_id = ?, status = ? WHERE id = ?',
                ['Paid', payId, 'Enrolled', enrollmentId]
            );
            return res.json({ success: true, message: 'Payment verified and enrollment confirmed.' });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '');
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');
    if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid signature' });
    }

    try {
        // Update enrollment payment status
        await db.query(
            'UPDATE enrollments SET payment_status = ?, payment_id = ?, status = ? WHERE id = ?',
            ['Paid', razorpay_payment_id, 'Enrolled', enrollmentId]
        );
        res.json({ success: true, message: 'Payment verified and enrollment confirmed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ADMIN API ENDPOINTS (Access restricted)
// ==========================================

// Get all student enrollments
app.get('/api/admin/enrollments', requireAdmin, async (req, res) => {
    try {
        const enrollments = await db.query('SELECT * FROM enrollments ORDER BY id DESC');
        res.json(enrollments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update student enrollment status
app.put('/api/admin/enrollments/:id/status', requireAdmin, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    try {
        await db.query('UPDATE enrollments SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all contact inquiries
app.get('/api/admin/contacts', requireAdmin, async (req, res) => {
    try {
        const contacts = await db.query('SELECT * FROM contacts ORDER BY id DESC');
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a course
app.post('/api/admin/courses', requireAdmin, async (req, res) => {
    const { name, description, duration, level, image } = req.body;
    if (!name || !description || !duration || !level) {
        return res.status(400).json({ error: 'Course name, description, duration, and level are required.' });
    }

    try {
        const result = await db.query(
            'INSERT INTO courses (name, description, duration, level, image) VALUES (?, ?, ?, ?, ?)',
            [name, description, duration, level, image || 'images/course_default.jpg']
        );
        res.status(201).json({ success: true, message: 'Course created successfully.', courseId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a course
app.delete('/api/admin/courses/:id', requireAdmin, async (req, res) => {
    const courseId = req.params.id;
    try {
        await db.query('DELETE FROM courses WHERE id = ?', [courseId]);
        res.json({ success: true, message: 'Course deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PAGE ROUTING FALLBACKS (To handle direct URLs nicely)
// ==========================================
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/courses', (req, res) => res.sendFile(path.join(__dirname, 'courses.html')));
app.get('/gallery', (req, res) => res.sendFile(path.join(__dirname, 'gallery.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/enroll', (req, res) => res.sendFile(path.join(__dirname, 'enroll.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/student', (req, res) => res.sendFile(path.join(__dirname, 'student.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Catch-all to serve index.html for unknown routes (except API requests)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize database and start server
db.initDb()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌍 URL: http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Failed to initialize database server:', err);
    });
