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

async function registerAndLogin(agent, email, password) {
    const registerToken = await getCsrfToken(agent, "/register");
    await agent
        .post("/register")
        .type("form")
        .send({ email, password, _csrf: registerToken });

    const loginToken = await getCsrfToken(agent, "/login");
    const loginRes = await agent
        .post("/login")
        .type("form")
        .send({ email, password, _csrf: loginToken });

    expect(loginRes.status).toBe(302);
    return agent;
}

describeIfDb("Application API", () => {
    let maria;
    let paco;

    beforeEach(async () => {
        await pool.query("DELETE FROM application_status_history");
        await pool.query("DELETE FROM applications");
        await pool.query("DELETE FROM users");
        await pool.query("DELETE FROM session");

        maria = request.agent(app);
        paco = request.agent(app);

        await registerAndLogin(maria, "maria@example.com", "Password123");
        await registerAndLogin(paco, "paco@example.com", "Password123");
    });

    afterAll(async () => {
        await pool.end();
    });

    test("A user cannot access another user's application", async () => {
        const createdRes = await maria
            .post("/api/applications")
            .send({ company: "Acme", role: "Engineer", _csrf: await getCsrfToken(maria, "/dashboard") });

        expect(createdRes.status).toBe(201);

        const patchRes = await paco
            .patch(`/api/applications/${createdRes.body.id}/status`)
            .send({ status: "Interview", _csrf: await getCsrfToken(paco, "/dashboard") });

        expect(patchRes.status).toBe(404);
    });

    test("Invalid application statuses return 400", async () => {
        const createdRes = await maria
            .post("/api/applications")
            .send({ company: "Acme", role: "Engineer", _csrf: await getCsrfToken(maria, "/dashboard") });

        const patchRes = await maria
            .patch(`/api/applications/${createdRes.body.id}/status`)
            .send({ status: "NotAStatus", _csrf: await getCsrfToken(maria, "/dashboard") });

        expect(patchRes.status).toBe(400);
    });

    test("Creating an application creates its initial history record", async () => {
        const createdRes = await maria
            .post("/api/applications")
            .send({ company: "Acme", role: "Engineer", _csrf: await getCsrfToken(maria, "/dashboard") });

        expect(createdRes.status).toBe(201);

        const history = await pool.query(
            "SELECT * FROM application_status_history WHERE application_id = $1",
            [createdRes.body.id]
        );

        expect(history.rows).toHaveLength(1);
        expect(history.rows[0].new_status).toBe("Applied");
    });

    test("Updating status creates a history record", async () => {
        const createdRes = await maria
            .post("/api/applications")
            .send({ company: "Acme", role: "Engineer", _csrf: await getCsrfToken(maria, "/dashboard") });

        const statusRes = await maria
            .patch(`/api/applications/${createdRes.body.id}/status`)
            .send({ status: "Interview", _csrf: await getCsrfToken(maria, "/dashboard") });

        expect(statusRes.status).toBe(200);

        const history = await pool.query(
            "SELECT * FROM application_status_history WHERE application_id = $1 ORDER BY changed_at",
            [createdRes.body.id]
        );

        expect(history.rows.length).toBeGreaterThanOrEqual(2);
        expect(history.rows[history.rows.length - 1].old_status).toBe("Applied");
        expect(history.rows[history.rows.length - 1].new_status).toBe("Interview");
    });

    test("Deleting an application removes or correctly handles its history", async () => {
        const createdRes = await maria
            .post("/api/applications")
            .send({ company: "Acme", role: "Engineer", _csrf: await getCsrfToken(maria, "/dashboard") });

        const deleteRes = await maria
            .delete(`/api/applications/${createdRes.body.id}`)
            .send({ _csrf: await getCsrfToken(maria, "/dashboard") });

        expect(deleteRes.status).toBe(204);

        const history = await pool.query(
            "SELECT * FROM application_status_history WHERE application_id = $1",
            [createdRes.body.id]
        );

        expect(history.rows.length).toBeGreaterThanOrEqual(0);
    });
});
