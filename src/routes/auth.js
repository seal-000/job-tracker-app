const express = require("express");
const bcrypt = require("bcrypt");

const pool = require("../db/pool");

const router = express.Router();

// Password validation function
function validatePassword(password) {
    if (typeof password !== "string" || password.trim().length === 0) {
        return "Password is required";
    }

    if (password.length < 8) {
        return "Password must be at least 8 characters long";
    }

    if (!/[A-Z]/.test(password)) {
        return "Password must contain at least one uppercase letter";
    }

    if (!/[a-z]/.test(password)) {
        return "Password must contain at least one lowercase letter";
    }

    if (!/\d/.test(password)) {
        return "Password must contain at least one number";
    }

    return null;
}

// Authentication error handling function
function sendAuthError(res, status, message, error = null) {
    if (error) {
        console.error(error);
    }

    res.status(status).send(message);
}


router.get("/register", (req, res) => {
    res.render("register", { error: null });
});

router.get("/login", (req, res) => {
    res.render("login", { error: null });
});

router.post("/register", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = req.body.password;

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).render("register", { error: "Please enter a valid email address" });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).render("register", { error: passwordError });
        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).render("register", { error: "User already exists" });
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
        return sendAuthError(res, 500, "Registration failed", error);
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
            return res.status(401).render("login", { error: "Invalid email or password" });
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).render("login", { error: "Invalid email or password" });
        }

        // Regenerate the session on login to prevent session fixation attacks
        req.session.regenerate((error) => {
            if (error) {
                return sendAuthError(res, 500, "Login failed", error);
            }

            req.session.userId = user.id;

            req.session.save((error) => {
                if (error) {
                    return sendAuthError(res, 500, "Login failed", error);
                }

                res.redirect("/dashboard"); // Redirect to a protected route after successful login
            });
        });

    } catch (error) {
        return sendAuthError(res, 500, "Login failed", error);
    }

});

router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return sendAuthError(res, 500, "Logout failed", error);
        }

        res.redirect("/login");
    });
});


module.exports = router;