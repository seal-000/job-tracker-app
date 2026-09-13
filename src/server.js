require("dotenv").config();

const express = require("express");

const app = express();

app.set("view engine", "ejs");
app.set("views", "./src/views");

app.use(express.static("src/public"));

const PORT = process.env.PORT || 3000;

const pool = require("./db/pool");

const authRoutes = require("./routes/auth");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/", authRoutes);


// Test root route
app.get("/", (req, res) => {
    
    res.redirect("/register");
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