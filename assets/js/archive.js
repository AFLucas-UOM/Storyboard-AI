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
        display: 'flex', // Flexbox for centering buttons
        justifyContent: 'center', // Center buttons horizontally
        gap: '15px', // Add space between buttons
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

// Helper function to create a story card
const createStoryCard = (title, stories, updateDisplay) => {
    // Clean the title
    const cleanedTitle = cleanTitle(title);

    const storyCard = createElement('div', ['story-card', 'mb-4', 'p-3', 'border', 'rounded', 'position-relative']);

    // Create title
    const titleElement = createElement('h4');
    titleElement.textContent = cleanedTitle;

    // Create delete icon (default style)
    const deleteIcon = createElement('i', ['bi', 'bi-trash', 'story-delete-icon'], {
        position: 'absolute',
        top: '10px',
        right: '10px',
        cursor: 'pointer',
        display: 'none',
        width: '24px', // Set fixed width for the icon
        height: '24px', // Set fixed height for the icon
        borderRadius: '50%', // Circle shape by default
        textAlign: 'center', // Center the icon
        lineHeight: '24px', // Vertically align the icon
        paddingLeft:'2px', // Add padding for width effect
        paddingRight: '2px', // Symmetrical padding
        paddingTop: '2px', // Add slight padding on top
    });

    // Append title and delete icon to the card
    storyCard.appendChild(titleElement);
    storyCard.appendChild(deleteIcon);

    // Hover effect for the delete icon
    deleteIcon.addEventListener('mouseenter', () => {
        deleteIcon.style.backgroundColor = 'rgba(128, 128, 128, 0.1)'; // Add hover background color
        deleteIcon.style.borderRadius = '10%'; // Slightly rounded shape
        deleteIcon.style.paddingLeft = '2px'; // Add padding for width effect
        deleteIcon.style.paddingRight = '2px'; // Symmetrical padding
        deleteIcon.style.paddingTop = '2px'; // Add slight padding on top
    });

    deleteIcon.addEventListener('mouseleave', () => {
        // Reset styles to default
        deleteIcon.style.backgroundColor = ''; // Remove hover background color
        deleteIcon.style.borderRadius = '50%'; // Reset to circular shape
        deleteIcon.style.paddingLeft = '0px'; // Reset padding
        deleteIcon.style.paddingRight = '0px'; // Reset padding
        deleteIcon.style.paddingTop = '2px'; // Reset top padding
    });

    // Delete icon click event
    deleteIcon.addEventListener('click', () => {
        createDeleteModal(title, async () => {
            await handleDeleteStory(title, stories, () => storyCard.remove());
        });
    });

    // Show delete icon when hovering over the card
    storyCard.addEventListener('mouseenter', () => {
        deleteIcon.style.display = 'block';
    });

    storyCard.addEventListener('mouseleave', () => {
        deleteIcon.style.display = 'none';
    });

    return storyCard;
};

// Helper function to handle the delete action
const handleDeleteStory = async (title, stories, onCardRemoved) => {
    try {
        // Notify backend to delete the story
        const response = await fetch('/delete_story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }), // Send exact title to backend
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
