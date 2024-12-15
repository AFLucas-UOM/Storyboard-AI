// Function to clean the title
function cleanTitle(title) {
    // Regex to remove "Title:" or "Story Title:" at the start, case-insensitive
    return title.replace(/^(Title:|Story Title:)\s*/i, '').trim();
}

// Fetch the username from localStorage
const currentUser = localStorage.getItem('currentuser');

// Helper function to create a DOM element with classes and styles
const createElement = (tag, classes = [], styles = {}) => {
    const element = document.createElement(tag);
    if (classes.length) element.classList.add(...classes);
    Object.assign(element.style, styles);
    return element;
};

// Create modal for delete confirmation
const createDeleteModal = (title, onConfirm) => {
    // Clean the title
    const cleanedTitle = cleanTitle(title);

    // Modal container
    const modal = createElement('div', ['delete-modal']);
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '1000',
    });

    // Modal content
    const modalContent = createElement('div', ['delete-modal-content'], {
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '8px',
        textAlign: 'center',
        width: '300px',
    });

    const modalText = createElement('p');
    modalText.textContent = `Are you sure you want to delete: \n"${cleanedTitle}" ?`;

    const buttonContainer = createElement('div', ['button-container'], {
        marginTop: '15px',
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
    });

    // Cancel button
    const cancelButton = createElement('button', ['btn', 'btn-secondary']);
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => modal.remove());

    // Confirm button
    const confirmButton = createElement('button', ['btn', 'btn-danger']);
    confirmButton.textContent = 'Delete';
    confirmButton.addEventListener('click', () => {
        onConfirm();
        modal.remove();
    });

    // Append elements
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    modalContent.appendChild(modalText);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);

    // Append modal to body
    document.body.appendChild(modal);
};

// Function to generate and download the PDF
function generateAndDownloadPDF(title, story) {
    if (!title || !story) {
        alert("Title and story content are required to generate the PDF.");
        return;
    }

    // Generate a static filename
    const fileName = `${title.replace(/\s+/g, '_')}.pdf`;

    const docDefinition = {
        info: {
            title: title,
            author: "Storyboard-AI", // Customize the author name
            subject: "Generated Story", // Short description
            keywords: "story, AI, PDF" // Tags
        },
        content: [
            { text: title, style: 'header' },
            { text: story, style: 'story' },
            { text: "------- The End -------", style: 'footer', alignment: 'center' }
        ],
        styles: {
            header: {
                fontSize: 20,
                bold: true,
                margin: [0, 0, 0, 15]
            },
            story: {
                fontSize: 14,
                lineHeight: 1.5,
                margin: [0, 10, 0, 10]
            },
            footer: {
                fontSize: 12,
                italics: true,
                margin: [0, 20, 0, 0],
                color: 'gray'
            }
        },
        pageMargins: [40, 60, 40, 60]
    };

    try {
        // Generate PDF and trigger download
        pdfMake.createPdf(docDefinition).download(fileName);
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("An error occurred while generating the PDF. Please try again.");
    }
}

// Helper function to handle the delete action
const handleDeleteStory = async (title, stories, onCardRemoved) => {
    try {
        // Notify backend to delete the story
        const response = await fetch('/delete_story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }), 
        });

        const data = await response.json();

        if (data.success) {
            console.log('Story deleted successfully');
            // Update UI
            onCardRemoved();
        } else {
            throw new Error('Failed to delete story on the server');
        }
    } catch (error) {
        console.error('Error deleting story:', error);
    }
};

