// Configurações do jogo
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const pixelsPorMetro = 3;

// Ajustar canvas ao tamanho da tela
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function logisticCurve(level, maxLevel, steepness = 0.5, midpoint = 7) {
    const x = (level / maxLevel) * 14;
    return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

// Estado do jogo
const game = {
    power: 0,
    angle: 45,
    powerDirection: 1,
    angleDirection: 1,
    isCharging: false,
    isLaunched: false,
    distance: 0,
    bestDistance: 0,
    points: 0,
    timeLeft: 600,
    finishDistance: 10000,
    projectile: null,
    upgrades: {},
    upgradeLevels: {},
    gameOver: false,
    isPaused: false,
    camera: {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        smoothing: 0.1
    },
    dayNightCycle: {
        time: 0,
        cycleDuration: 90,
        isDay: true
    },
    currentMilestoneIndex: 0,
    milestones: [
        { distance: 1500, timeLimit: 60, completed: false, checked: false, timeRemaining: 60 },
        { distance: 2500, timeLimit: 90, completed: false, checked: false, timeRemaining: 90 },
        { distance: 4000, timeLimit: 120, completed: false, checked: false, timeRemaining: 120 },
        { distance: 5500, timeLimit: 120, completed: false, checked: false, timeRemaining: 120 },
        { distance: 7000, timeLimit: 120, completed: false, checked: false, timeRemaining: 120 },
        { distance: 8000, timeLimit: 90, completed: false, checked: false, timeRemaining: 90 },
        { distance: 9000, timeLimit: 60, completed: false, checked: false, timeRemaining: 60 },
        { distance: 10000, timeLimit: 60, completed: false, checked: false, timeRemaining: 60 }
    ],
    milestoneActive: false,
    punishments: [
        { 
            name: 'Investimento Cortado', 
            description: 'Investidores perderam a confiança! Poder reduzido em 50% por 30 segundos',
            effect: () => {
                game.activePunishment = { type: 'powerReduction', multiplier: 0.5, duration: 30, startTime: game.timeLeft };
            }
        },
        { 
            name: 'Reunião de Emergência', 
            description: 'Time todo em reunião! Não é possível fazer lançamentos por 15 segundos',
            effect: () => {
                game.activePunishment = { type: 'lockLaunch', duration: 15, startTime: game.timeLeft };
            }
        },
        { 
            name: 'Bug Crítico em Produção', 
            description: 'Bug crítico! Gravidade aumentada em 100% por 25 segundos',
            effect: () => {
                game.activePunishment = { type: 'gravityIncrease', multiplier: 2, duration: 25, startTime: game.timeLeft };
            }
        },
        { 
            name: 'Cliente Insatisfeito', 
            description: 'Cliente furioso! Próximos 3 lançamentos não geram pontos',
            effect: () => {
                game.activePunishment = { type: 'noPoints', launches: 3, remaining: 3 };
            }
        },
        { 
            name: 'Corte no Orçamento', 
            description: 'CFO cortou orçamento! Perde 30% dos Sprint Points acumulados',
            effect: () => {
                const lost = Math.floor(game.points * 0.3);
                game.points = Math.max(0, game.points - lost);
                pointsDisplay.textContent = Math.floor(game.points);
            }
        },
        { 
            name: 'Servidor Caiu', 
            description: 'Infraestrutura falhou! Arrasto aerodinâmico aumentado em 80% por 35 segundos',
            effect: () => {
                game.activePunishment = { type: 'dragIncrease', multiplier: 0.8, duration: 35, startTime: game.timeLeft };
            }
        },
        { 
            name: 'Desenvolvedor Sênior Saiu', 
            description: 'Perdeu expertise! Todos os upgrades perdem 2 níveis',
            effect: () => {
                Object.keys(game.upgradeLevels).forEach(key => {
                    game.upgradeLevels[key] = Math.max(0, game.upgradeLevels[key] - 2);
                });
                game.upgrades = {};
                upgradesDatabase.forEach(upgrade => {
                    const level = game.upgradeLevels[upgrade.id] || 0;
                    if (level > 0) {
                        game.upgrades[upgrade.id] = true;
                        upgrade.effect(level);
                    }
                });
            }
        },
        { 
            name: 'Auditoria de Compliance', 
            description: 'Equipe em auditoria! Ângulo fixo em 60° pelos próximos 20 segundos',
            effect: () => {
                game.activePunishment = { type: 'fixedAngle', angle: 60, duration: 20, startTime: game.timeLeft };
            }
        },
        { 
            name: 'Burnout da Equipe', 
            description: 'Time exausto! Velocidade de oscilação dobrada por 30 segundos',
            effect: () => {
                game.activePunishment = { type: 'fastOscillation', multiplier: 2, duration: 30, startTime: game.timeLeft };
            }
        },
        { 
            name: 'Ataque DDoS', 
            description: 'Sistema sob ataque! Poder oscila aleatoriamente por 25 segundos',
            effect: () => {
                game.activePunishment = { type: 'randomPower', duration: 25, startTime: game.timeLeft };
            }
        },
        { 
            name: 'Refatoração Forçada', 
            description: 'Código legado encontrado! Distância da meta aumenta em 5.000m',
            effect: () => {
                game.finishDistance += 5000;
                updateFinishLine();
            }
        },
        { 
            name: 'Reunião com Stakeholders', 
            description: 'Apresentação urgente! Timer acelera 2x mais rápido por 20 segundos',
            effect: () => {
                game.activePunishment = { type: 'timerSpeed', multiplier: 2, duration: 20, startTime: game.timeLeft };
            }
        },
        { 
            name: 'Licença de Software Expirou', 
            description: 'Ferramentas bloqueadas! Não pode comprar upgrades por 40 segundos',
            effect: () => {
                game.activePunishment = { type: 'noUpgrades', duration: 40, startTime: game.timeLeft };
            }
        },
        { 
            name: 'Mudança de Escopo', 
            description: 'Cliente mudou requisitos! Próximo lançamento tem metade do alcance',
            effect: () => {
                game.activePunishment = { type: 'halfDistance', launches: 1, remaining: 1 };
            }
        }
    ],
    usedPunishments: [],
    activePunishment: null,
    launchCount: 0
};

// Física do projétil
class Projectile {
    constructor(power, angle) {
        this.x = 200;
        this.y = canvas.height / 2;
        const radians = angle * Math.PI / 180;
        const baseVelocity = power * 7;
        this.velocityX = baseVelocity * Math.cos(radians);
        this.velocityY = -baseVelocity * Math.sin(radians);
        this.gravity = 0.4;
        this.drag = 0.992;
        this.rotation = 0;
        this.distanceTraveled = 0;
        this.onGround = false;
        this.halfDistanceFlag = false;
    }

    update() {
        if (!this.onGround) {
            this.velocityY += this.gravity;
            this.velocityX *= this.drag;
            this.x += this.velocityX;
            this.y += this.velocityY;
            this.rotation += 0.1;
            
            this.distanceTraveled = Math.max(0, (this.x - 200) / pixelsPorMetro);

            const groundLevel = canvas.height - 100;
            if (this.y >= groundLevel) {
                this.y = groundLevel;
                this.onGround = true;
                this.velocityY = 0;
                this.velocityX = 0;
                return false;
            }
            return true;
        }
        return false;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.fillStyle = '#fdbcb4';
        ctx.beginPath();
        ctx.arc(0, -15, 15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-12, 0, 24, 30);
        
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-5, 5);
        ctx.lineTo(-3, 20);
        ctx.lineTo(3, 20);
        ctx.lineTo(5, 5);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-12, 5);
        ctx.lineTo(-20, 15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12, 5);
        ctx.lineTo(20, 15);
        ctx.stroke();
        
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-10, 30, 8, 15);
        ctx.fillRect(2, 30, 8, 15);
        
        ctx.restore();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(this.x - 20, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

const upgradesDatabase = [
    {
        id: 'daily-standup',
        name: 'Daily Standup',
        icon: '☕',
        description: 'Comunicação diária melhora o alinhamento!',
        maxLevel: 14,
        baseCost: 10,
        effect: (level) => { 
            const bonus = logisticCurve(level, 14, 0.6, 7) * 8;
            game.upgrades.powerBonus = (game.upgrades.powerBonus || 0) + bonus; 
        },
        getDescription: (level) => {
            const bonus = logisticCurve(level, 14, 0.6, 7) * 8;
            return `+${bonus.toFixed(1)} Força Base (Nível ${level}/14)`;
        }
    },
    {
        id: 'sprint-planning',
        name: 'Sprint Planning',
        icon: '📋',
        description: 'Planejamento eficiente aumenta o desempenho!',
        maxLevel: 14,
        baseCost: 15,
        effect: (level) => { 
            const multiplier = 1 + (logisticCurve(level, 14, 0.5, 7) * 0.5);
            game.upgrades.powerMultiplier = (game.upgrades.powerMultiplier || 1) * multiplier; 
        },
        getDescription: (level) => {
            const bonus = logisticCurve(level, 14, 0.5, 7) * 50;
            return `+${bonus.toFixed(0)}% na Força (Nível ${level}/14)`;
        }
    },
    {
        id: 'pair-programming',
        name: 'Pair Programming',
        icon: '👥',
        description: 'Dois pensam melhor que um!',
        maxLevel: 14,
        baseCost: 12,
        effect: (level) => { 
            const reduction = logisticCurve(level, 14, 0.5, 7) * 0.25;
            game.upgrades.gravityReduction = (game.upgrades.gravityReduction || 0) + reduction; 
        },
        getDescription: (level) => {
            const reduction = logisticCurve(level, 14, 0.5, 7) * 25;
            return `Reduz gravidade em ${reduction.toFixed(0)}% (Nível ${level}/14)`;
        }
    },
    {
        id: 'retrospective',
        name: 'Sprint Retrospective',
        icon: '🔄',
        description: 'Aprender com erros!',
        maxLevel: 14,
        baseCost: 20,
        effect: (level) => { 
            const timeBonus = logisticCurve(level, 14, 0.5, 7) * 30;
            game.timeLeft += timeBonus; 
        },
        getDescription: (level) => {
            const timeBonus = logisticCurve(level, 14, 0.5, 7) * 30;
            return `+${timeBonus.toFixed(0)} segundos no timer (Nível ${level}/14)`;
        }
    },
    {
        id: 'continuous-integration',
        name: 'Continuous Integration',
        icon: '⚙️',
        description: 'Integração contínua reduz atrito!',
        maxLevel: 14,
        baseCost: 25,
        effect: (level) => { 
            const dragReduction = logisticCurve(level, 14, 0.5, 7) * 0.015;
            game.upgrades.dragReduction = (game.upgrades.dragReduction || 0) + dragReduction; 
        },
        getDescription: (level) => {
            const dragReduction = logisticCurve(level, 14, 0.5, 7) * 1.5;
            return `-${dragReduction.toFixed(1)}% de arrasto aerodinâmico (Nível ${level}/14)`;
        }
    },
    {
        id: 'mvp',
        name: 'MVP First',
        icon: '🎯',
        description: 'Foco no essencial!',
        maxLevel: 14,
        baseCost: 30,
        effect: (level) => { 
            const slowdown = 1 - (logisticCurve(level, 14, 0.5, 7) * 0.4);
            game.upgrades.angleSlowdown = slowdown; 
        },
        getDescription: (level) => {
            const improvement = logisticCurve(level, 14, 0.5, 7) * 40;
            return `Ângulo ótimo dura ${improvement.toFixed(0)}% mais tempo (Nível ${level}/14)`;
        }
    },
    {
        id: 'refactoring',
        name: 'Code Refactoring',
        icon: '🔧',
        description: 'Código limpo voa mais longe!',
        maxLevel: 14,
        baseCost: 35,
        effect: (level) => { 
            const multiplier = 1 + (logisticCurve(level, 14, 0.5, 7) * 0.6);
            game.upgrades.powerMultiplier = (game.upgrades.powerMultiplier || 1) * multiplier; 
        },
        getDescription: (level) => {
            const bonus = logisticCurve(level, 14, 0.5, 7) * 60;
            return `+${bonus.toFixed(0)}% na força (Nível ${level}/14)`;
        }
    },
    {
        id: 'user-story',
        name: 'User Stories',
        icon: '📖',
        description: 'Entender o usuário é crucial!',
        maxLevel: 14,
        baseCost: 18,
        effect: (level) => { 
            const bonus = logisticCurve(level, 14, 0.6, 7) * 12;
            game.upgrades.powerBonus = (game.upgrades.powerBonus || 0) + bonus; 
        },
        getDescription: (level) => {
            const bonus = logisticCurve(level, 14, 0.6, 7) * 12;
            return `+${bonus.toFixed(1)} Força Base (Nível ${level}/14)`;
        }
    },
    {
        id: 'scrum-master',
        name: 'Scrum Master',
        icon: '🎓',
        description: 'Facilitador experiente!',
        maxLevel: 14,
        baseCost: 40,
        effect: (level) => { 
            const multiplier = 1 + (logisticCurve(level, 14, 0.5, 7) * 1.5);
            game.upgrades.pointsMultiplier = (game.upgrades.pointsMultiplier || 1) * multiplier; 
        },
        getDescription: (level) => {
            const bonus = logisticCurve(level, 14, 0.5, 7) * 150;
            return `Pontos de Sprint +${bonus.toFixed(0)}% (Nível ${level}/14)`;
        }
    },
    {
        id: 'definition-done',
        name: 'Definition of Done',
        icon: '✅',
        description: 'Clareza nos critérios!',
        maxLevel: 14,
        baseCost: 50,
        effect: (level) => { 
            const reduction = logisticCurve(level, 14, 0.5, 7) * 15000;
            game.finishDistance = Math.max(10000, 10000 - reduction); 
            updateFinishLine(); 
        },
        getDescription: (level) => {
            const reduction = logisticCurve(level, 14, 0.5, 7) * 15000;
            return `Meta -${reduction.toFixed(0)}m (Nível ${level}/14)`;
        }
    },
    {
        id: 'velocity',
        name: 'Team Velocity',
        icon: '⚡',
        description: 'Time em alta performance!',
        maxLevel: 14,
        baseCost: 45,
        effect: (level) => { 
            const multiplier = 1 + (logisticCurve(level, 14, 0.5, 7) * 0.8);
            game.upgrades.powerMultiplier = (game.upgrades.powerMultiplier || 1) * multiplier; 
        },
        getDescription: (level) => {
            const bonus = logisticCurve(level, 14, 0.5, 7) * 80;
            return `+${bonus.toFixed(0)}% força (Nível ${level}/14)`;
        }
    },
    {
        id: 'burndown',
        name: 'Burndown Chart',
        icon: '📉',
        description: 'Visibilidade do progresso!',
        maxLevel: 14,
        baseCost: 38,
        effect: (level) => { 
            const timeBonus = logisticCurve(level, 14, 0.5, 7) * 45;
            game.timeLeft += timeBonus; 
        },
        getDescription: (level) => {
            const timeBonus = logisticCurve(level, 14, 0.5, 7) * 45;
            return `+${timeBonus.toFixed(0)} segundos (Nível ${level}/14)`;
        }
    }
];

// Elementos DOM
const launchButton = document.getElementById('launch-button');
const powerFill = document.getElementById('power-fill');
const powerValue = document.getElementById('power-value');
const angleValue = document.getElementById('angle-value');
const distanceDisplay = document.getElementById('distance');
const bestDistanceDisplay = document.getElementById('best-distance');
const timerDisplay = document.getElementById('timer');
const pointsDisplay = document.getElementById('points');
const modalPoints = document.getElementById('modal-points');
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'characterData' || mutation.type === 'childList') {
            modalPoints.textContent = pointsDisplay.textContent;
        }
    });
});

