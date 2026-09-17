const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const pool = require("../db/pool");

const router = express.Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashResetToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function getResetUrl(token) {
    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    return `${baseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail(email, resetUrl) {
    const emailUser = process.env.EMAIL_USER;
    const emailAppPassword = process.env.EMAIL_APP_PASSWORD;

    if (!emailUser || !emailAppPassword) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("EMAIL_USER and EMAIL_APP_PASSWORD must be configured in production");
        }

        console.log(`Password reset link: ${resetUrl}`);
        return;
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: emailUser,
            pass: emailAppPassword
        }
    });

    await transporter.sendMail({
        from: emailUser,
        to: email,
        subject: "Reset your Job Application Tracker password",
        text: `Reset your password using this link: ${resetUrl}\n\nThis link expires in one hour and can only be used once.`,
        html: `<p>Reset your password using the link below:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in one hour and can only be used once.</p>`
    });
}

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

router.get("/forgot-password", (req, res) => {
    res.render("forgot-password", { message: null, error: null });
});

router.post("/forgot-password", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const response = {
        message: "If an account exists for that email, a password reset link has been sent.",
        error: null
    };

    try {
        const result = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length > 0) {
            const token = crypto.randomBytes(32).toString("hex");
            const tokenHash = hashResetToken(token);
            const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
            const client = await pool.connect();

            try {
                await client.query("BEGIN");
                await client.query(
                    "DELETE FROM password_reset_tokens WHERE user_id = $1",
                    [result.rows[0].id]
                );
                await client.query(
                    `
                    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                    VALUES ($1, $2, $3)
                    `,
                    [result.rows[0].id, tokenHash, expiresAt]
                );
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK").catch(() => {});
                throw error;
            } finally {
                client.release();
            }

            await sendPasswordResetEmail(email, getResetUrl(token));
        }

        return res.render("forgot-password", response);
    } catch (error) {
        return sendAuthError(res, 500, "Password reset request failed", error);
    }
});

router.get("/reset-password", async (req, res) => {
    const token = String(req.query.token || "");

    if (!token) {
        return res.status(400).render("reset-password", {
            error: "This password reset link is invalid or expired.",
            token: ""
        });
    }

    try {
        const result = await pool.query(
            `
            SELECT 1
            FROM password_reset_tokens
            WHERE token_hash = $1 AND expires_at > NOW()
            `,
            [hashResetToken(token)]
        );

        if (result.rows.length === 0) {
            return res.status(400).render("reset-password", {
                error: "This password reset link is invalid or expired.",
                token: ""
            });
        }

        return res.render("reset-password", { error: null, token });
    } catch (error) {
        return sendAuthError(res, 500, "Password reset failed", error);
    }
});

router.post("/reset-password", async (req, res) => {
    const token = String(req.body.token || "");
    const passwordError = validatePassword(req.body.password);

    if (passwordError) {
        return res.status(400).render("reset-password", {
            error: passwordError,
            token
        });
    }

    let client;

    try {
        const passwordHash = await bcrypt.hash(req.body.password, 10);
        client = await pool.connect();

        await client.query("BEGIN");
        const result = await client.query(
            `
            DELETE FROM password_reset_tokens
            WHERE token_hash = $1 AND expires_at > NOW()
            RETURNING user_id
            `,
            [hashResetToken(token)]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            client.release();
            return res.status(400).render("reset-password", {
                error: "This password reset link is invalid or expired.",
                token: ""
            });
        }

        await client.query(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            [passwordHash, result.rows[0].user_id]
        );

        await client.query("COMMIT");
        client.release();

        return res.redirect("/login");
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
            client.release();
        }
        return sendAuthError(res, 500, "Password reset failed", error);
    }
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