// Helper function to create a story card
const createStoryCard = (title, stories, updateDisplay) => {
    // Clean the title
    const cleanedTitle = cleanTitle(title);

    const storyCard = createElement('div', ['story-card', 'mb-4', 'p-3', 'border', 'rounded', 'position-relative']);

    // Create title
    const titleElement = createElement('h4');
    titleElement.textContent = cleanedTitle;

    // Create download icon (default style)
    const downloadIcon = createElement('i', ['bi', 'bi-download', 'story-download-icon'], {
        position: 'absolute',
        top: '14px',
        right: '40px', 
        cursor: 'pointer',
        display: 'none',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        textAlign: 'center',
        lineHeight: '24px',
        paddingLeft:'2px',
        paddingRight: '2px',
        paddingTop: '2px',
    });

    // Hover effect for the download icon
    downloadIcon.addEventListener('mouseenter', () => {
        downloadIcon.style.backgroundColor = 'rgba(128, 128, 128, 0.1)';
        downloadIcon.style.borderRadius = '10%';
        downloadIcon.style.paddingLeft = '2px';
        downloadIcon.style.paddingRight = '2px';
        downloadIcon.style.paddingTop = '2px';
    });

    downloadIcon.addEventListener('mouseleave', () => {
        downloadIcon.style.backgroundColor = '';
        downloadIcon.style.borderRadius = '50%';
        downloadIcon.style.paddingLeft = '0px';
        downloadIcon.style.paddingRight = '0px';
        downloadIcon.style.paddingTop = '2px';
    });

    // Download icon click event
    downloadIcon.addEventListener('click', async () => {
        try {
            // Find the storyData by title
            const storyData = stories.find(s => s.title === title);
            if (!storyData) {
                alert("Story data not found.");
                return;
            }

            // The JSON uses "story" not "content"
            const storyContent = storyData.story;
            if (!storyContent) {
                alert("No story content available for download.");
                return;
            }

            // Generate and download PDF
            generateAndDownloadPDF(cleanedTitle, storyContent);

        } catch (error) {
            console.error("Error downloading story:", error);
            alert("An error occurred while downloading the story. Please try again.");
        }
    });

    // Create delete icon (default style)
    const deleteIcon = createElement('i', ['bi', 'bi-trash', 'story-delete-icon'], {
        position: 'absolute',
        top: '14px',
        right: '10px',
        cursor: 'pointer',
        display: 'none',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        textAlign: 'center',
        lineHeight: '24px',
        paddingLeft:'2px',
        paddingRight: '2px',
        paddingTop: '2px',
    });

    // Hover effect for the delete icon
    deleteIcon.addEventListener('mouseenter', () => {
        deleteIcon.style.backgroundColor = 'rgba(128, 128, 128, 0.1)';
        deleteIcon.style.borderRadius = '10%';
        deleteIcon.style.paddingLeft = '2px';
        deleteIcon.style.paddingRight = '2px';
        deleteIcon.style.paddingTop = '2px';
    });

    deleteIcon.addEventListener('mouseleave', () => {
        deleteIcon.style.backgroundColor = '';
        deleteIcon.style.borderRadius = '50%';
        deleteIcon.style.paddingLeft = '0px';
        deleteIcon.style.paddingRight = '0px';
        deleteIcon.style.paddingTop = '2px';
    });

    // Delete icon click event
    deleteIcon.addEventListener('click', () => {
        createDeleteModal(title, async () => {
            await handleDeleteStory(title, stories, () => storyCard.remove());
        });
    });

    // Append title and icons to the card
    storyCard.appendChild(titleElement);
    storyCard.appendChild(downloadIcon);
    storyCard.appendChild(deleteIcon);

    // Show icons when hovering over the card
    storyCard.addEventListener('mouseenter', () => {
        downloadIcon.style.display = 'block';
        deleteIcon.style.display = 'block';
    });

    storyCard.addEventListener('mouseleave', () => {
        downloadIcon.style.display = 'none';
        deleteIcon.style.display = 'none';
    });

    return storyCard;
};

// Function to update the display of stories
const updateStoryDisplay = (stories, searchTerm, container, countElement) => {
    // Clear previous content
    container.innerHTML = '';

    // Update count message
    if (searchTerm) {
        countElement.textContent = `There’s ${stories.length} story title${stories.length === 1 ? '' : 's'} with “${searchTerm}”`;
    } else {
        countElement.textContent = `You created ${stories.length} previous ${stories.length === 1 ? 'story' : 'stories'} with Storyboard-AI`;
    }

    // Display stories or a "no stories" message
    if (stories.length) {
        const fragment = document.createDocumentFragment();
        stories.forEach(story => fragment.appendChild(createStoryCard(story.title, stories, (filteredStories, term) => {
            updateStoryDisplay(filteredStories, term, container, countElement);
        })));
        container.appendChild(fragment);
    } else {
        const noStoriesMessage = createElement('p', [], { textAlign: 'center', fontStyle: 'italic' });
        noStoriesMessage.textContent = 'No stories found';
        container.appendChild(noStoriesMessage);
    }
};

// Main function to load and display user stories
const displayUserStories = async () => {
    if (!currentUser) {
        alert('No user logged in');
        console.error('No current user found in localStorage');
        return;
    }

    try {
        // Fetch stories from server
        const response = await fetch('/assets/json/conversations.json');
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Data is not an array');

        // Filter user-specific stories
        const userStories = data.filter(story => story.userName === currentUser);

        // Get DOM elements
        const storyCardsContainer = document.getElementById('story-cards-container');
        const storyCountElement = document.getElementById('story-count');
        const searchBar = document.getElementById('search-bar');
        const searchIcon = document.querySelector('.bi-search');

        // Update UI based on the presence of stories
        if (!userStories.length) {
            storyCardsContainer.innerHTML = `<p style="text-align:center; font-style:italic;">No stories saved for user: ${currentUser}</p>`;
            [searchBar, searchIcon, storyCountElement].forEach(el => (el.style.display = 'none'));
            return;
        }

        // Initial display of all stories
        updateStoryDisplay(userStories, '', storyCardsContainer, storyCountElement);

        // Listen for search input to filter stories dynamically
        searchBar.addEventListener('input', () => {
            const searchTerm = searchBar.value.toLowerCase();
            const filteredStories = userStories.filter(story =>
                cleanTitle(story.title).toLowerCase().includes(searchTerm)
            );
            updateStoryDisplay(filteredStories, searchTerm, storyCardsContainer, storyCountElement);
        });

        // Show search icon only when search input is available
        searchBar.style.display = 'block';
        searchIcon.style.display = 'block';
        storyCountElement.style.display = 'block';

    } catch (error) {
        console.error('Error fetching stories:', error);
    }
};

// Call displayUserStories on page load
displayUserStories();