observer.observe(pointsDisplay, {
    characterData: true,
    childList: true,
    subtree: true
});
const upgradeModal = document.getElementById('upgrade-modal');
const gameoverModal = document.getElementById('gameover-modal');
const continueButton = document.getElementById('continue-button');
const restartButton = document.getElementById('restart-button');
const hud = document.querySelector('.hud');
const controlPanel = document.querySelector('.control-panel');
const finishLine = document.getElementById('finish-line');
const punishmentNotification = document.getElementById('punishment-notification');
const punishmentText = document.getElementById('punishment-text');

// Funções auxiliares
function interpolateColor(color1, color2, factor) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);
    return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function formatDistance(meters) {
    return meters + 'm';
}

function getUpgradeCost(upgrade, currentLevel) {
    return Math.floor(upgrade.baseCost * Math.pow(1.5, currentLevel));
}

function updateFinishLine() {
    document.getElementById('finish-distance').textContent = formatDistance(game.finishDistance);
}

// Funções de controle
function startCharging() {
    if (game.isLaunched || game.gameOver || game.isPaused) return;
    if (game.activePunishment && game.activePunishment.type === 'lockLaunch') {
        return;
    }
    game.isCharging = true;
    launchButton.classList.add('charging');
}

function launch() {
    if (!game.isCharging || game.isLaunched || game.gameOver) return;
    if (game.activePunishment && game.activePunishment.type === 'lockLaunch') {
        return;
    }
    
    game.isCharging = false;
    launchButton.classList.remove('charging');
    
    let finalPower = game.power + (game.upgrades.powerBonus || 0);
    finalPower *= (game.upgrades.powerMultiplier || 1);
    
    if (game.activePunishment && game.activePunishment.type === 'powerReduction') {
        finalPower *= game.activePunishment.multiplier;
    }
    
    game.projectile = new Projectile(finalPower, game.angle);
    
    if (game.upgrades.gravityReduction) {
        game.projectile.gravity *= (1 - game.upgrades.gravityReduction);
    }
    if (game.activePunishment && game.activePunishment.type === 'gravityIncrease') {
        game.projectile.gravity *= game.activePunishment.multiplier;
    }
    
    if (game.upgrades.dragReduction) {
        game.projectile.drag = Math.min(0.995, game.projectile.drag + game.upgrades.dragReduction);
    }
    if (game.activePunishment && game.activePunishment.type === 'dragIncrease') {
        game.projectile.drag = Math.max(0.95, game.projectile.drag - game.activePunishment.multiplier * 0.01);
    }
    
    if (game.activePunishment && game.activePunishment.type === 'halfDistance' && game.activePunishment.remaining > 0) {
        game.projectile.halfDistanceFlag = true;
    }
    
    game.isLaunched = true;
    game.launchCount++;
    
    if (game.launchCount === 1 && !game.milestoneActive) {
        game.milestoneActive = true;
    }
    
    hud.style.display = 'none';
    controlPanel.style.display = 'none';
    finishLine.style.display = 'none';
}

