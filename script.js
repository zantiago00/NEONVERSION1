// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const player = document.getElementById('player');
const container = document.getElementById('gameContainer');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const comboEl = document.getElementById('combo');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const playerNameInput = document.getElementById('playerName'); // Referencia al input
const rankingDisplayScreen = document.getElementById('rankingDisplay'); // Pantalla final con ranking
const rankingDiv = document.getElementById('ranking'); // Div donde va la tabla
const finalScoreTextEl = document.getElementById('finalScoreText'); // Párrafo para puntuación final

// --- CONSTANTES Y VARIABLES GLOBALES ---
const gravity = 0.65;
const initialJumpStrength = 18;
const groundY = 0;
const baseSpeed = 7;
const initialTime = 120;
const RANKING_URL = "https://script.google.com/macros/s/AKfycbzBUuj5qYyp9PnnP83ofKBGwStiqmk8ixX4CcQiPZWAevi1_vB6rqiXtYioXM4GcnHidw/exec"; // URL del Ranking API

let gameRunning = false;
let score = 0;
let combo = 0;
let gameTime = initialTime;
let gameLoopId;
let playerName = "Anónimo"; // Nombre por defecto

let playerY = 0;
let velocityY = 0;
let isJumping = false;
let canDoubleJump = false; // Flag: ¿Tiene el poder de doble salto activo?

let obstacles = [];
let coins = [];
let currentSpeed = baseSpeed;
let speedBoostActive = false;
let boostDuration = 0;

let obstacleInterval;
let coinInterval;

// --- FUNCIONES PRINCIPALES DEL JUEGO ---

function startGame() {
    // Obtener nombre del jugador
    playerName = playerNameInput.value.trim() || "Anónimo";
    if (playerName.length > 15) playerName = playerName.substring(0, 15); // Limitar longitud

    startScreen.style.display = 'none';
    rankingDisplayScreen.style.display = 'none'; // Ocultar pantalla de ranking

    gameRunning = true;
    score = 0; combo = 0; gameTime = initialTime;
    obstacles = []; coins = [];
    playerY = groundY; velocityY = 0; isJumping = false;
    canDoubleJump = false; // Resetear poder al inicio
    speedBoostActive = false; boostDuration = 0; currentSpeed = baseSpeed;

    container.querySelectorAll('.obstacle, .coin, .floating-text').forEach(el => el.remove());
    player.style.bottom = playerY + 'px';
    player.classList.remove('powered', 'jumping');

    updateUI();
    clearIntervals();
    obstacleInterval = setInterval(spawnObstacle, 1800); // Ajustar frecuencia si es necesario
    coinInterval = setInterval(spawnCoin, 2500);

    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = requestAnimationFrame(updateGame);
}

function updateGame() {
    if (!gameRunning) return;

    gameTime = Math.max(0, gameTime - (1 / 60));
    updateUI();

    if (gameTime <= 0) {
        gameOver();
        return;
    }

    if (speedBoostActive) {
        boostDuration -= (1 / 60);
        if (boostDuration <= 0) speedBoostActive = false;
    }

    if (!speedBoostActive) {
        currentSpeed = baseSpeed * (combo >= 6 ? 1.5 : combo >= 3 ? 1.2 : 1);
    } else {
         currentSpeed = baseSpeed * 1.5; // Mantener velocidad boost si está activo
    }


    velocityY -= gravity;
    playerY += velocityY;

    if (playerY <= groundY) {
        playerY = groundY;
        velocityY = 0;
        if (isJumping) {
            isJumping = false;
            player.classList.remove('jumping');
            // IMPORTANTE: NO resetear canDoubleJump aquí. Persiste hasta que se usa o se pierde por colisión.
        }
    }

     // Ajustar fuerza de salto dinámicamente
    const currentJumpStrength = initialJumpStrength * (combo >= 3 ? 1.15 : 1); // Ligero boost con combo

    player.style.bottom = playerY + 'px';

    updateObstacles();
    updateCoins();

    gameLoopId = requestAnimationFrame(updateGame);
}

