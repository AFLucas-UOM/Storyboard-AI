// Fetch the username from localStorage
const currentUser = localStorage.getItem('currentuser');

// Check if currentUser exists
if (!currentUser) {
    console.error('No current user found in localStorage');
    alert('No user logged in');
} else {
    // Fetch the JSON data from Flask
    fetch('/assets/json/conversations.json')
        .then(response => response.json())  // Parse the response as JSON
        .then(data => {
            // Check if the data is an array
            if (Array.isArray(data)) {
                // Filter stories that match the current user's username
                const userStories = data.filter(story => story.userName === currentUser);

                // Get the container to display the stories
                const storyCardsContainer = document.getElementById('story-cards-container');

                // Check if user stories are found
                if (userStories.length > 0) {
                    userStories.forEach(story => {
                        // Remove "Title: " or "Story Title" if present
                        let storyTitle = story.title;
                        if (storyTitle.startsWith('Title: ')) {
                            storyTitle = storyTitle.slice(7); // Remove the first 7 characters
                        } else if (storyTitle.startsWith('Story Title: ')) {
                            storyTitle = storyTitle.slice(13); // Remove the first 13 characters
                        }

                        // Create a card element for each story
                        const storyCard = document.createElement('div');
                        storyCard.classList.add('story-card', 'mb-4', 'p-3', 'border', 'rounded');

                        // Add the modified story title
                        const titleElement = document.createElement('h4');
                        titleElement.textContent = storyTitle;

                        // Append the title to the story card
                        storyCard.appendChild(titleElement);

                        // Append the card to the container
                        storyCardsContainer.appendChild(storyCard);
                    });
                } else {
                    // If no stories are found, display a message
                    const noStoriesMessage = document.createElement('p');
                    noStoriesMessage.textContent = 'No stories found for this user.';
                    storyCardsContainer.appendChild(noStoriesMessage);
                }
            } else {
                console.error('Error: Data is not an array', data);
            }
        })
        .catch(error => {
            console.error('Error fetching conversation data:', error);
        });
}
