const express = require("express");
const bcrypt = require("bcrypt");

const pool = require("../db/pool");

const router = express.Router();


router.get("/register", (req, res) => {
    res.render("register");
});

router.post("/register", async (req, res) => {
    try {
        const { email, password } = req.body;

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).send("User already exists");
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            `
            INSERT INTO users (email, password_hash)
            VALUES ($1, $2)
            `,
            [email, passwordHash]
        );

        res.redirect("/login");

    } catch (error) {
        console.error(error);
        res.status(500).send("Registration failed");
    }
});

module.exports = router;