function updatePowerAndAngle() {
    if (!game.isCharging) return;
    
    if (game.activePunishment && game.activePunishment.type === 'randomPower') {
        game.power = Math.random() * 10;
        powerFill.style.height = (game.power * 10) + '%';
        powerValue.textContent = Math.round(game.power);
    } else {
        const powerProgress = game.power / 10;
        const logisticProgress = logisticCurve(powerProgress * 14, 14, 1.2, 7);
        const powerIncrement = 0.15 + (0.35 * (1 - logisticProgress));
        
        game.power += powerIncrement * game.powerDirection;
        if (game.power >= 10) {
            game.power = 10;
            game.powerDirection = -1;
        } else if (game.power <= 0) {
            game.power = 0;
            game.powerDirection = 1;
        }
        
        powerFill.style.height = (game.power * 10) + '%';
        powerValue.textContent = Math.round(game.power);
    }
    
    if (game.activePunishment && game.activePunishment.type === 'fixedAngle') {
        game.angle = game.activePunishment.angle;
    } else {
        const speedMultiplier = (game.activePunishment && game.activePunishment.type === 'fastOscillation') 
            ? game.activePunishment.multiplier 
            : 1;
        
        const angleSpeed = 1 * (game.upgrades.angleSlowdown || 1) * speedMultiplier;
        game.angle += angleSpeed * game.angleDirection;
        if (game.angle >= 60) {
            game.angle = 60;
            game.angleDirection = -1;
        } else if (game.angle <= 10) {
            game.angle = 10;
            game.angleDirection = 1;
        }
    }
    
    angleValue.textContent = Math.round(game.angle) + '°';
}

