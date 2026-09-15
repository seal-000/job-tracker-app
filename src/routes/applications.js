const express = require("express");

const pool = require("../db/pool");
const requireAuth = require("../middleware/auth");

const router = express.Router();

const VALID_STATUSES = ["Applied", "Screening", "Interview", "Offer", "Accepted", "Rejected"];

// Every route below requires an authenticated session
router.use(requireAuth);

// List applications belonging to the logged-in user
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, company, position AS role, current_status AS status, created_at
             FROM applications
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.session.userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load applications" });
    }
});

// Create a new application owned by the logged-in user
router.post("/", async (req, res) => {
    
    
    let client;

    try {

        // Extract and validate input fields from the request body
        const company = String(req.body.company || "").trim();
        const role = String(req.body.role || "").trim();

        // If there is no company provided, return an error
        if (!company) {
            return res.status(400).json({ error: "Company is required" });
        }

        // Call the database to create the new application
        client = await pool.connect();
        await client.query("BEGIN"); // Start a transaction

        // Insert the new application into the database
        const result = await client.query(
            `INSERT INTO applications (user_id, company, position, current_status)
             VALUES ($1, $2, $3, 'Applied')
             RETURNING id, company, position AS role, current_status AS status, created_at`,
            [req.session.userId, company, role || null]
        );

        // Retrieve the newly created application from the result
        const application = result.rows[0];

        // Perform the insertion into the application status history table
        await client.query(
            `INSERT INTO application_status_history (application_id, old_status, new_status)
             VALUES ($1, NULL, $2)`,
            [application.id, application.status]
        );

        // Save the transaction and return the newly created application
        await client.query("COMMIT");
        res.status(201).json(application);

    } catch (error) {
        if (client) {
            // If an error occurs, roll back the transaction
            await client.query("ROLLBACK");
        }

        console.error(error);
        res.status(500).json({ error: "Failed to create application" });
    } finally {
        // Release the database client back to the pool
        client?.release();
    }
});

// Update the status of an application -> ownership enforced in the WHERE clause
router.patch("/:id/status", async (req, res) => {
    let client;

    try {

        // Extract the new status from the request body
        const { status } = req.body;

        // Validate the requested status against the list of valid statuses
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        // Connect to the database and start a transaction
        client = await pool.connect();
        await client.query("BEGIN");

        // Update the application's status and retrieve the previous status for history logging
        const result = await client.query(
            `UPDATE applications AS a
             SET current_status = $1
             FROM (SELECT current_status FROM applications WHERE id = $2 AND user_id = $3) AS prev
             WHERE a.id = $2 AND a.user_id = $3
             RETURNING a.id, a.company, a.position AS role, a.current_status AS status, a.created_at, prev.current_status AS old_status`,
            [status, req.params.id, req.session.userId]
        );

        // Roll back the transaction if the application status update did not affect any rows
        if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Application not found" });
        }

        // Extract the old status and the rest of the application details
        const { old_status, ...application } = result.rows[0];

        // Record the status change in the application status history table
        await client.query(
            `INSERT INTO application_status_history (application_id, old_status, new_status)
             VALUES ($1, $2, $3)`,
            [req.params.id, old_status, status]
        );

        // Commit the transaction and return the updated application
        await client.query("COMMIT");
        res.json(application);
    } catch (error) {
        if (client) {
            // If an error occurs, roll back the transaction
            await client.query("ROLLBACK");
        }

        console.error(error);
        res.status(500).json({ error: "Failed to update status" });
    } finally {
        // Release the database client back to the pool
        client?.release();
    }
});

// Delete an application -> ownership enforced in the WHERE clause
router.delete("/:id", async (req, res) => {
    try {

        // Attempt to delete the application, ensuring ownership via the WHERE clause
        const result = await pool.query(
            `DELETE FROM applications
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [req.params.id, req.session.userId]
        );

        // If no rows were affected, the application was not found or the user does not own it
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Application not found" });
        }

        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete application" });
    }
});

module.exports = router;
