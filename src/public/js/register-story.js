(function () {
    const story = document.querySelector(".register-story");
    const layers = story?.querySelectorAll("[data-depth]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    if (!story || !layers.length || reducedMotion.matches || !finePointer.matches) return;

    function resetLayers() {
        layers.forEach((layer) => {
            layer.style.removeProperty("--drift-x");
            layer.style.removeProperty("--drift-y");
        });
    }

    story.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse") return;

        const bounds = story.getBoundingClientRect();
        const horizontal = (event.clientX - bounds.left) / bounds.width * 2 - 1;
        const vertical = (event.clientY - bounds.top) / bounds.height * 2 - 1;

        layers.forEach((layer) => {
            const depth = Number(layer.dataset.depth);
            const driftX = horizontal * depth * 12;
            const driftY = vertical * depth * 8;
            layer.style.setProperty("--drift-x", `${driftX.toFixed(2)}px`);
            layer.style.setProperty("--drift-y", `${driftY.toFixed(2)}px`);
        });
    });

    story.addEventListener("pointerleave", resetLayers);
})();