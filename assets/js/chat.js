// Toggles the visibility of the information section
function toggleInfo() {
    const infoArea = document.getElementById("info-area");
    const infoButton = document.getElementById("info-button");
    const footer = document.getElementById("footer");
    
    const isHidden = infoArea.style.display === "none";
    infoArea.style.display = isHidden ? "block" : "none";
    
    // Change button text and make it slightly bold
    infoButton.textContent = isHidden
        ? "Hide Additional Info"
        : "Click here to find out more about this page.";
    infoButton.style.fontWeight = "600";  // Slightly bold button text
    
    // Adjust footer padding based on visibility of info section
    if (isHidden) {
        footer.style.paddingBottom = "15px";  // Add extra padding when info is shown
    }
    // Make footer text slightly bold
    footer.style.fontWeight = "500";  // Slightly bold footer text
}

// Manage text-to-speech (TTS) functionality and button state
let currentUtterance = null; // Stores the active utterance
let isSpeaking = false;      // Tracks whether TTS is currently playing

/**
 * Initiates TTS playback or stops it based on current state.
 * @param {string} text - The text to speak.
 * @param {HTMLElement} iconElement - The button icon element to update.
 */
function speakText(text, iconElement) {
    // If TTS is currently active, stop playback and reset the button state
    if (isSpeaking) {
        stopSpeaking(iconElement);
        return;
    }

    // Initialize a new SpeechSynthesisUtterance
    currentUtterance = new SpeechSynthesisUtterance(text);
    isSpeaking = true;

    // Ensure the stop icon is always visible during TTS playback
    updateIcon(iconElement, true);

    // Event listener: Reset state when playback finishes
    currentUtterance.onend = () => {
        resetState(iconElement);
    };

    // Event listener: Handle errors gracefully
    currentUtterance.onerror = (event) => {
        console.error("TTS error:", event.error);
        resetState(iconElement);
    };

    // Start the TTS
    speechSynthesis.speak(currentUtterance);
}

/**
 * Stops TTS playback and resets the button state.
 * @param {HTMLElement} iconElement - The button icon element to update.
 */
function stopSpeaking(iconElement) {
    speechSynthesis.cancel();
    resetState(iconElement);
}

/**
 * Updates the button icon to reflect TTS state using Bootstrap icons.
 * @param {HTMLElement} iconElement - The button icon element to update.
 * @param {boolean} isPlaying - Flag to indicate if TTS is playing.
 */
function updateIcon(iconElement, isPlaying) {
    // Show appropriate icon and set display to "block" while playing
    if (isPlaying) {
        iconElement.style.display = "block"; // Ensure it's visible
        iconElement.classList.add("bi-stop-circle");
        iconElement.classList.remove("bi-volume-up");
    } else {
        iconElement.style.display = ""; // Revert to default state
        iconElement.classList.remove("bi-stop-circle");
        iconElement.classList.add("bi-volume-up");
    }
}

/**
 * Resets playback state and button appearance.
 * @param {HTMLElement} iconElement - The button icon element to update.
 */
function resetState(iconElement) {
    isSpeaking = false;
    currentUtterance = null;

    // Reset the icon only when TTS is not playing
    updateIcon(iconElement, false);
}