function drawScene() {
    game.dayNightCycle.time += 1/60;
    const cycleProgress = (game.dayNightCycle.time % game.dayNightCycle.cycleDuration) / game.dayNightCycle.cycleDuration;
    game.dayNightCycle.isDay = cycleProgress < 0.5;
    
    let skyColor1, skyColor2, groundColor, grassColor;
    
    if (game.dayNightCycle.isDay) {
        skyColor1 = '#87CEEB';
        skyColor2 = '#E0F6FF';
        groundColor = '#8B7355';
        grassColor = '#90EE90';
    } else {
        skyColor1 = '#0a1128';
        skyColor2 = '#1a1a3e';
        groundColor = '#4a3f35';
        grassColor = '#2d5016';
    }
    
    const transitionZone = 0.1;
    if (cycleProgress > 0.5 - transitionZone && cycleProgress < 0.5 + transitionZone) {
        const transProgress = (cycleProgress - (0.5 - transitionZone)) / (transitionZone * 2);
        if (game.dayNightCycle.isDay) {
            skyColor1 = interpolateColor('#87CEEB', '#0a1128', transProgress);
            skyColor2 = interpolateColor('#E0F6FF', '#1a1a3e', transProgress);
            groundColor = interpolateColor('#8B7355', '#4a3f35', transProgress);
            grassColor = interpolateColor('#90EE90', '#2d5016', transProgress);
        }
    }
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, skyColor1);
    gradient.addColorStop(1, skyColor2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!game.dayNightCycle.isDay) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 100; i++) {
            const starX = (i * 173) % canvas.width;
            const starY = (i * 257) % (canvas.height * 0.6);
            ctx.fillRect(starX, starY, 2, 2);
        }
        
        ctx.fillStyle = '#f0e68c';
        ctx.beginPath();
        ctx.arc(canvas.width - 150, 100, 40, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#FFD700';
        ctx.beginPath();
        ctx.arc(canvas.width - 150, 100, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    
    const groundLevel = canvas.height - 100;
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, groundLevel, canvas.width, 100);
    
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, groundLevel, canvas.width, 10);
    
    ctx.save();
    ctx.translate(-game.camera.x, -game.camera.y);
    
    const viewLeft = game.camera.x;
    const viewRight = game.camera.x + canvas.width;
    const startDistance = Math.max(0, Math.floor((viewLeft - 200) / pixelsPorMetro / 1000) * 1000);
    const endDistance = Math.ceil((viewRight - 200) / pixelsPorMetro / 1000) * 1000;
    
    ctx.fillStyle = game.dayNightCycle.isDay ? '#654321' : '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    
    const finishPixelX = 200 + (game.finishDistance * pixelsPorMetro);
    
    for (let i = startDistance; i <= Math.min(endDistance, game.finishDistance); i += 1000) {
        const x = 200 + (i * pixelsPorMetro);
        
        ctx.fillStyle = game.dayNightCycle.isDay ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(x - 3, groundLevel - 50, 6, 40);
        
        ctx.fillStyle = game.dayNightCycle.isDay ? '#000000' : '#ffffff';
        ctx.fillText(i + 'm', x, groundLevel - 55);
    }
    
    for (let i = Math.max(100, startDistance); i <= Math.min(endDistance, game.finishDistance); i += 100) {
        if (i % 1000 !== 0) {
            const x = 200 + (i * pixelsPorMetro);
            if (x >= viewLeft && x <= viewRight) {
                ctx.fillStyle = game.dayNightCycle.isDay ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(x - 2, groundLevel - 25, 4, 15);
            }
        }
    }
    
    game.milestones.forEach((milestone, index) => {
        const milestoneX = 200 + (milestone.distance * pixelsPorMetro);
        
        if (milestoneX >= viewLeft - 100 && milestoneX <= viewRight + 100) {
            let color, borderColor;
            if (milestone.completed) {
                color = 'rgba(0, 255, 0, 0.6)';
                borderColor = '#00ff00';
            } else if (index === game.currentMilestoneIndex && game.milestoneActive) {
                color = 'rgba(255, 215, 0, 0.6)';
                borderColor = '#ffd700';
            } else {
                color = 'rgba(255, 165, 0, 0.3)';
                borderColor = '#ffa500';
            }
            
            ctx.fillStyle = color;
            ctx.fillRect(milestoneX - 4, groundLevel - 70, 8, 60);
            
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(milestoneX - 4, groundLevel - 70, 8, 60);
            
            ctx.fillStyle = borderColor;
            ctx.font = 'bold 16px Arial';
            ctx.fillText(`M${index + 1}`, milestoneX, groundLevel - 75);
            ctx.font = 'bold 12px Arial';
            ctx.fillText(milestone.distance + 'm', milestoneX, groundLevel + 15);
        }
    });
    
    ctx.strokeStyle = game.dayNightCycle.isDay ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(200, canvas.height / 2);
    ctx.lineTo(finishPixelX + 500, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    const finishX = finishPixelX;
    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.fillRect(finishX - 20, 0, 40, canvas.height);
    
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(finishX - 5, 50, 10, 200);
    
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            ctx.fillStyle = (row + col) % 2 === 0 ? '#000' : '#fff';
            ctx.fillRect(finishX + 5 + col * 15, 50 + row * 15, 15, 15);
        }
    }
    
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('META', finishX, 35);
    ctx.font = 'bold 24px Arial';
    ctx.fillText(game.finishDistance + 'm', finishX, groundLevel - 50);
    
    ctx.restore();
}

