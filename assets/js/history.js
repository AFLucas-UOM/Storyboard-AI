// Fetch the username from localStorage
const currentUser = localStorage.getItem('currentuser');

// Helper function to create a story card
const createStoryCard = (title) => {
    const storyCard = document.createElement('div');
    storyCard.classList.add('story-card', 'mb-4', 'p-3', 'border', 'rounded');

    const titleElement = document.createElement('h4');
    titleElement.textContent = title;

    storyCard.appendChild(titleElement);
    return storyCard;
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