async function gameOver() { // Hacerla async para esperar fetch
    if (!gameRunning) return; // Evitar múltiples llamadas
    gameRunning = false;
    clearIntervals();
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = null;

    // Mostrar Puntuación Final Inmediatamente
     finalScoreTextEl.textContent = `${playerName}, tu puntuación: ${score} | Combo Máx: ${combo}`;
     rankingDiv.innerHTML = "<p>Cargando ranking...</p>"; // Mensaje mientras carga
     rankingDisplayScreen.style.display = 'flex'; // Mostrar pantalla final

    // --- Lógica del Ranking ---
    const nombreCodificado = encodeURIComponent(playerName);
    // Enviar la puntuación (score), no el tiempo. Ajustar endpoint si es necesario.
    const puntajeCodificado = encodeURIComponent(score);
    const urlEnviar = `${RANKING_URL}?nombre=${nombreCodificado}&puntaje=${puntajeCodificado}`;

    try {
        // Enviar puntuación (no necesitamos esperar la respuesta si no la usamos)
        fetch(urlEnviar).catch(console.error); // Enviar en segundo plano, loguear error si falla

        // Obtener ranking
        const response = await fetch(RANKING_URL);
        if (!response.ok) throw new Error(`Error al obtener ranking: ${response.statusText}`);
        const data = await response.json();

        // Procesar y mostrar ranking
        // Asegurarse que puntaje sea número para ordenar correctamente
         const top = data
             .map(r => ({ ...r, puntaje: parseInt(r.puntaje) || 0 })) // Convertir a número
             .sort((a, b) => b.puntaje - a.puntaje) // Ordenar por puntos (descendente)
             .slice(0, 20); // Top 20

         let table = '<h2>Ranking Top 20</h2><table><tr><th>#</th><th>Nombre</th><th>Puntos</th></tr>'; // Cambiado a Puntos
         top.forEach((r, i) => {
             // Evitar XSS simple escapando caracteres básicos HTML
             const safeName = r.nombre.replace(/</g, "&lt;").replace(/>/g, "&gt;");
             table += `<tr><td>${i + 1}</td><td>${safeName}</td><td>${r.puntaje}</td></tr>`; // Mostrar puntos
         });
         table += '</table>';
         rankingDiv.innerHTML = table;

    } catch (error) {
         console.error("Error con el ranking:", error);
         rankingDiv.innerHTML = "<p>No se pudo cargar el ranking. Intenta más tarde.</p>";
    }
}

// --- FUNCIONES DE LÓGICA DEL JUEGO ---

function jump() {
     if (!gameRunning) return;

     const currentJumpStrength = initialJumpStrength * (combo >= 3 ? 1.15 : 1);

     // Salto Normal (desde el suelo)
    if (!isJumping) {
        isJumping = true;
        velocityY = currentJumpStrength;
        player.classList.add('jumping');
         // Remover clase jumping después de un tiempo corto para animación
        setTimeout(() => player.classList.remove('jumping'), 200);
    }
    // Doble Salto (si está en el aire y TIENE el poder)
    else if (isJumping && canDoubleJump) {
         velocityY = currentJumpStrength * 1.1; // Doble salto un poco más fuerte
         canDoubleJump = false; // ¡Consume el poder!
         player.classList.remove('powered'); // Quitar estilo visual del poder

         // Efecto visual/sonido para doble salto?
         player.classList.add('jumping');
         setTimeout(() => player.classList.remove('jumping'), 200);
    }
}

function spawnObstacle() {
     if (!gameRunning) return;
     const MIN_OBSTACLE_GAP = 100; // Espacio mínimo entre obstáculos

     const obs = document.createElement('div');
     obs.className = 'obstacle';
     let obsWidth = 62; // Ancho base

     // Posición inicial fuera de pantalla
     obs.style.left = container.offsetWidth + 'px';
     obs.style.bottom = groundY + 'px';

     let makeLarger = false;
     let spawnSecond = false;

     // Lógica de dificultad por combo
     if (combo >= 3) {
         if (Math.random() < 0.3) { // 30% de ser más grande
             obs.style.width = '74px';
             obs.style.height = '74px';
             obs.classList.add('large');
             obsWidth = 74;
             makeLarger = true;
         }
         if (Math.random() < 0.4) { // 40% de generar segundo obstáculo
             spawnSecond = true;
         }
     }

     container.appendChild(obs);
     obstacles.push(obs);

     // Generar segundo obstáculo si aplica, asegurando separación
     if (spawnSecond) {
         const secondObstacle = document.createElement('div');
         secondObstacle.className = 'obstacle';
         // Calcular posición del segundo basado en el primero + gap
         secondObstacle.style.left = (container.offsetWidth + obsWidth + MIN_OBSTACLE_GAP + Math.random() * 50) + 'px'; // Gap mínimo + aleatorio
         secondObstacle.style.bottom = groundY + 'px';

          // Opcional: aplicar aleatoriedad de tamaño también al segundo
         if (makeLarger && Math.random() < 0.5){
              secondObstacle.style.width = '74px';
              secondObstacle.style.height = '74px';
              secondObstacle.classList.add('large');
         }

         container.appendChild(secondObstacle);
         obstacles.push(secondObstacle);
     }
}


