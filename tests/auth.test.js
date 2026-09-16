const request = require("supertest");

const app = require("../src/server");
const pool = require("../src/db/pool");

const RUN_INTEGRATION_TESTS = Boolean(process.env.DATABASE_URL && process.env.SESSION_SECRET);
const describeIfDb = RUN_INTEGRATION_TESTS ? describe : describe.skip;

async function getCsrfToken(agent, path = "/login") {
    const res = await agent.get(path);
    const match = res.text.match(/name="_csrf" value="([^"]+)"/);

    if (!match) {
        throw new Error(`CSRF token not found on ${path}`);
    }

    return match[1];
}

async function registerUser(agent, email, password) {
    const csrfToken = await getCsrfToken(agent, "/register");

    return agent
        .post("/register")
        .type("form")
        .send({ email, password, _csrf: csrfToken });
}

async function loginUser(agent, email, password) {
    const csrfToken = await getCsrfToken(agent, "/login");

    return agent
        .post("/login")
        .type("form")
        .send({ email, password, _csrf: csrfToken });
}

describeIfDb("Auth flow", () => {
    beforeEach(async () => {
        await pool.query("DELETE FROM application_status_history");
        await pool.query("DELETE FROM applications");
        await pool.query("DELETE FROM users");
        await pool.query("DELETE FROM session");
    });

    afterAll(async () => {
        await pool.end();
    });

    test("Registration rejects invalid passwords", async () => {
        const agent = request.agent(app);
        const res = await registerUser(agent, "bad@example_password.com", "short");

        expect(res.status).toBe(400);
        expect(res.text).toMatch(/Password|at least 8|uppercase|lowercase|number/i);
    });

    test("Registration hashes passwords", async () => {
        const agent = request.agent(app);
        await registerUser(agent, "hashme@example.com", "Password123");

        const result = await pool.query(
            "SELECT password_hash FROM users WHERE email = $1",
            ["hashme@example.com"]
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].password_hash).not.toBe("Password123");
        expect(result.rows[0].password_hash).toMatch(/\$/);
    });

    test("Login rejects incorrect credentials", async () => {
        const agent = request.agent(app);
        await registerUser(agent, "login@example.com", "Password123");

        const res = await loginUser(agent, "login@example.com", "WrongPassword123");

        expect(res.status).toBe(401);
    });

    test("Unauthenticated users cannot access the dashboard or API", async () => {
        const dashboardRes = await request(app).get("/dashboard");
        const apiRes = await request(app).get("/api/applications");

        expect(dashboardRes.status).toBe(302);
        expect(apiRes.status).toBe(302);
    });
});
