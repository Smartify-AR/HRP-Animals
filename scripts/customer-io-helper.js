// Customer.io integration helper – works even if the Customer.io snippet is not loaded yet.
// Load this script on landing, nickname and badges pages. When you add the Customer.io
// snippet to the app, identify and sync will run automatically.

/**
 * Safely identify a user in Customer.io
 * @param {string} userId - The user's unique ID
 * @param {object} attributes - User attributes to set
 */
function identifyCustomerIO(userId, attributes) {
    try {
        if (typeof cio !== 'undefined' && cio.identify) {
            cio.identify(userId, attributes);
            console.log('Customer.io: User identified', userId, attributes);
        } else {
            console.debug('Customer.io: Not loaded yet, skipping identify');
        }
    } catch (error) {
        console.warn('Customer.io: Error identifying user', error);
    }
}

/**
 * Sync user data to Customer.io (nickname, badges, games completed, last seen)
 * @param {object} userData - The user data object from localStorage
 */
function syncUserToCustomerIO(userData) {
    if (!userData || !userData.userId) {
        return;
    }

    const attributes = {
        nickname: userData.nickname || '',
        created: userData.created || new Date().toISOString(),
        badges_count: userData.progress?.badges?.length || 0,
        badges: userData.progress?.badges || [],
        badge_dates: userData.progress?.badgeDates || {},
        games_completed_count: userData.progress?.gamesCompleted?.length || 0,
        games_completed: userData.progress?.gamesCompleted || [],
        last_seen: new Date().toISOString()
    };

    if (userData.progress?.highScores) {
        attributes.high_scores = userData.progress.highScores;
    }

    identifyCustomerIO(userData.userId, attributes);
}

/**
 * Call after a badge is collected so Customer.io can be updated when the snippet is present
 * @param {string} badgeId - The badge ID that was collected
 */
function updateBadgeInCustomerIO(badgeId) {
    try {
        const userData = JSON.parse(localStorage.getItem('userData') || 'null');
        if (userData && userData.userId) {
            syncUserToCustomerIO(userData);
        }
    } catch (error) {
        console.warn('Customer.io: Error updating badge', error);
    }
}

/**
 * Call after a game is completed so Customer.io can be updated when the snippet is present
 * @param {string} gameId - The game ID that was completed
 */
function updateGameCompletedInCustomerIO(gameId) {
    try {
        const userData = JSON.parse(localStorage.getItem('userData') || 'null');
        if (userData && userData.userId) {
            syncUserToCustomerIO(userData);
        }
    } catch (error) {
        console.warn('Customer.io: Error updating game completion', error);
    }
}