function handleProjectileUpdate() {
    const stillFlying = game.projectile.update();
    let distance = Math.round(game.projectile.distanceTraveled);
    
    if (game.projectile.halfDistanceFlag) {
        distance = Math.floor(distance * 0.5);
    }
    
    game.distance = distance;
    
    game.camera.targetX = Math.max(0, game.projectile.x - canvas.width / 3);
    game.camera.targetY = Math.max(0, Math.min(game.projectile.y - canvas.height / 2, 200));
    
    game.camera.x += (game.camera.targetX - game.camera.x) * game.camera.smoothing;
    game.camera.y += (game.camera.targetY - game.camera.y) * game.camera.smoothing;
    
    if (!stillFlying) {
        game.isLaunched = false;
        
        game.camera.x = 0;
        game.camera.targetX = 0;
        game.camera.y = 0;
        game.camera.targetY = 0;
        
        hud.style.display = 'flex';
        controlPanel.style.display = 'flex';
        finishLine.style.display = 'block';
        
        distanceDisplay.textContent = formatDistance(game.distance);
        
        if (game.distance > game.bestDistance) {
            game.bestDistance = game.distance;
            bestDistanceDisplay.textContent = formatDistance(game.bestDistance);
        }
        
        let earnedPoints = Math.floor(game.distance / 100) * (game.upgrades.pointsMultiplier || 1);
        if (game.activePunishment && game.activePunishment.type === 'noPoints' && game.activePunishment.remaining > 0) {
            game.activePunishment.remaining--;
            earnedPoints = 0;
            if (game.activePunishment.remaining <= 0) {
                game.activePunishment = null;
            }
        }
        
        if (game.activePunishment && game.activePunishment.type === 'halfDistance' && game.activePunishment.remaining > 0) {
            game.activePunishment.remaining--;
            if (game.activePunishment.remaining <= 0) {
                game.activePunishment = null;
            }
        }
        
        game.points += earnedPoints;
        pointsDisplay.textContent = Math.floor(game.points);
        
        if (game.distance >= game.finishDistance) {
            endGame(true);
        } else {
            showUpgradeModal();
        }
    }
}

