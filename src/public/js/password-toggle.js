document.querySelectorAll("[data-password-toggle]").forEach((checkbox) => {
    const passwordInput = document.getElementById(checkbox.dataset.passwordToggle);

    checkbox.addEventListener("change", () => {
        passwordInput.type = checkbox.checked ? "text" : "password";
    });
});
