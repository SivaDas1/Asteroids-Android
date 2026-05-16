
import random
import math
from kivy.app import App
from kivy.uix.widget import Widget
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.graphics import Color, Line, Ellipse, PushMatrix, PopMatrix, Rotate, Translate, InstructionGroup
from kivy.properties import NumericProperty, ReferenceListProperty, ObjectProperty, ListProperty, StringProperty
from kivy.vector import Vector
from kivy.uix.label import Label
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.button import Button
from kivy.core.audio import SoundLoader

# AdMob Integration
try:
    from kivmob import KivMob, TestIds
except ImportError:
    # Mock class so the game works on Windows without ads
    class KivMob:
        def __init__(self, id): self.app = App.get_running_app()
        def new_banner(self, id, top): pass
        def request_banner(self): pass
        def show_banner(self): 
            if hasattr(App.get_running_app(), 'ad_placeholder'):
                App.get_running_app().ad_placeholder.opacity = 1
        def hide_banner(self): 
            if hasattr(App.get_running_app(), 'ad_placeholder'):
                App.get_running_app().ad_placeholder.opacity = 0
        def new_interstitial(self, id): pass
        def request_interstitial(self): pass
        def show_interstitial(self): 
            print("--- DESKTOP DEBUG: Full Screen Interstitial Ad Shown ---")
    class TestIds:
        APP = 'app'; BANNER = 'banner'; INTERSTITIAL = 'interstitial'

# Game Constants
FPS = 60
THRUST_CONSUMPTION = 0.5
BULLET_REGEN_INTERVAL = 5.0  # seconds
ALIEN_SPAWN_INTERVAL = 20.0  # seconds
POWERUP_DURATION = 10.0  # seconds
INVINCIBLE_DURATION = 3.0  # seconds

class Vector2D:
    def __init__(self, x, y):
        self.x = x
        self.y = y
    
    def add(self, v):
        self.x += v.x
        self.y += v.y
    
    def mult(self, n):
        self.x *= n
        self.y *= n
    
    def copy(self):
        return Vector2D(self.x, self.y)
    
    def magnitude(self):
        return math.sqrt(self.x**2 + self.y**2)

def dist(x1, y1, x2, y2):
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

class Particle:
    def __init__(self, x, y, color=(1, 1, 1, 1)):
        self.pos = Vector2D(x, y)
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(1, 4)
        self.vel = Vector2D(math.cos(angle) * speed, math.sin(angle) * speed)
        self.life = 1.0  # 1 second
        self.color = color

    def update(self, dt):
        self.pos.add(self.vel)
        self.life -= dt
        return self.life > 0

class ScorePopup:
    def __init__(self, x, y, text):
        self.pos = Vector2D(x, y)
        self.text = text
        self.life = 1.0
        self.vel = Vector2D(0, 1)

    def update(self, dt):
        self.pos.add(self.vel)
        self.life -= dt
        return self.life > 0

class Asteroid:
    def __init__(self, x, y, size, width, height):
        self.pos = Vector2D(x, y)
        self.size = size  # 3, 2, 1
        self.radius = size * 20
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(0.5, 2.0)
        self.vel = Vector2D(math.cos(angle) * speed, math.sin(angle) * speed)
        self.angle = 0
        self.rotation_speed = random.uniform(-0.05, 0.05)
        self.width = width
        self.height = height
        
        # Jagged shape
        self.vertices = []
        vert_count = 10
        for i in range(vert_count):
            a = (i / vert_count) * math.pi * 2
            r = self.radius + random.uniform(-self.radius/4, self.radius/4)
            self.vertices.append(math.cos(a) * r)
            self.vertices.append(math.sin(a) * r)
        # Close loop
        self.vertices.append(self.vertices[0])
        self.vertices.append(self.vertices[1])

    def update(self):
        self.pos.add(self.vel)
        self.angle += self.rotation_speed
        
        # Wrap
        if self.pos.x < -self.radius: self.pos.x = self.width + self.radius
        if self.pos.x > self.width + self.radius: self.pos.x = -self.radius
        if self.pos.y < -self.radius: self.pos.y = self.height + self.radius
        if self.pos.y > self.height + self.radius: self.pos.y = -self.radius