function checkMilestones(deltaTime) {
    if (game.currentMilestoneIndex >= game.milestones.length) {
        return;
    }
    
    const currentMilestone = game.milestones[game.currentMilestoneIndex];
    
    if (!game.milestoneActive || currentMilestone.checked) {
        return;
    }
    
    currentMilestone.timeRemaining -= deltaTime;
    
    const milestoneTimerDisplay = document.getElementById('milestone-timer');
    const minutes = Math.floor(currentMilestone.timeRemaining / 60);
    const seconds = Math.floor(currentMilestone.timeRemaining % 60);
    milestoneTimerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const milestoneInfoDisplay = document.getElementById('milestone-info');
    milestoneInfoDisplay.textContent = `Meta ${game.currentMilestoneIndex + 1}: ${currentMilestone.distance}m`;
    
     if (game.bestDistance >= currentMilestone.distance) {
        currentMilestone.completed = true;
        currentMilestone.checked = true;
        game.milestoneActive = false;
        
        // ADICIONAR AQUI: Mostrar celebração
        showMilestoneCelebration(game.currentMilestoneIndex);
        
        game.currentMilestoneIndex++;
        
        if (game.currentMilestoneIndex < game.milestones.length) {
            const nextMilestone = game.milestones[game.currentMilestoneIndex];
            nextMilestone.timeRemaining = nextMilestone.timeLimit;
            game.milestoneActive = true;
        }
    } else if (currentMilestone.timeRemaining <= 0) {
        currentMilestone.completed = false;
        currentMilestone.checked = true;
        game.milestoneActive = false;
        applyRandomPunishment(currentMilestone);
        game.currentMilestoneIndex++;
        
        if (game.currentMilestoneIndex < game.milestones.length) {
            const nextMilestone = game.milestones[game.currentMilestoneIndex];
            nextMilestone.timeRemaining = nextMilestone.timeLimit;
            game.milestoneActive = true;
        }
    }
}

function applyRandomPunishment(milestone) {
    const availablePunishments = game.punishments.filter(p => !game.usedPunishments.includes(p.name));
    
    if (availablePunishments.length === 0) {
        game.usedPunishments = [];
        availablePunishments.push(...game.punishments);
    }
    
    const randomIndex = Math.floor(Math.random() * availablePunishments.length);
    const punishment = availablePunishments[randomIndex];
    
    game.usedPunishments.push(punishment.name);
    
    showPunishmentNotification(milestone, punishment);
    punishment.effect();
}

function showPunishmentNotification(milestone, punishment) {
    punishmentText.innerHTML = `
        <div style="font-size: 24px; font-weight: bold; color: #e74c3c; margin-bottom: 10px;">
            ⚠️ META NÃO ATINGIDA! ⚠️
        </div>
        <div style="font-size: 18px; margin-bottom: 15px;">
            ${formatDistance(milestone.distance)} em ${Math.floor(milestone.timeLimit / 60)}:${(milestone.timeLimit % 60).toString().padStart(2, '0')} não concluída!
        </div>
        <div style="font-size: 22px; font-weight: bold; color: #ff6b6b; margin-bottom: 10px;">
            ${punishment.name}
        </div>
        <div style="font-size: 16px;">
            ${punishment.description}
        </div>
    `;
    
    punishmentNotification.style.display = 'block';
    
    setTimeout(() => {
        punishmentNotification.style.display = 'none';
    }, 5000);
}

function updateActivePunishments() {
    if (game.activePunishment) {
        if (game.activePunishment.duration !== undefined && game.activePunishment.startTime !== undefined) {
            const elapsed = game.activePunishment.startTime - game.timeLeft;
            if (elapsed >= game.activePunishment.duration) {
                game.activePunishment = null;
            }
        }
    }
}

function showUpgradeModal() {
    game.isPaused = true;
    const upgradesList = document.getElementById('upgrades-list');
    const modalDistance = document.getElementById('modal-distance');
    const resultText = document.getElementById('result-text');
    
    modalDistance.textContent = formatDistance(game.distance);
    resultText.textContent = game.distance >= game.finishDistance ? 
        '🎉 Projeto Concluído!' : 
        '📊 Projeto em andamento...';
    
    upgradesList.innerHTML = '';
    
    const upgradesBlocked = game.activePunishment && game.activePunishment.type === 'noUpgrades';
    
    if (upgradesBlocked) {
        const blockedMessage = document.createElement('div');
        blockedMessage.style.cssText = 'grid-column: 1 / -1; text-align: center; color: #ff6b6b; font-size: 18px; font-weight: bold; padding: 20px; background: rgba(255, 107, 107, 0.2); border-radius: 10px; margin-bottom: 20px;';
        blockedMessage.textContent = '🔒 Licença de Software Expirou! Upgrades bloqueados temporariamente.';
        upgradesList.appendChild(blockedMessage);
    }
    
    upgradesDatabase.forEach(upgrade => {
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        
        const currentLevel = game.upgradeLevels[upgrade.id] || 0;
        const isMaxLevel = currentLevel >= upgrade.maxLevel;
        const cost = getUpgradeCost(upgrade, currentLevel);
        const canAfford = game.points >= cost;
        
        if (currentLevel === upgrade.maxLevel) {
            card.classList.add('max-level');
            card.style.background = 'linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%)';
            card.style.border = '3px solid #ff8c00';
            card.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.8)';
            card.style.animation = 'goldenGlow 2s infinite';
        } else if (currentLevel > 0) {
            card.classList.add('purchased');
        } else if (!canAfford || upgradesBlocked) {
            card.classList.add('locked');
        }
        
        const description = upgrade.getDescription ? upgrade.getDescription(currentLevel + 1) : upgrade.description;
        
        card.innerHTML = `
            <div class="upgrade-icon">${upgrade.icon}</div>
            <div class="upgrade-title">${upgrade.name}</div>
            <div class="upgrade-description">${description}</div>
            <div class="upgrade-cost">${isMaxLevel ? '⭐ MÁXIMO' : '💰 ' + cost + ' SP'}</div>
            ${currentLevel > 0 ? `<div class="upgrade-badge">NÍVEL ${currentLevel}</div>` : ''}
        `;
        
        if (!isMaxLevel && canAfford && !upgradesBlocked) {
            card.addEventListener('click', () => purchaseUpgrade(upgrade, cost));
        }
        
        upgradesList.appendChild(card);
    });
    
    upgradeModal.style.display = 'block';
}

