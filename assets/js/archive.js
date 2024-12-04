// Fetch the username from localStorage
const currentUser = localStorage.getItem('currentuser');

// Helper function to create a story card with a delete icon
const createStoryCard = (title) => {
    const storyCard = document.createElement('div');
    storyCard.classList.add('story-card', 'mb-4', 'p-3', 'border', 'rounded', 'position-relative');
    
    // Create title
    const titleElement = document.createElement('h4');
    titleElement.textContent = title;

    // Create delete icon (hidden by default)
    const deleteIcon = document.createElement('i');
    deleteIcon.classList.add('bi', 'bi-trash', 'story-delete-icon');
    deleteIcon.style.position = 'absolute';
    deleteIcon.style.top = '10px';
    deleteIcon.style.right = '10px';
    deleteIcon.style.cursor = 'pointer';
    deleteIcon.style.display = 'none';  // Initially hidden

    // Append title and delete icon to the card
    storyCard.appendChild(titleElement);
    storyCard.appendChild(deleteIcon);

    // Add the hover effect to show the delete icon
    storyCard.addEventListener('mouseenter', () => {
        deleteIcon.style.display = 'block';  // Show the delete icon
    });
    
    storyCard.addEventListener('mouseleave', () => {
        deleteIcon.style.display = 'none';  // Hide the delete icon
    });

    // Event listener for the delete icon
    deleteIcon.addEventListener('click', () => handleDeleteStory(title));

    return storyCard;
};

// Function to handle the delete action
const handleDeleteStory = (title) => {
    // Filter out the story based on the title
    const updatedStories = stories.filter(story => story.title !== title);

    // Update the displayed stories
    updateStoryDisplay(updatedStories, '');

    // Optionally, update the conversation data in the backend (via AJAX or other methods)
    fetch(`/delete_story/${encodeURIComponent(title)}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Story deleted successfully');
            } else {
                console.error('Failed to delete story');
            }
        });
};

// Function to update the display of stories
const updateStoryDisplay = (filteredStories, searchTerm) => {
    storyCardsContainer.innerHTML = '';  // Clear previous content

    // Add story count message
    if (searchTerm) {
        storyCountElement.textContent = `There’s ${filteredStories.length} story title${filteredStories.length === 1 ? '' : 's'} with “${searchTerm}”`;
    } else {
        storyCountElement.textContent = `You created ${filteredStories.length} previous ${filteredStories.length === 1 ? 'story' : 'stories'} with Storyboard-AI`;
    }

    // Create and append new story cards
    filteredStories.forEach(story => {
        const storyCard = createStoryCard(formatStoryTitle(story.title));
        storyCardsContainer.appendChild(storyCard);
    });
};

// Helper function to sanitize and format story titles
const formatStoryTitle = (title) => {
    if (title.startsWith('Title: ')) return title.slice(7);
    if (title.startsWith('Story Title: ')) return title.slice(13);
    return title || 'Untitled Story';
};

// Main function to handle stories display
const displayUserStories = async () => {
    if (!currentUser) {
        console.error('No current user found in localStorage');
        alert('No user logged in');
        return;
    }

    try {
        // Fetch the JSON data from Flask
        const response = await fetch('/assets/json/conversations.json');

        // Handle non-200 responses
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();

        // Validate the data format
        if (!Array.isArray(data)) throw new Error('Data is not an array');

        // Filter stories by the current user's username
        const userStories = data.filter(story => story.userName === currentUser);

        // Get DOM elements
        const storyCardsContainer = document.getElementById('story-cards-container');
        const storyCountElement = document.getElementById('story-count');
        const searchBar = document.getElementById('search-bar');
        const searchIcon = document.querySelector('.bi-search');  // Select the search icon

        // Clear any existing content in the container
        storyCardsContainer.innerHTML = '';

        if (userStories.length === 0) {
            // Display message if no stories are saved for the user
            const noStoriesMessage = document.createElement('p');
            noStoriesMessage.textContent = `No stories saved for user: ${currentUser}`;
            noStoriesMessage.style.textAlign = 'center';
            noStoriesMessage.style.fontStyle = 'italic';
            storyCardsContainer.appendChild(noStoriesMessage);

            // Hide the search bar, search icon, and story count element if no stories exist
            searchBar.style.display = 'none';
            if (searchIcon) searchIcon.style.display = 'none';  // Hide the search icon
            storyCountElement.style.display = 'none';
            return;
        }

        const updateStoryDisplay = (filteredStories, searchTerm) => {
            // Update story count message or display the search result message
            if (searchTerm) {
                storyCountElement.textContent = `There’s ${filteredStories.length} story title${filteredStories.length === 1 ? '' : 's'} with “${searchTerm}”`;
            } else {
                storyCountElement.textContent = `You created ${filteredStories.length} previous ${filteredStories.length === 1 ? 'story' : 'stories'} with Storyboard-AI`;
            }
            storyCountElement.style.display = filteredStories.length > 0 ? 'block' : 'none';

            // Clear previous cards
            storyCardsContainer.innerHTML = '';

            if (filteredStories.length > 0) {
                // Create and append all filtered story cards
                const fragment = document.createDocumentFragment();
                filteredStories.forEach(story => {
                    const storyCard = createStoryCard(formatStoryTitle(story.title));
                    fragment.appendChild(storyCard);
                });
                storyCardsContainer.appendChild(fragment);
            } else {
                // Display a message if no matching stories
                const noStoriesMessage = document.createElement('p');
                noStoriesMessage.textContent = 'No stories found for this search';
                noStoriesMessage.style.textAlign = 'center';
                noStoriesMessage.style.fontStyle = 'italic';
                storyCardsContainer.appendChild(noStoriesMessage);
            }
        };

        // Initially show all stories
        updateStoryDisplay(userStories, '');

        // Listen for search input and filter stories dynamically
        searchBar.addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase();
            const filteredStories = userStories.filter(story =>
                formatStoryTitle(story.title).toLowerCase().includes(searchTerm)
            );
            updateStoryDisplay(filteredStories, searchTerm);
        });

    } catch (error) {
        console.error('Error fetching or processing conversation data:', error);

        // Hide the story count element
        const storyCountElement = document.getElementById('story-count');
        storyCountElement.style.display = 'none';

        // Display an error message to the user
        const storyCardsContainer = document.getElementById('story-cards-container');
        storyCardsContainer.innerHTML = ''; // Clear any existing content

        const errorMessage = document.createElement('p');
        errorMessage.textContent = 'An error occurred while loading your stories. Please try again later.';
        errorMessage.style.textAlign = 'center'; // Center the error message
        errorMessage.style.marginTop = '20px'; // Adds space above the error message
        storyCardsContainer.appendChild(errorMessage);
    }
};


// Execute the main function
displayUserStories();
