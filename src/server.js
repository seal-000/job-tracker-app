require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

// Required so express-session can detect HTTPS via Vercel's proxy and set secure cookies
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const pool = require("./db/pool");

const authRoutes = require("./routes/auth");
const requireAuth = require("./middleware/auth");

const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        store: new pgSession({
            pool,
            tableName: "session",
            createTableIfMissing: true
        }),
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);

app.use("/", authRoutes);

// Test root route, always redirect to the registration page
app.get("/", (req, res) => {
    
    res.redirect("/register");
});

app.get("/dashboard", requireAuth, (req, res) => {
    res.render("dashboard", {
        userId: req.session.userId
    });
});


// Test database connection
app.get("/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            connected: true,
            time: result.rows[0].now,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            connected: false,
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;