function updateObstacles() {
     obstacles = obstacles.filter(obstacle => {
         let currentLeft = parseFloat(obstacle.style.left);
         let newLeft = currentLeft - currentSpeed;
         obstacle.style.left = newLeft + 'px';

         if (checkCollision(player, obstacle)) {
             gameTime = Math.max(0, gameTime - 1);
             combo = 0;
             updateUI();
             speedBoostActive = false;
             canDoubleJump = false; // Pierde el doble salto al chocar
             player.classList.remove('powered');

             const rect = obstacle.getBoundingClientRect();
             const containerRect = container.getBoundingClientRect();
             showFloatingText(rect.left - containerRect.left + rect.width/2, rect.top - containerRect.top - 10, '-1s', false);

             obstacle.remove();
             return false;
         }

         if (newLeft < -obstacle.offsetWidth) {
              score++;
              updateUI();
              obstacle.remove();
              return false;
           }
           return true;
     });
}

function spawnCoin() {
    if (!gameRunning) return;
    let coinType; let bonus;
    if (combo >= 6) { coinType = 'yellow'; bonus = 5; }
    else if (combo >= 3) { coinType = 'blue'; bonus = 2; }
    else { coinType = 'green'; bonus = 1; }

    const coin = document.createElement('div');
    coin.className = `coin ${coinType}`;
    coin.textContent = `+${bonus}s`;
    coin.style.left = container.offsetWidth + Math.random() * 100 + 'px';
    const randomBottom = Math.random() * (container.offsetHeight * 0.6) + 50;
    coin.style.bottom = Math.min(randomBottom, container.offsetHeight - 80) + 'px';

    container.appendChild(coin);
    coins.push({ element: coin, bonus: bonus, type: coinType });
}

function updateCoins() {
    coins = coins.filter(coinData => {
        const coinElement = coinData.element;
        let currentLeft = parseFloat(coinElement.style.left);
        let newLeft = currentLeft - currentSpeed;
        coinElement.style.left = newLeft + 'px';

        if (checkCollision(player, coinElement)) {
            combo++;
            gameTime = Math.min(initialTime + 30, gameTime + coinData.bonus);
            score += 5 * combo; // Puntos proporcionales al combo
            updateUI();

            if (coinData.type === 'blue' || coinData.type === 'yellow') {
                speedBoostActive = true;
                boostDuration = 5;
                // La velocidad actual se actualizará en el siguiente frame
            }
            if (coinData.type === 'yellow') {
                canDoubleJump = true; // Otorga el PODER de doble salto
                // hasDoubleJump ya no se usa aquí
                player.classList.add('powered');
            }

            const rect = coinElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            showFloatingText(rect.left - containerRect.left + rect.width/2, rect.top - containerRect.top - 10, `+${coinData.bonus}s`, true);

            coinElement.remove();
            return false;
        }

        if (newLeft < -coinElement.offsetWidth) {
             coinElement.remove();
             return false;
           }
           return true;
    });
}

// --- FUNCIONES AUXILIARES Y DE UI ---

function showFloatingText(x, y, text, isPlus) {
    const el = document.createElement('div');
    el.className = `floating-text ${isPlus ? 'plus' : 'minus'}`;
    el.textContent = text;
    el.style.left = x + 'px'; // Centrar horizontalmente
    el.style.top = y + 'px';
     // Forzar reflow para reiniciar animación si aparece rápido de nuevo
     el.offsetHeight;
    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1150);
}

function checkCollision(el1, el2) {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();
    const margin = -15; // Margen negativo para colisión más permisiva
    return (
        rect1.left < rect2.right + margin &&
        rect1.right > rect2.left - margin &&
        rect1.top < rect2.bottom + margin &&
        rect1.bottom > rect2.top - margin
    );
}

function clearIntervals() {
    clearInterval(obstacleInterval); clearInterval(coinInterval);
    obstacleInterval = null; coinInterval = null;
}

function updateUI() {
    scoreEl.textContent = score;
    timerEl.textContent = gameTime.toFixed(1);
    comboEl.textContent = 'Combo: ' + combo;
}

// --- EVENT LISTENERS ---
 startButton.addEventListener('click', startGame);
 playerNameInput.addEventListener('keyup', (e) => { // Iniciar con Enter en input
     if (e.key === 'Enter' && !gameRunning && startScreen.style.display !== 'none') {
         startGame();
     }
 });

 let keydownHandlerAttached = false;
 function handleKeyDown(e) {
     if (e.code === 'Space' && gameRunning) jump();
     if (e.key === 'Enter' && !gameRunning && startScreen.style.display !== 'none') startGame();
 }
 if (!keydownHandlerAttached) {
     document.addEventListener('keydown', handleKeyDown);
     keydownHandlerAttached = true;
 }

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) e.preventDefault();
});
container.addEventListener('touchstart', (e) => {
    if (e.target === container || e.target === player) {
        if (gameRunning) { jump(); e.preventDefault(); }
    }
}, { passive: false });