function purchaseUpgrade(upgrade, cost) {
    const currentLevel = game.upgradeLevels[upgrade.id] || 0;
    
    if (game.activePunishment && game.activePunishment.type === 'noUpgrades') {
        return;
    }
    
    if (game.points >= cost && currentLevel < upgrade.maxLevel) {
        game.points -= cost;
        pointsDisplay.textContent = Math.floor(game.points);
        game.upgradeLevels[upgrade.id] = currentLevel + 1;
        
        if (currentLevel === 0) {
            game.upgrades[upgrade.id] = true;
        }
        
        upgrade.effect(game.upgradeLevels[upgrade.id]);
        
        showUpgradeModal();
    }
}

function closeUpgradeModal() {
    upgradeModal.style.display = 'none';
    game.isPaused = false;
    game.projectile = null;
    game.distance = 0;
    distanceDisplay.textContent = '0m';
}

function endGame(won) {
    game.gameOver = true;
    const title = document.getElementById('gameover-title');
    const message = document.getElementById('gameover-message');
    
    if (won) {
        title.textContent = '🎉 Projeto Entregue com Sucesso!';
        message.innerHTML = `
            <strong>Parabéns!</strong><br>
            Você concluiu o projeto a tempo!<br><br>
            🏆 Melhor Distância: ${formatDistance(game.bestDistance)}<br>
            💰 Total de Sprint Points: ${Math.floor(game.points)}<br>
            ⏱️ Tempo Restante: ${Math.floor(game.timeLeft / 60)}:${(game.timeLeft % 60).toString().padStart(2, '0')}
        `;
    } else {
        title.textContent = '⏰ Deadline Atingido!';
        message.innerHTML = `
            <strong>O prazo acabou!</strong><br>
            O projeto não foi concluído a tempo.<br><br>
            📊 Melhor Tentativa: ${formatDistance(game.bestDistance)} de ${formatDistance(game.finishDistance)}<br>
            💰 Sprint Points Ganhos: ${Math.floor(game.points)}<br><br>
            <em>Lembre-se: Na metodologia ágil, aprendemos com cada sprint!</em>
        `;
    }
    
    gameoverModal.style.display = 'block';
}

function restartGame() {
    game.power = 0;
    game.angle = 45;
    game.powerDirection = 1;
    game.angleDirection = 1;
    game.isCharging = false;
    game.isLaunched = false;
    game.distance = 0;
    game.bestDistance = 0;
    game.points = 0;
    game.timeLeft = 600;
    game.finishDistance = 10000;
    game.projectile = null;
    game.upgrades = {};
    game.upgradeLevels = {};
    game.gameOver = false;
    game.isPaused = false;
    game.camera.x = 0;
    game.camera.y = 0;
    game.camera.targetX = 0;
    game.camera.targetY = 0;
    game.dayNightCycle.time = 0;
    game.dayNightCycle.isDay = true;
    game.currentMilestoneIndex = 0;
    game.milestones = [
        { distance: 1500, timeLimit: 60, completed: false, checked: false, timeRemaining: 60 },
        { distance: 2500, timeLimit: 90, completed: false, checked: false, timeRemaining: 90 },
        { distance: 4000, timeLimit: 120, completed: false, checked: false, timeRemaining: 120 },
        { distance: 5500, timeLimit: 120, completed: false, checked: false, timeRemaining: 120 },
        { distance: 7000, timeLimit: 120, completed: false, checked: false, timeRemaining: 120 },
        { distance: 8000, timeLimit: 90, completed: false, checked: false, timeRemaining: 90 },
        { distance: 9000, timeLimit: 60, completed: false, checked: false, timeRemaining: 60 },
        { distance: 10000, timeLimit: 60, completed: false, checked: false, timeRemaining: 60 }
    ];
    game.milestoneActive = false;
    game.usedPunishments = [];
    game.activePunishment = null;
    game.launchCount = 0;
    
    distanceDisplay.textContent = '0m';
    bestDistanceDisplay.textContent = '0m';
    pointsDisplay.textContent = '0';
    timerDisplay.textContent = '10:00';
    timerDisplay.style.color = '#ffd700';
    timerDisplay.style.animation = 'none';
    punishmentNotification.style.display = 'none';
    updateFinishLine();
    
    hud.style.display = 'flex';
    controlPanel.style.display = 'flex';
    finishLine.style.display = 'block';
    
    gameoverModal.style.display = 'none';
}

// Event Listeners
launchButton.addEventListener('mousedown', startCharging);
launchButton.addEventListener('mouseup', launch);
launchButton.addEventListener('touchstart', (e) => { e.preventDefault(); startCharging(); });
launchButton.addEventListener('touchend', (e) => { e.preventDefault(); launch(); });
continueButton.addEventListener('click', closeUpgradeModal);
restartButton.addEventListener('click', restartGame);