class Bullet:
    def __init__(self, x, y, angle, width, height):
        self.pos = Vector2D(x, y)
        speed = 10
        self.vel = Vector2D(math.cos(angle) * speed, math.sin(angle) * speed)
        self.life = 1.0
        self.width = width
        self.height = height

    def update(self, dt):
        self.pos.add(self.vel)
        self.life -= dt
        # Wrap
        if self.pos.x < 0: self.pos.x = self.width
        if self.pos.x > self.width: self.pos.x = 0
        if self.pos.y < 0: self.pos.y = self.height
        if self.pos.y > self.height: self.pos.y = 0
        return self.life > 0

class AlienShip:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.radius = 15
        self.hit_radius = 25
        self.speed = 3
        
        side = random.randint(0, 3)
        if side == 0: # Top
            self.pos = Vector2D(random.uniform(0, width), height + 50)
            target = Vector2D(random.uniform(0, width), -50)
        elif side == 1: # Right
            self.pos = Vector2D(width + 50, random.uniform(0, height))
            target = Vector2D(-50, random.uniform(0, height))
        elif side == 2: # Bottom
            self.pos = Vector2D(random.uniform(0, width), -50)
            target = Vector2D(random.uniform(0, width), height + 50)
        else: # Left
            self.pos = Vector2D(-50, random.uniform(0, height))
            target = Vector2D(width + 50, random.uniform(0, height))
            
        dx = target.x - self.pos.x
        dy = target.y - self.pos.y
        d = math.sqrt(dx*dx + dy*dy)
        self.vel = Vector2D((dx/d)*self.speed, (dy/d)*self.speed)
        self.life = 10.0
        self.angle = 0

    def update(self, dt):
        self.pos.add(self.vel)
        self.angle += 0.05
        self.life -= dt
        return self.life > 0 and -100 < self.pos.x < self.width + 100 and -100 < self.pos.y < self.height + 100

