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
