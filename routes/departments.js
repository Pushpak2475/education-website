// ════════════════════════════════════════════════════════════
// routes/departments.js — PUBLIC READ-ONLY DEPARTMENT ROUTES
// ════════════════════════════════════════════════════════════
// GET /api/departments — List all departments for the frontend dropdowns
const express = require('express');
const router = express.Router();
const Department = require('../models/Department');

// ── Auto-seed default departments if collection is empty ──
const seedDepartments = async () => {
    try {
        const count = await Department.countDocuments();
        if (count === 0) {
            const defaults = [
                { name: 'Computer Science & Eng', code: 'CSE' },
                { name: 'Electronics & Comm', code: 'ECE' },
                { name: 'Mechanical Engineering', code: 'Mechanical' },
                { name: 'Civil Engineering', code: 'Civil' },
                { name: 'Electrical Engineering', code: 'Electrical' },
                { name: 'Information Technology', code: 'IT' },
                { name: 'Business Administration', code: 'MBA' }
            ];
            await Department.insertMany(defaults);
            console.log('🌱 Databases empty: Seeded default departments');
        }
    } catch (e) {
        console.error('Failed to seed departments', e);
    }
};

// Execute seeder asynchronously on module execution
seedDepartments();

router.get('/', async (req, res) => {
    try {
        const departments = await Department.find().sort({ name: 1 });
        res.json({ departments });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch departments' });
    }
});

module.exports = router;