class AsteroidsGame(Widget):
    score = NumericProperty(0)
    lives = NumericProperty(3)
    fuel = NumericProperty(100)
    bullets_count = NumericProperty(10)
    game_state = StringProperty('start') # start, playing, gameOver
    level = NumericProperty(1)
    
    def __init__(self, **kwargs):
        super(AsteroidsGame, self).__init__(**kwargs)
        self.ship_pos = Vector2D(0, 0)
        self.ship_vel = Vector2D(0, 0)
        self.ship_angle = -math.pi / 2
        self.ship_radius = 15
        self.thrusting = False
        self.invincible = False
        self.invincible_timer = 0
        
        self.asteroids = []
        self.bullets = []
        self.particles = []
        self.score_popups = []
        self.alien_ship = None
        self.stars = [] # [layer][star]
        
        self.keys = set()
        self.touch_controls = {'left': False, 'right': False, 'thrust': False, 'fire': False}
        
        self.bullet_cooldown = 0
        self.bullet_regen_timer = 0
        self.alien_spawn_timer = 0
        self.powerup_active = False
        self.powerup_type = ''
        self.powerup_timer = 0
        
        self.camera_shake = 0
        self.camera_shake_timer = 0
        
        # Audio
        self.sounds = {}
        self.music = None
        self.init_sounds()
        
        # Initialize stars
        Clock.schedule_once(self.init_game, 0)

    def init_sounds(self):
        import os
        script_dir = os.path.dirname(os.path.abspath(__file__))
        print(f"--- Audio Initialization (Dir: {script_dir}) ---")
        
        # SFX
        for sname in ['shoot', 'explosion', 'thrust', 'powerup', 'alien']:
            for ext in ['wav', 'ogg']:
                path = os.path.join(script_dir, f"{sname}.{ext}")
                if os.path.exists(path):
                    try:
                        sound = SoundLoader.load(path)
                        if sound:
                            sound.volume = 1.0
                            if sname == 'alien':
                                sound.loop = True
                            self.sounds[sname] = sound
                            print(f"Loaded SFX: {sname} from {path}")
                            break 
                    except:
                        pass
        
        # Music
        for ext in ['wav', 'ogg', 'mp3']:
            path = os.path.join(script_dir, f"scary_alien.{ext}")
            if os.path.exists(path):
                try:
                    self.music = SoundLoader.load(path)
                    if self.music:
                        self.music.loop = True
                        self.music.volume = 1.0
                        print(f"Loaded Music from {path} (Volume: {self.music.volume})")
                        self.play_music() # Start immediately on load
                        break
                except:
                    pass
        print(f"Audio loading complete.")
        print("---------------------------")

    def play_music(self):
        if self.music:
            if self.music.state != 'play':
                self.music.play()

    def stop_music(self):
        if self.music:
            self.music.stop()

    def init_game(self, dt):
        self.width = Window.width
        self.height = Window.height
        self.ship_pos = Vector2D(self.width / 2, self.height / 2)
        
        # Create stars
        self.stars = []
        for layer in range(3):
            layer_stars = []
            count = 30 + layer * 20
            for _ in range(count):
                layer_stars.append({
                    'x': random.uniform(0, self.width),
                    'y': random.uniform(0, self.height),
                    'size': 1 + layer * 0.5,
                    'alpha': 0.3 + layer * 0.3,
                    'speed': 0.2 + layer * 0.2
                })
            self.stars.append(layer_stars)
        
        Clock.schedule_interval(self.update, 1.0 / FPS)

    def play_sound(self, name):
        if name in self.sounds and self.sounds[name]:
            if self.sounds[name].state == 'play':
                self.sounds[name].stop()
            self.sounds[name].play()

    def start_game(self):
        self.score = 0
        self.lives = 3
        self.fuel = 100
        self.bullets_count = 10
        self.level = 1
        self.game_state = 'playing'
        self.ship_pos = Vector2D(self.width / 2, self.height / 2)
        self.ship_vel = Vector2D(0, 0)
        self.asteroids = []
        self.bullets = []
        self.particles = []
        self.score_popups = []
        self.alien_ship = None
        self.spawn_wave()
        self.respawn_ship(invincibility=False)
        self.play_music()

    def spawn_wave(self):
        count = 4 + self.level
        for _ in range(count):
            while True:
                x = random.uniform(0, self.width)
                y = random.uniform(0, self.height)
                if dist(x, y, self.ship_pos.x, self.ship_pos.y) > 150:
                    self.asteroids.append(Asteroid(x, y, 3, self.width, self.height))
                    break

    def respawn_ship(self, invincibility=True):
        self.ship_pos = Vector2D(self.width / 2, self.height / 2)
        self.ship_vel = Vector2D(0, 0)
        self.ship_angle = -math.pi / 2
        if invincibility:
            self.invincible = True
            self.invincible_timer = INVINCIBLE_DURATION

    def update(self, dt):
        if self.game_state != 'playing':
            self.draw_canvas()
            return

        # Handle controls
        if self.touch_controls['left'] or 'left' in self.keys or 'a' in self.keys:
            self.ship_angle -= 0.08
        if self.touch_controls['right'] or 'right' in self.keys or 'd' in self.keys:
            self.ship_angle += 0.08
        
        self.thrusting = False
        if (self.touch_controls['thrust'] or 'up' in self.keys or 'w' in self.keys) and self.fuel > 0:
            acc = 0.2
            self.ship_vel.x += math.cos(self.ship_angle) * acc
            self.ship_vel.y += math.sin(self.ship_angle) * acc
            self.thrusting = True
            self.fuel = max(0, self.fuel - THRUST_CONSUMPTION)
            self.camera_shake = 2
            self.camera_shake_timer = 0.1
            self.play_sound('thrust')
        
        if self.touch_controls['fire'] or 'space' in self.keys:
            self.shoot()

        # Ship update
        self.ship_vel.mult(0.98) # Friction
        self.ship_pos.add(self.ship_vel)
        # Wrap
        if self.ship_pos.x < 0: self.ship_pos.x = self.width
        if self.ship_pos.x > self.width: self.ship_pos.x = 0
        if self.ship_pos.y < 0: self.ship_pos.y = self.height
        if self.ship_pos.y > self.height: self.ship_pos.y = 0
        
        if self.invincible:
            self.invincible_timer -= dt
            if self.invincible_timer <= 0:
                self.invincible = False

        # Systems
        self.bullet_cooldown = max(0, self.bullet_cooldown - dt)
        self.bullet_regen_timer += dt
        if self.bullet_regen_timer >= BULLET_REGEN_INTERVAL:
            self.bullets_count = min(20, self.bullets_count + 1)
            self.bullet_regen_timer = 0
            
        self.alien_spawn_timer += dt
        if self.alien_spawn_timer >= ALIEN_SPAWN_INTERVAL and not self.alien_ship:
            self.alien_ship = AlienShip(self.width, self.height)
            self.alien_spawn_timer = 0
            
        if self.powerup_active:
            self.powerup_timer -= dt
            if self.powerup_timer <= 0:
                self.powerup_active = False
                self.powerup_type = ''

        # Updates
        self.bullets = [b for b in self.bullets if b.update(dt)]
        for a in self.asteroids: a.update()
        
        # Alien Ship presence logic
        if self.alien_ship:
            if not self.alien_ship.update(dt):
                self.alien_ship = None
                self.play_sound('explosion') # Sound when it leaves or dies
            else:
                # Play alien pulsating sound while active
                if 'alien' in self.sounds and self.sounds['alien'].state != 'play':
                    self.sounds['alien'].play()
        else:
            # Stop alien sound if no ship is present
            if 'alien' in self.sounds and self.sounds['alien'].state == 'play':
                self.sounds['alien'].stop()
        
        self.particles = [p for p in self.particles if p.update(dt)]
        self.score_popups = [s for s in self.score_popups if s.update(dt)]
        
        # Parallax Stars
        for layer in self.stars:
            for s in layer:
                s['x'] += s['speed'] + self.ship_vel.x * 0.1
                s['y'] += s['speed'] + self.ship_vel.y * 0.1
                if s['x'] > self.width: s['x'] = 0
                if s['x'] < 0: s['x'] = self.width
                if s['y'] > self.height: s['y'] = 0
                if s['y'] < 0: s['y'] = self.height

        self.check_collisions()
        
        if not self.asteroids and self.game_state == 'playing':
            self.level += 1
            self.spawn_wave()
            
        if self.camera_shake_timer > 0:
            self.camera_shake_timer -= dt
        else:
            self.camera_shake = 0

        self.draw_canvas()

    def shoot(self):
        if self.bullet_cooldown <= 0 and (self.bullets_count > 0 or self.powerup_type == 'infinite_bullets'):
            self.bullets.append(Bullet(self.ship_pos.x, self.ship_pos.y, self.ship_angle, self.width, self.height))
            if self.powerup_type != 'infinite_bullets':
                self.bullets_count -= 1
            self.bullet_cooldown = 0.2
            self.camera_shake = 3
            self.camera_shake_timer = 0.1
            self.play_sound('shoot')

    def check_collisions(self):
        # Bullet vs Asteroids
        for b in self.bullets[:]:
            for a in self.asteroids[:]:
                if dist(b.pos.x, b.pos.y, a.pos.x, a.pos.y) < a.radius:
                    if b in self.bullets: self.bullets.remove(b)
                    self.explode_asteroid(a)
                    break
        
        # Bullet vs Alien
        if self.alien_ship:
            for b in self.bullets[:]:
                if dist(b.pos.x, b.pos.y, self.alien_ship.pos.x, self.alien_ship.pos.y) < self.alien_ship.hit_radius:
                    if b in self.bullets: self.bullets.remove(b)
                    self.explode_alien()
                    break

        # Ship vs Asteroids
        if not self.invincible:
            for a in self.asteroids:
                if dist(self.ship_pos.x, self.ship_pos.y, a.pos.x, a.pos.y) < self.ship_radius + a.radius:
                    self.ship_hit()
                    break
            
            if self.alien_ship:
                if dist(self.ship_pos.x, self.ship_pos.y, self.alien_ship.pos.x, self.alien_ship.pos.y) < self.ship_radius + self.alien_ship.radius:
                    self.ship_hit()

    def explode_asteroid(self, a):
        self.asteroids.remove(a)
        self.score += a.size * 100
        self.score_popups.append(ScorePopup(a.pos.x, a.pos.y, f"+{a.size*100}"))
        self.create_explosion(a.pos.x, a.pos.y, 10)
        self.camera_shake = 5
        self.camera_shake_timer = 0.2
        self.play_sound('explosion')
        
        if a.size > 1:
            for _ in range(2):
                self.asteroids.append(Asteroid(a.pos.x, a.pos.y, a.size - 1, self.width, self.height))
        
        # Rewards
        if a.size == 3:
            self.fuel = min(100, self.fuel + 20)
            self.score_popups.append(ScorePopup(a.pos.x, a.pos.y - 30, "FUEL +20"))
        self.bullets_count = min(20, self.bullets_count + 1)

    def explode_alien(self):
        self.score += 500
        self.score_popups.append(ScorePopup(self.alien_ship.pos.x, self.alien_ship.pos.y, "+500"))
        self.create_explosion(self.alien_ship.pos.x, self.alien_ship.pos.y, 20, color=(0, 1, 0, 1))
        
        # Powerup
        self.powerup_active = True
        self.powerup_type = random.choice(['infinite_bullets', 'shield'])
        self.powerup_timer = POWERUP_DURATION
        if self.powerup_type == 'shield':
            self.invincible = True
            self.invincible_timer = POWERUP_DURATION
        self.score_popups.append(ScorePopup(self.alien_ship.pos.x, self.alien_ship.pos.y - 40, self.powerup_type.upper()))
        
        self.alien_ship = None
        self.camera_shake = 10
        self.camera_shake_timer = 0.3
        self.play_sound('powerup')

    def ship_hit(self):
        self.lives -= 1
        self.create_explosion(self.ship_pos.x, self.ship_pos.y, 30)
        self.camera_shake = 15
        self.camera_shake_timer = 0.5
        self.play_sound('explosion')
        if self.lives <= 0:
            self.game_state = 'gameOver'
        else:
            self.respawn_ship()

    def create_explosion(self, x, y, count, color=(1, 1, 1, 1)):
        for _ in range(count):
            self.particles.append(Particle(x, y, color))

    def draw_canvas(self):
        self.canvas.clear()
        with self.canvas:
            # Camera shake
            if self.camera_shake > 0:
                Translate(random.uniform(-self.camera_shake, self.camera_shake), 
                          random.uniform(-self.camera_shake, self.camera_shake))
            
            # Stars
            for layer in self.stars:
                for s in layer:
                    Color(1, 1, 1, s['alpha'])
                    Ellipse(pos=(s['x'], s['y']), size=(s['size'], s['size']))
            
            Color(1, 1, 1, 1)
            
            # Asteroids
            for a in self.asteroids:
                PushMatrix()
                Translate(a.pos.x, a.pos.y)
                Rotate(angle=math.degrees(a.angle), origin=(0, 0))
                Line(points=a.vertices, width=1.2)
                PopMatrix()
            
            # Alien
            if self.alien_ship:
                Color(0, 1, 0, 1)
                PushMatrix()
                Translate(self.alien_ship.pos.x, self.alien_ship.pos.y)
                Rotate(angle=math.degrees(self.alien_ship.angle), origin=(0, 0))
                # Saucer shape
                Line(ellipse=(-15, -8, 30, 16), width=1.5)
                Line(circle=(0, 0, 5), width=1.5)
                PopMatrix()
                Color(1, 1, 1, 1)
            
            # Bullets
            for b in self.bullets:
                Ellipse(pos=(b.pos.x-2, b.pos.y-2), size=(4, 4))
            
            # Particles
            for p in self.particles:
                Color(p.color[0], p.color[1], p.color[2], p.life)
                Ellipse(pos=(p.pos.x-1, p.pos.y-1), size=(2, 2))
            
            # Score Popups
            for s in self.score_popups:
                Color(1, 1, 1, s.life)
                # Create a temporary label with the specific font
                popup_label = Label(text=s.text, font_size='12sp', font_name='PressStart2P.ttf')
                popup_label.texture_update()
                if popup_label.texture:
                    from kivy.graphics import Rectangle
                    Rectangle(texture=popup_label.texture, 
                             pos=(s.pos.x - popup_label.texture.width/2, s.pos.y), 
                             size=popup_label.texture.size)
            
            # Ship
            if self.game_state == 'playing':
                if not self.invincible or int(Clock.get_time()*10) % 2 == 0:
                    PushMatrix()
                    Translate(self.ship_pos.x, self.ship_pos.y)
                    Rotate(angle=math.degrees(self.ship_angle), origin=(0, 0))
                    # Ship Triangle
                    r = self.ship_radius
                    Line(points=[r, 0, -r, -r/1.5, -r/2, 0, -r, r/1.5, r, 0], width=1.5)
                    # Flame
                    if self.thrusting:
                        Line(points=[-r, 0, -r - random.uniform(5, 15), 0], width=1.5)
                    PopMatrix()

            # Score Popups (simplified as they are UI-like but on canvas)
            # Re-using Label for this is hard in pure canvas, skipping for now or using small dots

    def on_touch_down(self, touch):
        if self.game_state == 'start' or self.game_state == 'gameOver':
            self.start_game()
            return

        # Touch controls mapping
        w = self.width
        h = self.height
        if touch.x < w / 4:
            self.touch_controls['left'] = True
        elif touch.x < w / 2:
            self.touch_controls['right'] = True
        elif touch.x < 3 * w / 4:
            self.touch_controls['thrust'] = True
        else:
            self.touch_controls['fire'] = True
            self.shoot()

    def on_touch_up(self, touch):
        for key in self.touch_controls:
            self.touch_controls[key] = False

