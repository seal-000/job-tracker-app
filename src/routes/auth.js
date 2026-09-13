const express = require("express");
const bcrypt = require("bcrypt");

const pool = require("../db/pool");

const router = express.Router();


router.get("/register", (req, res) => {
    res.render("register");
});

router.get("/login", (req, res) => {
    res.render("login");
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

router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).send("Invalid email or password");
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).send("Invalid email or password");
        }

        req.session.userId = user.id;
        res.redirect("/dashboard"); // Redirect to a protected route after successful login

    } catch (error) {
        console.error(error);
        res.status(500).send("Login failed");
    }

});

module.exports = router;