// Loop do jogo
let lastTime = Date.now();
function gameLoop() {
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    drawScene();

    if (game.gameOver) {
        requestAnimationFrame(gameLoop);
        return;
    }

    if (!game.isPaused) {
        let timeMultiplier = 1;
        if (game.activePunishment && game.activePunishment.type === 'timerSpeed') {
            timeMultiplier = game.activePunishment.multiplier;
        }
        
        game.timeLeft -= deltaTime * timeMultiplier;
        if (game.timeLeft <= 0) {
            game.timeLeft = 0;
            endGame(false);
        }

        const minutes = Math.floor(game.timeLeft / 60);
        const seconds = Math.floor(game.timeLeft % 60);
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        checkMilestones(deltaTime);
        updateActivePunishments();
    }
    
    if (game.isCharging) {
        updatePowerAndAngle();
    }
    
    if (game.isLaunched && game.projectile) {
        handleProjectileUpdate();
        
        if (game.projectile) {
            ctx.save();
            ctx.translate(-game.camera.x, -game.camera.y);
            game.projectile.draw();
            ctx.restore();
        }
    }
    
    if (game.isCharging && !game.isLaunched) {
        ctx.save();
        ctx.translate(200 - game.camera.x, canvas.height / 2 - game.camera.y);
        ctx.rotate(-game.angle * Math.PI / 180);
        ctx.strokeStyle = 'rgba(107, 207, 127, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(100, 0);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(107, 207, 127, 0.8)';
        ctx.beginPath();
        ctx.moveTo(100, 0);
        ctx.lineTo(90, -5);
        ctx.lineTo(90, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    
    requestAnimationFrame(gameLoop);
}

 const milestoneRewards = [
    {
        distance: 1500,
        rewards: [
            { icon: '💰', text: '+50 Sprint Points', value: 50, type: 'points' },
            { icon: '⏱️', text: '+15 segundos', value: 15, type: 'time' },
            { icon: '🎯', text: 'Primeiro Marco!', value: null, type: 'badge' }
        ]
    },
    {
        distance: 2500,
        rewards: [
            { icon: '💰', text: '+100 Sprint Points', value: 100, type: 'points' },
            { icon: '⏱️', text: '+20 segundos', value: 20, type: 'time' },
            { icon: '⚡', text: '+5% Força Permanente', value: 1.05, type: 'powerBoost' }
        ]
    },
    {
        distance: 4000,
        rewards: [
            { icon: '💰', text: '+150 Sprint Points', value: 150, type: 'points' },
            { icon: '⏱️', text: '+25 segundos', value: 25, type: 'time' },
            { icon: '🎯', text: 'Meio do Caminho!', value: null, type: 'badge' }
        ]
    },
    {
        distance: 5500,
        rewards: [
            { icon: '💰', text: '+200 Sprint Points', value: 200, type: 'points' },
            { icon: '⚡', text: '+10% Força Permanente', value: 1.10, type: 'powerBoost' },
            { icon: '🔥', text: 'Streak de Sucesso!', value: null, type: 'badge' }
        ]
    },
    {
        distance: 7000,
        rewards: [
            { icon: '💰', text: '+250 Sprint Points', value: 250, type: 'points' },
            { icon: '⏱️', text: '+30 segundos', value: 30, type: 'time' },
            { icon: '🌟', text: 'Veterano Ágil', value: null, type: 'badge' }
        ]
    },
    {
        distance: 8000,
        rewards: [
            { icon: '💰', text: '+300 Sprint Points', value: 300, type: 'points' },
            { icon: '⚡', text: '+15% Força Permanente', value: 1.15, type: 'powerBoost' },
            { icon: '🏆', text: 'Quase Lá!', value: null, type: 'badge' }
        ]
    },
    {
        distance: 9000,
        rewards: [
            { icon: '💰', text: '+400 Sprint Points', value: 400, type: 'points' },
            { icon: '⏱️', text: '+40 segundos', value: 40, type: 'time' },
            { icon: '⚡', text: '+20% Força Permanente', value: 1.20, type: 'powerBoost' }
        ]
    },
    {
        distance: 10000,
        rewards: [
            { icon: '💰', text: '+500 Sprint Points', value: 400, type: 'points' },
            { icon: '⏱️', text: '+60 segundos', value: 40, type: 'time' },
            { icon: '⚡', text: '+20% Força Permanente', value: 1.20, type: 'powerBoost' }
        ]
    }
];

function showMilestoneCelebration(milestoneIndex) {
const milestone = game.milestones[milestoneIndex];
const rewards = milestoneRewards[milestoneIndex];

if (!rewards) return;

// Pausar o jogo
game.isPaused = true;

// Aplicar recompensas
rewards.rewards.forEach(reward => {
    switch(reward.type) {
        case 'points':
            game.points += reward.value;
            pointsDisplay.textContent = Math.floor(game.points);
            break;
        case 'time':
            game.timeLeft += reward.value;
            break;
        case 'powerBoost':
            if (!game.upgrades.milestoneBonus) {
                game.upgrades.milestoneBonus = 1;
            }
            game.upgrades.milestoneBonus *= reward.value;
            break;
    }
});

// Atualizar UI do popup
const celebrationTitle = document.getElementById('celebration-title');
const celebrationMessage = document.getElementById('celebration-message');
const celebrationRewards = document.getElementById('celebration-rewards');
const celebrationProgress = document.getElementById('celebration-progress');
const overlay = document.getElementById('milestone-overlay');
const celebration = document.getElementById('milestone-celebration');

celebrationTitle.textContent = '🎉 META ATINGIDA! 🎉';
celebrationMessage.textContent = `Meta ${milestoneIndex + 1}: ${milestone.distance}m concluída em tempo!`;

// Criar lista de recompensas
celebrationRewards.innerHTML = '';
rewards.rewards.forEach(reward => {
    const rewardItem = document.createElement('div');
    rewardItem.className = 'reward-item';
    rewardItem.innerHTML = `
        <span class="reward-icon">${reward.icon}</span>
        <span>${reward.text}</span>
    `;
    celebrationRewards.appendChild(rewardItem);
});

// Atualizar barra de progresso
const progressPercent = ((milestoneIndex + 1) / game.milestones.length) * 100;
celebrationProgress.style.width = progressPercent + '%';

// Criar confetes
createConfetti(celebration);

// Mostrar popup
overlay.style.display = 'block';
celebration.style.display = 'block';
}

function createConfetti(container) {
const colors = ['#ffd700', '#ff6b6b', '#6bcf7f', '#667eea', '#ff69b4'];
for (let i = 0; i < 50; i++) {
    setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        container.appendChild(confetti);

        setTimeout(() => confetti.remove(), 3500);
    }, i * 30);
}
}

function closeMilestoneCelebration() {
const overlay = document.getElementById('milestone-overlay');
const celebration = document.getElementById('milestone-celebration');

overlay.style.display = 'none';
celebration.style.display = 'none';

// Despausar o jogo
game.isPaused = false;
}

// Event listener para o botão de fechar
document.getElementById('celebration-close').addEventListener('click', closeMilestoneCelebration);

updateFinishLine();
lastTime = Date.now();
gameLoop();