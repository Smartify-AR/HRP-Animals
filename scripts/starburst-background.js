(function() {
    'use strict';

    function initStarburstBackground() {
        if (document.getElementById('starburst-background')) {
            return;
        }

        const style = document.createElement('style');
        style.textContent = `
            .starburst-background {
                position: fixed;
                top: 50%;
                left: 50%;
                width: 150vw;
                height: 150vh;
                min-width: 1200px;
                min-height: 1200px;
                pointer-events: none;
                z-index: 0;
                transform: translate(-50%, -50%);
                transform-origin: 50% 41.13%;
                animation: rotateStarburst 60s linear infinite;
                opacity: 1;
            }

            .starburst-background img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                display: block;
            }

            @keyframes rotateStarburst {
                from {
                    transform: translate(-50%, -50%) rotate(0deg);
                }
                to {
                    transform: translate(-50%, -50%) rotate(360deg);
                }
            }
        `;
        document.head.appendChild(style);

        // Determine the correct path to starburst image based on current page location
        const pathname = window.location.pathname;
        let starburstPath = './assets/Startburst.svg';
        
        // If we're in a subdirectory, adjust the path
        // Count how many levels deep we are
        const depth = (pathname.match(/\//g) || []).length - 1;
        // If depth >= 1, we're in a subdirectory (e.g., /pages/leaderboard.html)
        // and need to go up one level to reach root assets/
        if (depth >= 1) {
            // We're in a subdirectory, need to go up
            starburstPath = '../assets/Startburst.svg';
        }
        
        const starburstDiv = document.createElement('div');
        starburstDiv.id = 'starburst-background';
        starburstDiv.className = 'starburst-background';
        starburstDiv.innerHTML = `<img src="${starburstPath}" alt="Starburst background">`;
        document.body.appendChild(starburstDiv);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStarburstBackground);
    } else {
        initStarburstBackground();
    }
})();

