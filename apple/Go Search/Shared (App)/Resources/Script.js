const settingsButton = document.querySelector("button.open-preferences");
const settingsStatus = document.querySelector("#settings-status");

function show(platform, enabled) {
    document.body.classList.add(`platform-${platform}`);
    document.body.classList.toggle("state-on", enabled === true);
    document.body.classList.toggle("state-off", enabled === false);
}

function settingsResult(errorMessage) {
    settingsButton.disabled = false;
    settingsButton.removeAttribute("aria-busy");
    settingsButton.textContent = "Quit & Open Safari Settings";
    settingsStatus.textContent = errorMessage || "";
}

function openPreferences() {
    if (settingsButton.disabled) return;
    settingsStatus.textContent = "";
    settingsButton.disabled = true;
    settingsButton.setAttribute("aria-busy", "true");
    settingsButton.textContent = "Opening Safari Settings…";
    try {
        webkit.messageHandlers.controller.postMessage("open-preferences");
    } catch {
        settingsResult("Couldn’t connect to Safari. Open Safari → Settings → Extensions, or try again.");
    }
}

settingsButton.addEventListener("click", openPreferences);