class AsteroidsApp(App):
    def build(self):
        # Initialize Ads
        self.ads = KivMob(TestIds.APP)
        self.ads.new_banner(TestIds.BANNER, top=False)
        self.ads.request_banner()
        self.ads.new_interstitial(TestIds.INTERSTITIAL)
        self.ads.request_interstitial()
        self.ads.show_banner()

        root = FloatLayout()
        self.game = AsteroidsGame()
        root.add_widget(self.game)
        
        # Desktop Ad Placeholder
        self.ad_placeholder = Label(text="--- ADS ACTIVE ---", 
                                   size_hint=(1, 0.1), 
                                   pos_hint={'x': 0, 'y': 0},
                                   color=(1, 0, 0, 1), # Red text
                                   font_name='PressStart2P.ttf',
                                   font_size='10sp',
                                   opacity=0)
        with self.ad_placeholder.canvas.before:
            Color(0, 0, 0, 0.8)
            from kivy.graphics import Rectangle
            self.ad_bg = Rectangle(pos=self.ad_placeholder.pos, size=self.ad_placeholder.size)
        self.ad_placeholder.bind(pos=self._update_ad_rect, size=self._update_ad_rect)
        root.add_widget(self.ad_placeholder)
        
        # UI Overlay
        self.ui = FloatLayout()
        # Adjusted sizes for PressStart2P which is naturally larger/wider
        self.score_label = Label(text="SCORE: 0", pos_hint={'x': 0.1, 'y': 0.9}, size_hint=(0.2, 0.1), font_size='12sp', font_name='PressStart2P.ttf')
        self.lives_label = Label(text="LIVES: 3", pos_hint={'x': 0.1, 'y': 0.85}, size_hint=(0.2, 0.1), font_size='10sp', font_name='PressStart2P.ttf')
        self.fuel_label = Label(text="FUEL: 100", pos_hint={'x': 0.4, 'y': 0.9}, size_hint=(0.2, 0.1), font_size='10sp', font_name='PressStart2P.ttf')
        self.bullet_label = Label(text="BULLETS: 10", pos_hint={'x': 0.7, 'y': 0.9}, size_hint=(0.2, 0.1), font_size='10sp', font_name='PressStart2P.ttf')
        
        self.ui.add_widget(self.score_label)
        self.ui.add_widget(self.lives_label)
        self.ui.add_widget(self.fuel_label)
        self.ui.add_widget(self.bullet_label)
        root.add_widget(self.ui)
        
        # Screens
        self.start_screen = FloatLayout()
        title = Label(text="ABYSSAL\nASTEROIDS", font_size='35sp', pos_hint={'center_x': 0.5, 'center_y': 0.6}, font_name='PressStart2P.ttf', halign='center')
        instr = Label(text="TAP TO START\n\nCONTROLS: LEFT | RIGHT | THRUST | FIRE", font_size='12sp', pos_hint={'center_x': 0.5, 'center_y': 0.4}, font_name='PressStart2P.ttf', halign='center')
        self.start_screen.add_widget(title)
        self.start_screen.add_widget(instr)
        root.add_widget(self.start_screen)
        
        self.game_over_screen = FloatLayout()
        go_title = Label(text="GAME OVER", font_size='40sp', pos_hint={'center_x': 0.5, 'center_y': 0.6}, font_name='PressStart2P.ttf')
        go_instr = Label(text="TAP TO RESTART", font_size='15sp', pos_hint={'center_x': 0.5, 'center_y': 0.4}, font_name='PressStart2P.ttf')
        self.game_over_screen.add_widget(go_title)
        self.game_over_screen.add_widget(go_instr)
        # Hidden initially
        self.game_over_screen.opacity = 0
        root.add_widget(self.game_over_screen)
        
        Clock.schedule_interval(self.update_ui, 1.0/10.0)
        return root

    def _update_ad_rect(self, instance, value):
        self.ad_bg.pos = instance.pos
        self.ad_bg.size = instance.size

    def update_ui(self, dt):
        self.score_label.text = f"SCORE: {self.game.score}"
        self.lives_label.text = f"LIVES: {self.game.lives}"
        self.fuel_label.text = f"FUEL: {int(self.game.fuel)}"
        self.bullet_label.text = f"BULLETS: {self.game.bullets_count}"
        
        if self.game.game_state == 'start':
            self.start_screen.opacity = 1
            self.game_over_screen.opacity = 0
            self.ads.show_banner()
        elif self.game.game_state == 'playing':
            self.start_screen.opacity = 0
            self.game_over_screen.opacity = 0
            self.ads.hide_banner()
        elif self.game.game_state == 'gameOver':
            if self.game_over_screen.opacity == 0:
                # First frame of game over
                self.ads.show_interstitial()
                self.ads.request_interstitial() # Prepare next one
            self.start_screen.opacity = 0
            self.game_over_screen.opacity = 1
            self.ads.show_banner()

if __name__ == '__main__':
    AsteroidsApp().run()
