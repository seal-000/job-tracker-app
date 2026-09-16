(function () {
    // Stages for the job application pipeline
    const STAGES = [
        { key: "Applied", label: "Applied", color: "#4A5C7A" },
        { key: "Screening", label: "Screening", color: "#6B4FA0" },
        { key: "Interview", label: "Interview", color: "#3B7A76" },
        { key: "Offer", label: "Offer", color: "#C98A2E" },
        { key: "Accepted", label: "Accepted", color: "#2E8B57" },
        { key: "Rejected", label: "Rejected", color: "#B5573B" }
    ];

    // Array to hold the job application entries
    let entries = [];

    /**
     * Wrapper function for making API requests. Automatically includes the CSRF token for non-GET requests.
     * Handles error statuses and parses the response as JSON.
     * 
     * @param {string} path - The API endpoint path (e.g., "/api/applications").
     * @param {object} [options={}] - The options for the request (method, body, etc.).
     * @returns {Promise<object|null>} The parsed JSON response data or null on 204.
     * @throws {Error} Throws an error if the request fails
     */
    async function api(path, options = {}) {
        const method = options.method || "GET";
        const request = {
            method,
            headers: { "Content-Type": "application/json" }
        };

        if (method !== "GET") {
            request.body = JSON.stringify({ ...(options.body || {}), _csrf: window.CSRF_TOKEN });
        }

        const response = await fetch(path, {
            ...request
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Request failed");
        }

        return response.status === 204 ? null : response.json();
    }

    // Load the job application entries from the API and render the dashboard.
    async function load() {
        try {
            entries = await api("/api/applications");
        } catch (error) {
            console.error("Could not load applications:", error);
            entries = [];
        }
        render();
    }

    // Add a new job application entry and update the dashboard.
    async function addEntry(company, role) {
        try {
            const location = document.getElementById("jt-location").value.trim();
            const job_url = document.getElementById("jt-job-url").value.trim();
            const salary = document.getElementById("jt-salary").value.trim();
            const created = await api("/api/applications", {
                method: "POST",
                body: { company, role, location, job_url, salary }
            });
            entries.unshift(created);
            render();
        } catch (error) {
            alert(error.message);
        }
    }

    // Move a job application entry to a different status and update the dashboard.
    async function moveEntry(id, status) {
        try {
            const updated = await api(`/api/applications/${id}/status`, { method: "PATCH", body: { status } });
            const entry = entries.find((e) => e.id === updated.id);
            if (entry) entry.status = updated.status;
            render();
        } catch (error) {
            alert(error.message);
        }
    }

    // Delete a job application entry and update the dashboard.
    async function deleteEntry(id) {
        try {
            await api(`/api/applications/${id}`, { method: "DELETE" });
            entries = entries.filter((e) => e.id !== id);
            render();
        } catch (error) {
            alert(error.message);
        }
    }

    // Render the statistics section of the dashboard.
    function renderStats() {
        const total = entries.length;
        const interviewing = entries.filter((e) => e.status === "Screening" || e.status === "Interview").length;
        const interviewed = entries.filter((e) => ["Interview", "Offer", "Accepted"].includes(e.status)).length;
        const offers = entries.filter((e) => e.status === "Offer" || e.status === "Accepted").length;
        const rejected = entries.filter((e) => e.status === "Rejected").length;
        const rate = total > 0 ? Math.round((interviewed / total) * 100) : 0;
        const rejectionRate = total > 0 ? Math.round((rejected / total) * 100) : 0;

        const stats = [
            { num: total, label: "Total applied" },
            { num: interviewing, label: "In interview stage" },
            { num: rate + "%", label: "Interview rate" },
            { num: offers, label: "Offers / Accepted" },
            { num: rejectionRate + "%", label: "Rejection rate" }
        ];

        document.getElementById("jt-stats").innerHTML = stats
            .map((s) =>
                `<div class="jt-stat"><span class="jt-stat-num">${s.num}</span><span class="jt-stat-label">${s.label}</span></div>`
            )
            .join("");
    }

    // Generate the "Move to next stage" buttons for a job application entry.
    function nextStageButtons(entry) {
        return STAGES.filter((s) => s.key !== entry.status)
            .map((s) => `<button class="jt-move-btn" data-move="${entry.id}" data-stage="${s.key}">${s.label}</button>`)
            .join("");
    }

    // Escape HTML special characters to prevent XSS attacks.
    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // Format a date value as a short month and day string.
    function formatDate(value) {
        return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    // Render the entire dashboard, including the board and statistics.
    function render() {
        renderStats();
        const board = document.getElementById("jt-board");

        board.innerHTML = STAGES.map((stage) => {
            const items = entries.filter((e) => e.status === stage.key);
            const cards = items.length
                ? items
                    .map(
                        (e) =>
                            `<div class="jt-card" style="--col-color:${stage.color}">` +
                            `<div class="jt-card-company">${escapeHtml(e.company)}</div>` +
                            `<div class="jt-card-role">${escapeHtml(e.role || "—")}</div>` +
                            `<div class="jt-card-location">${escapeHtml(e.location || "—")}</div>` +
                            `<div class="jt-card-salary">${e.salary ? `$${Number(e.salary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Salary not provided"}</div>` +
                            (e.job_url ? `<a class="jt-card-link" href="${escapeHtml(e.job_url)}" target="_blank" rel="noopener noreferrer">View job posting</a>` : "") +
                            `<div class="jt-card-date">${formatDate(e.created_at)}</div>` +
                            `<div class="jt-card-actions">${nextStageButtons(e)}` +
                            `<button class="jt-del-btn" data-del="${e.id}">Remove</button>` +
                            "</div></div>"
                    )
                    .join("")
                : '<div class="jt-empty">Nothing here yet</div>';

            return (
                `<div class="jt-col" style="--col-color:${stage.color}">` +
                `<div class="jt-col-head"><span class="jt-dot"></span><span class="jt-col-name">${stage.label}</span>` +
                `<span class="jt-col-count">${items.length}</span></div>` +
                cards +
                "</div>"
            );
        }).join("");

        board.querySelectorAll("[data-move]").forEach((btn) => {
            btn.addEventListener("click", () => moveEntry(Number(btn.dataset.move), btn.dataset.stage));
        });
        board.querySelectorAll("[data-del]").forEach((btn) => {
            btn.addEventListener("click", () => {
                if (confirm("Remove this application from your pipeline?")) deleteEntry(Number(btn.dataset.del));
            });
        });
    }

    document.getElementById("jt-add").addEventListener("click", () => {
        const companyInput = document.getElementById("jt-company");
        const roleInput = document.getElementById("jt-role");

        if (!companyInput.value.trim()) {
            companyInput.focus();
            return;
        }

        addEntry(companyInput.value.trim(), roleInput.value.trim());
        companyInput.value = "";
        roleInput.value = "";
        document.getElementById("jt-location").value = "";
        document.getElementById("jt-job-url").value = "";
        document.getElementById("jt-salary").value = "";
        companyInput.focus();
    });

    ["jt-role", "jt-company"].forEach((id) => {
        document.getElementById(id).addEventListener("keydown", (e) => {
            if (e.key === "Enter") document.getElementById("jt-add").click();
        });
    });

    load();
})();

