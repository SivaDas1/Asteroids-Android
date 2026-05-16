# 80s Asteroids Game

A classic Asteroids arcade game built with pure JavaScript and HTML5 Canvas, featuring authentic 80s black and white pixel art style.

## Features

- **Authentic 80s Style**: Black and white pixel art graphics with CRT-style effects
- **Classic Gameplay**: Navigate your ship, shoot asteroids, and avoid collisions
- **Responsive Design**: Works on desktop and mobile devices
- **High Score System**: Local storage for tracking your best scores
- **Particle Effects**: Explosion animations and visual feedback
- **Screen Wrapping**: Classic arcade physics where objects wrap around screen edges

## Controls

### Desktop
- **W/A/S/D** or **Arrow Keys**: Move and rotate your ship
- **Spacebar**: Fire bullets
- **P**: Pause/Resume game

### Mobile
- **Left Third of Screen**: Rotate left
- **Right Third of Screen**: Rotate right  
- **Middle Third of Screen**: Thrust forward
- **Tap**: Fire bullets

## How to Play

1. Click "Start Game" to begin
2. Use controls to navigate your triangular ship
3. Shoot asteroids to break them into smaller pieces
4. Avoid collisions with asteroids
5. Each destroyed asteroid awards points based on size
6. You have 3 lives - don't lose them all!

## Scoring

- **Large Asteroid**: 100 points
- **Medium Asteroid**: 200 points  
- **Small Asteroid**: 300 points

## Technical Details

- **Framework**: Pure JavaScript (no frameworks)
- **Graphics**: HTML5 Canvas API
- **Animation**: requestAnimationFrame
- **Storage**: localStorage for high scores
- **Responsive**: CSS media queries for mobile support

## Browser Support

This game works in all modern browsers that support HTML5 Canvas:
- Chrome
- Firefox
- Safari
- Edge
- Mobile browsers

## Files

- `index.html` - Main HTML structure and styling
- `game.js` - Game logic and rendering
- `README.md` - This documentation

## To Run

Simply open `index.html` in any modern web browser. No server or build process required!

## Development

The game is built with vanilla JavaScript for maximum compatibility and performance. The code is organized into classes for easy maintenance:

- `Vector` - Mathematical vector operations
- `Ship` - Player ship logic and rendering
- `Bullet` - Projectile management
- `Asteroid` - Asteroid behavior and collision
- `Particle` - Explosion effects

## Future Enhancements

Potential features that could be added:
- Sound effects
- Multiple difficulty levels
- Power-ups
- Boss asteroids
- Local multiplayer

## License

This project is open source and available under the MIT License.

## Credits

Inspired by the classic 1979 Atari game "Asteroids" by Ed Logg and Lyle Rains.