// Fetch the username from localStorage
const currentUser = localStorage.getItem('currentuser');

// Helper function to create a DOM element with classes and styles
const createElement = (tag, classes = [], styles = {}) => {
    const element = document.createElement(tag);
    if (classes.length) element.classList.add(...classes);
    Object.assign(element.style, styles);
    return element;
};

// Helper function to create a story card
const createStoryCard = (title, handleDelete) => {
    const storyCard = createElement('div', ['story-card', 'mb-4', 'p-3', 'border', 'rounded', 'position-relative']);

    // Create title
    const titleElement = createElement('h4');
    titleElement.textContent = title;

    // Create delete icon (hidden by default)
    const deleteIcon = createElement('i', ['bi', 'bi-trash', 'story-delete-icon'], {
        position: 'absolute',
        top: '10px',
        right: '10px',
        cursor: 'pointer',
        display: 'none',
    });

    // Append title and delete icon to the card
    storyCard.appendChild(titleElement);
    storyCard.appendChild(deleteIcon);

    // Hover effect to toggle the delete icon visibility
    storyCard.addEventListener('mouseenter', () => (deleteIcon.style.display = 'block'));
    storyCard.addEventListener('mouseleave', () => (deleteIcon.style.display = 'none'));

    // Delete icon click event
    deleteIcon.addEventListener('click', () => handleDelete(title));

    return storyCard;
};

// Helper function to handle the delete action
const handleDeleteStory = async (title, stories, updateDisplay) => {
    try {
        // Update local stories array
        const updatedStories = stories.filter(story => story.title !== title);

        // Update UI
        updateDisplay(updatedStories, '');

        // Notify backend to delete the story
        const response = await fetch(`/delete_story/${encodeURIComponent(title)}`, { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
            console.log('Story deleted successfully');
        } else {
            throw new Error('Failed to delete story on the server');
        }
    } catch (error) {
        console.error('Error deleting story:', error);
    }
};

// Function to format and sanitize story titles
const formatStoryTitle = (title) => {
    if (title.startsWith('Title: ')) return title.slice(7);
    if (title.startsWith('Story Title: ')) return title.slice(13);
    return title || 'Untitled Story';
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
        stories.forEach(story => fragment.appendChild(createStoryCard(formatStoryTitle(story.title), (title) => handleDeleteStory(title, stories, updateStoryDisplay))));
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

        const updateDisplay = (filteredStories, searchTerm) => updateStoryDisplay(filteredStories, searchTerm, storyCardsContainer, storyCountElement);

        // Initial display of all stories
        updateDisplay(userStories, '');

        // Listen for search input to filter stories dynamically
        searchBar.addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase();
            const filteredStories = userStories.filter(story =>
                formatStoryTitle(story.title).toLowerCase().includes(searchTerm)
            );
            updateDisplay(filteredStories, searchTerm);
        });
    } catch (error) {
        console.error('Error loading stories:', error);
        document.getElementById('story-cards-container').innerHTML = '<p style="text-align:center; margin-top:20px;">An error occurred while loading your stories. Please try again later.</p>';
    }
};

// Execute the main function
displayUserStories();
