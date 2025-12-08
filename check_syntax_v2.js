        window.onerror = function (msg, url, lineNo, columnNo, error) {
            alert('Error: ' + msg + '\nLine: ' + lineNo + '\nColumn: ' + columnNo + '\nStack: ' + (error ? error.stack : 'N/A'));
            return false;
        };

        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const TILE_SIZE = 64;
        const MAP_SIZE = 64;

        let player;
        let enemies = [];
        const ENEMY_COUNT = 50;
        let bullets = [];
        let items = [];
        let effects = [];
        let chests = [];
        let currentInventoryTab = 'all';

        // Global Variables for Town System
        let currentMapType = 'town'; // 'town' or 'dungeon'
        let npcs = [];

        class NPC {
            constructor(x, y, type, name, color) {
                this.x = x;
                this.y = y;
                this.type = type; // 'merchant', 'quest'
                this.name = name;
                this.color = color;
                this.interactionRadius = 2.0;
            }

            draw(ctx, screenX, screenY) {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY - 20, 10, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(this.name, screenX, screenY - 40);

                // Interaction prompt
                const dist = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
                if (dist < this.interactionRadius) {
                    ctx.fillStyle = '#ffff00';
                    ctx.fillText("Press 'E'", screenX, screenY - 55);
                }
            }

            interact() {
                if (this.type === 'merchant') {
                    toggleMerchant();
                } else if (this.type === 'quest') {
                    toggleQuest();
                } else if (this.type === 'craftsman') {
                    toggleCrafting();
                }
            }
        }

        function toIso(x, y) {
            return {
                x: (x - y) * TILE_SIZE / 2,
                y: (x + y) * TILE_SIZE / 4
            };
        }

        function isSolid(x, y) {
            let gridX = Math.floor(x);
            let gridY = Math.floor(y);
            if (gridX < 0 || gridX >= MAP_SIZE || gridY < 0 || gridY >= MAP_SIZE) return true;
            return map[gridY][gridX] === 1;
        }

        function generateMap() {
            map = [];
            explored = [];
            npcs = []; // Clear NPCs
            chests = []; // Clear Chests

            if (currentMapType === 'town') {
                // Generate Town (Safe Zone)
                for (let y = 0; y < MAP_SIZE; y++) {
                    let row = [];
                    let expRow = [];
                    for (let x = 0; x < MAP_SIZE; x++) {
                        // Walls on edges
                        if (x === 0 || x === MAP_SIZE - 1 || y === 0 || y === MAP_SIZE - 1) {
                            row.push(1);
                        } else {
                            row.push(0); // Open floor
                        }
                        expRow.push(true); // Town is fully explored
                    }
                    map.push(row);
                    explored.push(expRow);
                }

                // Spawn Player in Center
                player.x = MAP_SIZE / 2;
                player.y = MAP_SIZE / 2;

                // Spawn NPCs
                npcs.push(new NPC(player.x - 5, player.y - 2, 'merchant', 'Merchant', '#00ff00'));
                npcs.push(new NPC(player.x - 5, player.y - 2, 'merchant', 'Merchant', '#00ff00'));
                npcs.push(new NPC(player.x + 5, player.y - 2, 'quest', 'Quest Giver', '#ffff00'));
                npcs.push(new NPC(player.x, player.y - 5, 'craftsman', 'Craftsman', '#ff8800'));
                // Spawn Portal to Dungeon
                portal = { x: player.x, y: player.y - 8, active: true }; // Always active in town

            } else {
                // Generate Dungeon
                for (let y = 0; y < MAP_SIZE; y++) {
                    let row = [];
                    let expRow = [];
                    for (let x = 0; x < MAP_SIZE; x++) {
                        if (x === 0 || x === MAP_SIZE - 1 || y === 0 || y === MAP_SIZE - 1) {
                            row.push(1);
                        } else {
                            row.push(Math.random() < 0.45 ? 1 : 0);
                        }
                        expRow.push(false);
                    }
                    map.push(row);
                    explored.push(expRow);
                }

                // Cellular Automata
                for (let i = 0; i < 5; i++) {
                    let newMap = JSON.parse(JSON.stringify(map));
                    for (let y = 1; y < MAP_SIZE - 1; y++) {
                        for (let x = 1; x < MAP_SIZE - 1; x++) {
                            let neighbors = 0;
                            for (let dy = -1; dy <= 1; dy++) {
                                for (let dx = -1; dx <= 1; dx++) {
                                    if (map[y + dy][x + dx] === 1) neighbors++;
                                }
                            }
                            if (neighbors > 4) newMap[y][x] = 1;
                            else if (neighbors < 4) newMap[y][x] = 0;
                        }
                    }
                    map = newMap;
                }

                // Ensure connectivity (Simplified)
                let regions = [];
                let visited = Array(MAP_SIZE).fill().map(() => Array(MAP_SIZE).fill(false));

                for (let y = 1; y < MAP_SIZE - 1; y++) {
                    for (let x = 1; x < MAP_SIZE - 1; x++) {
                        if (map[y][x] === 0 && !visited[y][x]) {
                            let region = [];
                            let stack = [{ x, y }];
                            visited[y][x] = true;
                            while (stack.length > 0) {
                                let p = stack.pop();
                                region.push(p);
                                [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
                                    let nx = p.x + dx;
                                    let ny = p.y + dy;
                                    if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE && map[ny][nx] === 0 && !visited[ny][nx]) {
                                        visited[ny][nx] = true;
                                        stack.push({ x: nx, y: ny });
                                    }
                                });
                            }
                            regions.push(region);
                        }
                    }
                }

                if (regions.length > 0) {
                    regions.sort((a, b) => b.length - a.length);
                    for (let i = 1; i < regions.length; i++) {
                        regions[i].forEach(p => map[p.y][p.x] = 1);
                    }
                    let spawn = regions[0][Math.floor(Math.random() * regions[0].length)];
                    player.x = spawn.x;
                    player.y = spawn.y;
                } else {
                    player.x = MAP_SIZE / 2;
                    player.y = MAP_SIZE / 2;
                    map[Math.floor(player.y)][Math.floor(player.x)] = 0;
                }

                spawnPortal();

                // Spawn Chests
                chests = [];
                for (let i = 0; i < 5; i++) {
                    let valid = false;
                    let attempts = 0;
                    while (!valid && attempts < 50) {
                        let x = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
                        let y = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
                        if (map[y][x] === 0 && Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2) > 10) {
                            chests.push({ x, y });
                            valid = true;
                        }
                        attempts++;
                    }
                }
            }
        }

        function spawnPortal() {
            portal = { x: 0, y: 0, active: false };
            if (currentMapType === 'town') return; // Portal already set in generateMap

            let valid = false;
            let attempts = 0;
            while (!valid && attempts < 1000) {
                let x = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
                let y = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
                if (map[y][x] === 0 && Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2) > 20) {
                    portal.x = x;
                    portal.y = y;
                    valid = true;
                }
                attempts++;
            }
            if (!valid) {
                portal.x = player.x;
                portal.y = player.y;
            }
        }

        function resetGame(keepStage = false) {
            if (!keepStage) {
                stage = 1;
                currentMapType = 'town';
            }

            if (!player) player = new Player(10, 10);

            generateMap();
            prerenderMap();

            enemies = [];
            bullets = [];
            items = [];
            effects = [];
            floatingTexts = [];

            if (currentMapType === 'dungeon') {
                // Spawn Enemies only in Dungeon
                for (let i = 0; i < ENEMY_COUNT + stage * 5; i++) {
                    let valid = false;
                    let attempts = 0;
                    while (!valid && attempts < 100) {
                        let x = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
                        let y = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
                        if (map[y][x] === 0 && Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2) > 10) {
                            enemies.push(new Enemy(x, y, stage));
                            valid = true;
                        }
                        attempts++;
                    }
                }
                generateQuest();
            } else {
                // Town Mode
                currentQuest = null;
                document.getElementById('quest-desc').innerText = "Talk to Quest Giver";
                document.getElementById('quest-bar').style.width = '0%';
            }

            updateHUD();
            initSkillBar(); // Fix Skill Icons
            document.getElementById('gameOver').style.display = 'none';
            player.hp = player.stats.maxHp;
        }

        function initSkillBar() {
            // Dynamically set skill icons to avoid encoding issues
            if (player && player.SKILLS) {
                player.SKILLS.forEach((skill, index) => {
                    let id = index + 1;
                    if (index === 5) id = 'space';
                    const slot = document.getElementById(`skill-${id}`);
                    if (slot) {
                        // Keep the key span and cooldown div, just update text node if possible, 
                        // or simpler: rebuild innerHTML
                        const key = slot.querySelector('.skill-key').innerText;
                        slot.innerHTML = `<span class="skill-key">${key}</span>${skill.icon}<div id="cd-${id}" class="skill-cd"></div>`;
                    }
                });
            }
        }
        function update() {
            if (player.hp <= 0) return;

            let dx = 0;
            let dy = 0;

            if (keys['w']) { dx += 1; dy -= 1; }
            if (keys['s']) { dx -= 1; dy += 1; }
            if (keys['a']) { dx -= 1; dy -= 1; }
            if (keys['d']) { dx += 1; dy += 1; }

            player.move(dx, dy, map);

            if (keys[' ']) {
                const initialEnemyCount = enemies.length;
                player.attack(enemies, bullets, effects, items, floatingTexts, spawnItem);
                const killedCount = initialEnemyCount - enemies.length;
                if (killedCount > 0) updateQuest('kill', killedCount);
            }

            if (keys['1']) player.useSkill(0, enemies, effects, items, floatingTexts, bullets, map);
            if (keys['2']) player.useSkill(1, enemies, effects, items, floatingTexts, bullets, map);
            if (keys['3']) player.useSkill(2, enemies, effects, items, floatingTexts, bullets, map);
            if (keys['4']) player.useSkill(3, enemies, effects, items, floatingTexts, bullets, map);
            if (keys['5']) player.useSkill(4, enemies, effects, items, floatingTexts, bullets, map);

            const aimDx = mouseX - canvas.width / 2;
            const aimDy = mouseY - canvas.height / 2;
            player.aimAngle = Math.atan2(aimDy, aimDx);
            player.aimDist = Math.sqrt(aimDx * aimDx + aimDy * aimDy);

            if (mouseDown) {
                if (player.shootTimer <= 0) {
                    player.shoot(mouseX, mouseY, bullets, canvas);
                    player.shootTimer = player.weapon.rate;
                }
            }

            if (keys['c'] && !player.cPressed) {
                toggleStats();
                player.cPressed = true;
            } else if (!keys['c']) {
                player.cPressed = false;
            }

            player.update();

            const initialEnemyCount = enemies.length;
            enemies.forEach(e => e.update(player, map, bullets, floatingTexts, effects, items, spawnItem, enemies));
            enemies = enemies.filter(e => e.hp > 0);
            const killedCount = initialEnemyCount - enemies.length;
            if (killedCount > 0) updateQuest('kill', killedCount);

            bullets.forEach(b => {
                b.x += b.vx;
                b.y += b.vy;
                b.life--;
            });
            bullets = bullets.filter(b => {
                const bx = Math.floor(b.x);
                const by = Math.floor(b.y);
                return b.life > 0 &&
                    bx >= 0 && bx < MAP_SIZE &&
                    by >= 0 && by < MAP_SIZE &&
                    map[by][bx] === 0;
            });

            effects.forEach(e => {
                if (e.type === 'nova') { e.radius += 0.2; e.life--; }
                else if (e.type === 'levelup') { e.radius += 0.1; e.life--; }
                else if (e.type === 'lightning') { e.life--; }
            });
            effects = effects.filter(e => e.life > 0);

            items.forEach(item => {
                if (Math.sqrt((player.x - item.x) ** 2 + (player.y - item.y) ** 2) < 1) {
                    if (item.type === 0) {
                        player.hp = Math.min(player.hp + 20, player.stats.maxHp);
                        spawnFloatingText(player.x, player.y, "+20 HP", '#0f0', 20);
                    } else if (item.type === 7) {
                        player.gold += 10;
                        spawnFloatingText(player.x, player.y, "+10 G", '#ffd700', 20);
                    } else {
                        if (true) { // Limit removed
                            player.inventory.push(item);
                            spawnFloatingText(player.x, player.y, "ITEM", '#fff', 20);
                            updateInventoryUI();
                        } else {
                            spawnFloatingText(player.x, player.y, "FULL", '#f00', 20);
                        }
                    }
                    item.life = 0;
                }
            });
            items = items.filter(i => i.life > 0);

            updateFog();
            updateHUD();

            if (player.hp <= 0) {
                document.getElementById('gameOver').style.display = 'flex';
            }
        }

        const keys = {};
        let mouseX = 0;
        let mouseY = 0;
        let mouseDown = false;

        window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
        window.addEventListener('mousedown', () => mouseDown = true);
        window.addEventListener('mouseup', () => mouseDown = false);
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });

        window.addEventListener('keydown', e => {
            keys[e.key] = true;
            if (e.key === 'e' || e.key === 'E') {
                if (portal.active && Math.sqrt((player.x - portal.x) ** 2 + (player.y - portal.y) ** 2) < 2) {
                    if (currentMapType === 'town') {
                        currentMapType = 'dungeon';
                        stage = 1;
                    } else {
                        stage++;
                    }
                    resetGame(true);
                    console.log("Portal interaction: Next Stage");
                }
            }
        });
        window.addEventListener('keyup', e => keys[e.key] = false);

        let mapCanvas = document.createElement('canvas');
        let mapCtx = mapCanvas.getContext('2d');

        function prerenderMap() {
            mapCanvas.width = MAP_SIZE * TILE_SIZE + 200;
            mapCanvas.height = MAP_SIZE * TILE_SIZE / 2 + 200;
            const offsetX = mapCanvas.width / 2;
            const offsetY = 0;
            mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

            for (let y = 0; y < MAP_SIZE; y++) {
                for (let x = 0; x < MAP_SIZE; x++) {
                    const iso = toIso(x, y);
                    const screenX = iso.x + offsetX;
                    const screenY = iso.y + offsetY;

                    if (map[y][x] === 1) {
                        mapCtx.fillStyle = '#444';
                        mapCtx.beginPath();
                        mapCtx.moveTo(screenX, screenY - 32);
                        mapCtx.lineTo(screenX + 32, screenY - 16);
                        mapCtx.lineTo(screenX, screenY);
                        mapCtx.lineTo(screenX, screenY + 32);
                        mapCtx.lineTo(screenX - 32, screenY + 16);
                        mapCtx.fill();
                        mapCtx.stroke();

                        mapCtx.fillStyle = '#111';
                        mapCtx.beginPath();
                        mapCtx.moveTo(screenX, screenY);
                        mapCtx.lineTo(screenX + 32, screenY - 16);
                        mapCtx.lineTo(screenX + 32, screenY + 16);
                        mapCtx.lineTo(screenX, screenY + 32);
                        mapCtx.fill();
                        mapCtx.stroke();
                    } else {
                        mapCtx.fillStyle = '#222';
                        mapCtx.beginPath();
                        mapCtx.moveTo(screenX, screenY);
                        mapCtx.lineTo(screenX + 32, screenY - 16);
                        mapCtx.lineTo(screenX + 64, screenY);
                        mapCtx.lineTo(screenX + 32, screenY + 16);
                        mapCtx.fill();
                        mapCtx.strokeStyle = '#333';
                        mapCtx.stroke();
                    }
                }
            }
        }

        function draw() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const cameraX = canvas.width / 2 - (player.x - player.y) * TILE_SIZE / 2;
            const cameraY = canvas.height / 2 - (player.x + player.y) * TILE_SIZE / 4;

            const mapDrawX = cameraX - mapCanvas.width / 2;
            const mapDrawY = cameraY;
            ctx.drawImage(mapCanvas, mapDrawX, mapDrawY);

            // Draw Unexplored Areas (Fog of War)
            for (let y = 0; y < MAP_SIZE; y++) {
                for (let x = 0; x < MAP_SIZE; x++) {
                    if (!explored[y][x]) {
                        const iso = toIso(x, y);
                        const screenX = iso.x + cameraX;
                        const screenY = iso.y + cameraY;
                        if (screenX < -TILE_SIZE || screenX > canvas.width + TILE_SIZE || screenY < -TILE_SIZE || screenY > canvas.height + TILE_SIZE) continue;

                        ctx.fillStyle = '#000';
                        ctx.beginPath();
                        ctx.moveTo(screenX, screenY);
                        ctx.lineTo(screenX + 32, screenY - 16);
                        ctx.lineTo(screenX + 64, screenY);
                        ctx.lineTo(screenX + 32, screenY + 16);
                        ctx.fill();
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }

            // Draw Portal
            if (portal.active || currentMapType === 'town') {
                const iso = toIso(portal.x, portal.y);
                const screenX = iso.x + cameraX;
                const screenY = iso.y + cameraY;

                // Portal Glow
                const pulse = Math.sin(Date.now() / 200) * 5;
                ctx.fillStyle = currentMapType === 'town' ? '#00ff00' : '#00ffff';
                ctx.beginPath();
                ctx.ellipse(screenX, screenY, 20 + pulse, 10 + pulse / 2, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(currentMapType === 'town' ? "To Dungeon" : "Next Stage", screenX, screenY - 20);
            }

            // Draw Chests
            chests.forEach(c => {
                const iso = toIso(c.x, c.y);
                const screenX = iso.x + cameraX;
                const screenY = iso.y + cameraY;
                ctx.fillStyle = '#ffaa00';
                ctx.fillRect(screenX - 10, screenY - 20, 20, 20);
                ctx.strokeStyle = '#fff';
                ctx.strokeRect(screenX - 10, screenY - 20, 20, 20);
            });

            // Draw Items
            items.forEach(item => {
                const iso = toIso(item.x, item.y);
                const screenX = iso.x + cameraX;
                const screenY = iso.y + cameraY;

                ctx.fillStyle = item.color || '#fff';
                ctx.beginPath();
                ctx.arc(screenX, screenY - 10, 5, 0, Math.PI * 2);
                ctx.fill();

                // Item Glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = item.color;
                ctx.stroke();
                ctx.shadowBlur = 0;
            });

            // Draw NPCs
            npcs.forEach(npc => {
                const iso = toIso(npc.x, npc.y);
                npc.draw(ctx, iso.x + cameraX, iso.y + cameraY);
            });

            // Draw Enemies
            // Draw Enemies
            enemies.forEach(e => {
                if (explored[Math.floor(e.y)][Math.floor(e.x)]) {
                    const iso = toIso(e.x, e.y);
                    e.draw(ctx, iso.x + cameraX, iso.y + cameraY);
                }
            });
            const isoPlayer = toIso(player.x, player.y);
            player.draw(ctx, isoPlayer.x + cameraX, isoPlayer.y + cameraY);

            bullets.forEach(b => {
                const iso = toIso(b.x, b.y);
                const screenX = iso.x + cameraX;
                const screenY = iso.y + cameraY;
                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
                ctx.fill();
            });

            effects.forEach(e => {
                const iso = toIso(e.x, e.y);
                const screenX = iso.x + cameraX;
                const screenY = iso.y + cameraY;
                ctx.globalAlpha = e.life / 30;

                if (e.type === 'nova') {
                    ctx.fillStyle = e.color;
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, e.radius * 20, 0, Math.PI * 2);
                    ctx.fill();
                } else if (e.type === 'levelup') {
                    ctx.strokeStyle = e.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.ellipse(screenX, screenY + 10, e.radius * 20, e.radius * 10, 0, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (e.type === 'lightning') {
                    if (e.x1 !== undefined && e.x2 !== undefined) {
                        const start = toIso(e.x1, e.y1);
                        const end = toIso(e.x2, e.y2);
                        ctx.strokeStyle = e.color || '#8888ff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(start.x + cameraX, start.y + cameraY);
                        ctx.lineTo(end.x + cameraX, end.y + cameraY);
                        ctx.stroke();
                    } else {
                        ctx.strokeStyle = '#ffff00';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(screenX, screenY);
                        ctx.lineTo(screenX + (Math.random() - 0.5) * 50, screenY - 50 + (Math.random() - 0.5) * 50);
                        ctx.stroke();
                    }
                }
            });
            effects = effects.filter(e => e.life > 0);

            floatingTexts.forEach(ft => {
                const iso = toIso(ft.x, ft.y);
                const screenX = iso.x + cameraX;
                const screenY = iso.y + cameraY - 40 + (60 - ft.life);
                ctx.fillStyle = ft.color;
                ctx.font = `bold ${ft.size}px Arial`;
                ctx.fillText(ft.text, screenX, screenY);
                ft.life--;
            });
            floatingTexts = floatingTexts.filter(ft => ft.life > 0);

            ctx.globalAlpha = 1.0;
        }

        const MATERIALS = [
            { name: 'Iron Ore', color: '#aaaaaa', value: 5 },
            { name: 'Wood', color: '#8b4513', value: 2 },
            { name: 'Leather', color: '#cd853f', value: 5 },
            { name: 'Magic Dust', color: '#00ffff', value: 20 }
        ];

        function spawnItem(x, y, isBossDrop = false) {
            let type = Math.floor(Math.random() * 10); // 0-3: weapons/hp, 4-6: equip, 7: gold, 8: material, 9: scroll

            if (isBossDrop) {
                type = Math.floor(Math.random() * 3) + 4; // 4-6 (Weapon, Armor, Acc)
            }

            let item = { x, y, type, life: 600 };

            if (type <= 3) {
                if (Math.random() < 0.2) {
                    item = {
                        ...item,
                        ...generateEquipment('weapon', isBossDrop),
                        color: '#00ffff', type: 4
                    };
                } else {
                    item.type = 0; // HP Potion fallback
                    item.color = '#00ff00';
                }
            } else if (type === 4) {
                item = {
                    ...item,
                    ...generateEquipment('weapon', isBossDrop),
                    color: '#00ffff'
                };
            } else if (type === 5) {
                item = {
                    ...item,
                    ...generateEquipment('armor', isBossDrop),
                    color: '#ff00ff'
                };
            } else if (type === 6) {
                item = {
                    ...item,
                    ...generateEquipment('accessory', isBossDrop),
                    color: '#ffffff'
                };
            } else if (type === 7) {
                item.color = '#ffd700'; // Gold
            } else if (type === 8) {
                // Material
                const mat = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
                item = { ...item, name: mat.name, color: mat.color, stats: {}, slot: 'material', value: mat.value };
            } else if (type === 9) {
                // Return Scroll
                item = { ...item, name: 'Return Scroll', color: '#0000ff', stats: {}, slot: 'consumable', value: 10 };
            }

            items.push(item);
        }
        function generateEquipment(type, isBossDrop = false) {
            let rarity = Math.random();
            if (isBossDrop) rarity += 0.3;

            let quality = 1;
            if (rarity > 0.95) quality = 3;
            else if (rarity > 0.7) quality = 2;

            let weaponStats = null;
            let namePrefix = quality === 3 ? 'Legendary' : (quality === 2 ? 'Rare' : 'Common');
            let itemName = `${namePrefix} ${type.charAt(0).toUpperCase() + type.slice(1)}`;

            if (type === 'weapon') {
                const weaponTypes = Object.keys(player.WEAPONS).filter(k => k !== 'DEFAULT');
                const weaponKey = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
                weaponStats = { ...player.WEAPONS[weaponKey] };
                itemName = `${namePrefix} ${weaponStats.name}`;

                weaponStats.damageMult *= (1 + (quality - 1) * 0.2);
                weaponStats.rate = Math.max(5, weaponStats.rate * (1 - (quality - 1) * 0.1));
            }

            const stats = {
                attack: type === 'weapon' ? Math.floor(Math.random() * 5 * quality) + 1 : 0,
                defense: type === 'armor' ? Math.floor(Math.random() * 3 * quality) + 1 : 0,
                speed: type === 'accessory' ? Math.random() * 0.05 * quality : 0,
                maxHp: Math.floor(Math.random() * 20 * quality),
                critRate: Math.random() * 0.02 * quality,
                critDamage: Math.random() * 0.1 * quality
            };

            return {
                name: itemName,
                stats,
                weaponStats,
                slot: type,
                quality
            };
        }

        function toggleStats() {
            const panel = document.getElementById('statPanel');
            panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
            if (panel.style.display === 'flex') {
                updateStatUI();
                updateInventoryUI();
            }
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
            const btn = document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`);
            if (btn) btn.classList.add('active');
            const panel = document.getElementById(`panel-${tabName}`);
            if (panel) panel.classList.add('active');
        }

        function increaseStat(stat) {
            if (player.statPoints > 0) {
                if (stat === 'attack') player.baseStats.attack += 1;
                else if (stat === 'speed') player.baseStats.speed += 0.1;
                else if (stat === 'critRate') player.baseStats.critRate += 0.01;
                else if (stat === 'critDamage') player.baseStats.critDamage += 0.1;
                else if (stat === 'maxHp') {
                    player.baseStats.maxHp += 10;
                    player.hp += 10;
                } else if (stat === 'defense') {
                    player.baseStats.defense += 1;
                }
                player.statPoints--;
                updateStatUI();
            }
        }

        function updateStatUI() {
            document.getElementById('playerLevel').innerText = player.level;
            document.getElementById('playerXP').innerText = `${Math.floor(player.xp)}/${player.xpToNextLevel}`;
            document.getElementById('playerHP').innerText = `${Math.floor(player.hp)}/${player.stats.maxHp}`;
            document.getElementById('playerEnergy').innerText = `${Math.floor(player.energy)}/${player.maxEnergy}`;
            document.getElementById('playerAttack').innerText = player.stats.attack.toFixed(1);
            document.getElementById('playerSpeed').innerText = player.stats.speed.toFixed(2);
            document.getElementById('playerDefense').innerText = player.stats.defense.toFixed(0);
            document.getElementById('playerCritRate').innerText = (player.stats.critRate * 100).toFixed(1) + '%';
            document.getElementById('playerCritDamage').innerText = (player.stats.critDamage * 100).toFixed(0) + '%';
            document.getElementById('playerMaxHp').innerText = player.stats.maxHp;
            document.getElementById('statPoints').innerText = player.statPoints;
            document.getElementById('statButtons').style.display = player.statPoints > 0 ? 'block' : 'none';
            updateSkillUI();
            updateTalentUI();
        }

        function unlockSkill(index) {
            if (player.unlockSkill(index)) {
                updateSkillUI();
                updateHUD();
            }
        }

        function updateSkillUI() {
            const grid = document.getElementById('skillGrid');
            grid.innerHTML = '';
            document.getElementById('skillPoints').innerText = player.skillPoints;

            player.SKILLS.forEach((skill, index) => {
                const card = document.createElement('div');
                card.className = `skill-card ${skill.unlocked ? 'unlocked' : 'locked'}`;
                const btnClass = (player.skillPoints > 0 && player.level >= skill.levelReq && !skill.unlocked) ? 'skill-btn' : 'skill-btn disabled';
                const btnText = skill.unlocked ? 'UNLOCKED' : (player.level >= skill.levelReq ? 'UNLOCK' : `LVL ${skill.levelReq}`);
                const btnAction = (player.skillPoints > 0 && player.level >= skill.levelReq && !skill.unlocked) ? `onclick="unlockSkill(${index})"` : '';

                card.innerHTML = `<div class="skill-icon">${skill.icon}</div>
                                  <div class="skill-info" style="width:100%">
                                      <div class="skill-name">${skill.name}</div>
                                      <div class="skill-desc">${skill.desc}</div>
                                  </div>
                                  <button class="${btnClass}" ${btnAction}>${btnText}</button>`;
                grid.appendChild(card);
            });
        }

        function updateTalentUI() {
            const list = document.getElementById('talentList');
            list.innerHTML = '';
            document.getElementById('talentPoints').innerText = player.talentPoints;

            player.TALENTS.forEach((talent, index) => {
                const row = document.createElement('div');
                row.className = 'talent-row';
                const canUpgrade = player.talentPoints > 0 && talent.level < talent.maxLevel;
                const btnClass = canUpgrade ? 'talent-btn' : 'talent-btn disabled';
                const btnAction = canUpgrade ? `onclick="upgradeTalent(${index})"` : '';

                row.innerHTML = `<div class="talent-info">
                                     <div class="talent-name">${talent.name} <span style="color:#666; font-size:12px;">(Lvl ${talent.level}/${talent.maxLevel})</span></div>
                                     <div class="talent-desc">${talent.desc}</div>
                                 </div>
                                 <button class="${btnClass}" ${btnAction}>UPGRADE</button>`;
                list.appendChild(row);
            });
        }

        function upgradeTalent(index) {
            if (player.upgradeTalent(index)) {
                updateTalentUI();
                updateStatUI();
            }
        }

        function switchInventoryTab(tab) {
            currentInventoryTab = tab;
            document.querySelectorAll('.inv-tab-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.innerText.toLowerCase().includes(tab) || (tab === 'all' && btn.innerText === 'All')) {
                    btn.classList.add('active');
                }
            });
            updateInventoryUI();
        }

        function getItemValue(item) {
            function getItemValue(item) {
                if (item.type === 7) return 1; // Consumable/Ammo
                if (item.type === 8) return item.value || 5; // Material
                if (item.type === 9) return 10; // Return Scroll
                if (item.quality === 3) return 200; // Legendary
                if (item.quality === 2) return 50;  // Rare
                return 10; // Common
            }

            function sellItem(index) {
                const item = player.inventory[index];
                if (!item) return;

                let value = 10;
                if (item.quality === 2) value = 50;
                if (item.quality === 3) value = 200;
                if (item.type === 7) value = 1;
                if (item.type === 8) value = item.value || 5;
                if (item.type === 9) value = 10;

                player.gold += value;
                player.inventory.splice(index, 1);
                spawnFloatingText(player.x, player.y, `+${value} G`, '#ffd700', 20);
                updateInventoryUI();
                updateStatUI();
            }

            function useItem(index) {
                const item = player.inventory[index];
                if (!item) return;

                if (item.type === 9) { // Return Scroll
                    if (currentMapType === 'dungeon') {
                        currentMapType = 'town';
                        stage = 1;
                        resetGame(true);
                        spawnFloatingText(player.x, player.y, "Teleporting...", '#00ffff', 30);
                        player.inventory.splice(index, 1);
                        updateInventoryUI();
                    } else {
                        spawnFloatingText(player.x, player.y, "Already in Town", '#ff0000', 20);
                    }
                }
            }

            function updateInventoryUI() {
                const list = document.getElementById('inventoryList');
                list.innerHTML = '';
                const filteredInventory = player.inventory.map((item, index) => ({ item, index }))
                    .filter(({ item }) => {
                        if (currentInventoryTab === 'all') return true;
                        return item.slot === currentInventoryTab;
                    });

                if (filteredInventory.length === 0) {
                    list.innerHTML = '<p style="color:#666;">No items in this category.</p>';
                } else {
                    filteredInventory.forEach(({ item, index }) => {
                        const div = document.createElement('div');
                        div.className = 'inv-item';
                        div.onmouseenter = (e) => showItemTooltip(item, e);
                        div.onmouseleave = hideItemTooltip;
                        div.onmousemove = (e) => moveItemTooltip(e);

                        let statsStr = '';
                        if (item.stats.attack) statsStr += `ATK: +${item.stats.attack} `;
                        if (item.stats.speed) statsStr += `SPD: +${item.stats.speed.toFixed(2)} `;
                        if (item.stats.maxHp) statsStr += `HP: +${item.stats.maxHp} `;
                        if (item.stats.defense) statsStr += `DEF: +${item.stats.defense} `;
                        if (item.stats.critRate) statsStr += `CRIT %: +${(item.stats.critRate * 100).toFixed(1)}% `;
                        if (item.stats.critDamage) statsStr += `CRIT DMG: +${item.stats.critDamage.toFixed(1)} `;

                        let actionBtn = `<button class="inv-btn" onclick="equipItem(${index})" style="flex:1;">EQUIP</button>`;
                        if (item.type === 8) { // Material
                            actionBtn = `<button class="inv-btn" style="flex:1; background:#444; cursor:default;">MATERIAL</button>`;
                        } else if (item.type === 9) { // Return Scroll
                            actionBtn = `<button class="inv-btn" onclick="useItem(${index})" style="flex:1; background:#0000aa;">USE</button>`;
                        }

                        div.innerHTML = `<div>
                                         <span class="inv-name" style="color:${item.color}">${item.name}</span>
                                         <span style="color:#666; font-size:10px;">${statsStr}</span>
                                     </div>
                                     <div style="display:flex; gap:5px; margin-top:auto;">
                                         ${actionBtn}
                                         <button class="inv-btn" onclick="sellItem(${index})" style="flex:1; background:#882222;">SELL (${getItemValue(item)}G)</button>
                                     </div>`;
                        list.appendChild(div);
                    });
                }

                const eqWeapon = document.getElementById('eq-weapon');
                const eqArmor = document.getElementById('eq-armor');
                const eqAccessory = document.getElementById('eq-accessory');

                if (player.equipment.weapon) {
                    eqWeapon.innerHTML = `<span style="color:${player.equipment.weapon.color}">${player.equipment.weapon.name}</span><button class="unequip-btn" onclick="unequipItem('weapon')">X</button>`;
                } else {
                    eqWeapon.textContent = 'None';
                }

                if (player.equipment.armor) {
                    eqArmor.innerHTML = `<span style="color:${player.equipment.armor.color}">${player.equipment.armor.name}</span><button class="unequip-btn" onclick="unequipItem('armor')">X</button>`;
                } else {
                    eqArmor.textContent = 'None';
                }

                if (player.equipment.accessory) {
                    eqAccessory.innerHTML = `<span style="color:${player.equipment.accessory.color}">${player.equipment.accessory.name}</span><button class="unequip-btn" onclick="unequipItem('accessory')">X</button>`;
                } else {
                    eqAccessory.textContent = 'None';
                }
            }
            const tooltip = document.getElementById('itemTooltip');

            function showItemTooltip(item, e) {
                tooltip.style.display = 'block';
                moveItemTooltip(e);
                const equipped = player.equipment[item.slot];
                let content = `<div class="tooltip-header" style="color:${item.color}">${item.name}</div>`;

                const compare = (label, val, eqVal, isPercent = false) => {
                    if (!val && !eqVal) return '';
                    const v = val || 0;
                    const ev = eqVal || 0;
                    const diff = v - ev;
                    const diffStr = isPercent ? (diff * 100).toFixed(1) + '%' : diff.toFixed(1);
                    const valStr = isPercent ? (v * 100).toFixed(1) + '%' : v.toFixed(1);

                    let diffHtml = '';
                    if (diff > 0.001) diffHtml = `<span class="stat-better"> (+${diffStr} ??</span>`;
                    else if (diff < -0.001) diffHtml = `<span class="stat-worse"> (${diffStr} ??</span>`;

                    return `<div class="tooltip-stat"><span>${label}: ${valStr}</span>${diffHtml}</div>`;
                };

                const eqStats = equipped ? equipped.stats : {};
                content += compare('Attack', item.stats.attack, eqStats.attack);
                content += compare('Defense', item.stats.defense, eqStats.defense);
                content += compare('Speed', item.stats.speed, eqStats.speed);
                content += compare('Max HP', item.stats.maxHp, eqStats.maxHp);
                content += compare('Crit Rate', item.stats.critRate, eqStats.critRate, true);
                content += compare('Crit Dmg', item.stats.critDamage, eqStats.critDamage, true);

                if (equipped) {
                    content += `<div style="margin-top:5px; font-size:10px; color:#aaa;">Comparision with equipped ${equipped.name}</div>`;
                } else {
                    content += `<div style="margin-top:5px; font-size:10px; color:#aaa;">No item equipped in this slot</div>`;
                }
                tooltip.innerHTML = content;
            }

            function hideItemTooltip() {
                tooltip.style.display = 'none';
            }

            function moveItemTooltip(e) {
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY + 15) + 'px';
            }

            function equipItem(index) {
                const item = player.inventory[index];
                const slot = item.slot;
                if (!slot) return;

                if (player.equipment[slot]) {
                    player.inventory.push(player.equipment[slot]);
                }
                player.equipment[slot] = item;
                player.inventory.splice(index, 1);
                updateInventoryUI();
                updateStatUI();
            }

            function unequipItem(slot) {
                if (player.equipment[slot]) {
                    player.inventory.push(player.equipment[slot]);
                    player.equipment[slot] = null;
                    updateInventoryUI();
                    updateStatUI();
                }
            }

            function spawnFloatingText(x, y, text, color, size) {
                floatingTexts.push({ x, y, text, color, size, life: 60 });
            }

            function updateFog() {
                const range = 8;
                for (let y = Math.floor(player.y - range); y <= Math.floor(player.y + range); y++) {
                    for (let x = Math.floor(player.x - range); x <= Math.floor(player.x + range); x++) {
                        if (y >= 0 && y < MAP_SIZE && x >= 0 && x < MAP_SIZE) {
                            if (Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2) < range) {
                                if (explored[y]) explored[y][x] = true;
                            }
                        }
                    }
                }
            }

            function generateQuest() {
                const target = 5 + Math.floor(Math.random() * 5) + stage * 2;
                currentQuest = {
                    type: 'kill',
                    target: target,
                    current: 0,
                    description: `Defeat ${target} Enemies`,
                    reward: { gold: 50 + stage * 10, xp: 100 + stage * 20 }
                };
                updateHUD();
            }

            function updateQuest(type, amount) {
                if (currentQuest && currentQuest.type === type && currentQuest.current < currentQuest.target) {
                    currentQuest.current += amount;
                    if (currentQuest.current >= currentQuest.target) {
                        completeQuest();
                    }
                    updateHUD();
                }
            }

            function completeQuest() {
                player.gold += currentQuest.reward.gold;
                player.gainXp(currentQuest.reward.xp, effects);
                spawnFloatingText(player.x, player.y, "Quest Complete!", '#ffff00', 30);
                spawnFloatingText(player.x, player.y - 1, `+${currentQuest.reward.gold} Gold`, '#ffd700', 20);
                spawnFloatingText(player.x, player.y - 2, `+${currentQuest.reward.xp} XP`, '#00ff00', 20);
                setTimeout(generateQuest, 2000);
                currentQuest.description = "Quest Complete!";
                currentQuest.current = currentQuest.target;
            }

            function updateHUD() {
                document.getElementById('hp-text').innerText = `${Math.floor(player.hp)}/${player.stats.maxHp}`;
                document.getElementById('hp-bar-fill').style.width = `${(player.hp / player.stats.maxHp) * 100}%`;
                document.getElementById('playerGold').innerText = player.gold;

                const xpPercent = (player.xp / player.xpToNextLevel) * 100;
                document.getElementById('xp-bar-fill').style.width = xpPercent + '%';

                const energyPercent = (player.energy / player.maxEnergy) * 100;
                document.getElementById('energy-bar-fill').style.width = energyPercent + '%';

                player.SKILLS.forEach((skill, index) => {
                    let id = index + 1;
                    if (index === 5) id = 'space';
                    const cdEl = document.getElementById(`cd-${id}`);
                    if (cdEl) {
                        const percent = (skill.cooldown / skill.maxCooldown) * 100;
                        cdEl.style.height = percent + '%';
                    }
                });

                if (currentQuest) {
                    document.getElementById('quest-desc').innerText = currentQuest.description;
                    const questPercent = Math.min(100, (currentQuest.current / currentQuest.target) * 100);
                    document.getElementById('quest-bar').style.width = questPercent + '%';
                } else {
                    document.getElementById('quest-desc').innerText = "No Active Quest";
                    document.getElementById('quest-bar').style.width = '0%';
                }
            }

            function toggleMerchant() {
                const panel = document.getElementById('merchantPanel');
                panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
            }

            function toggleQuest() {
                const panel = document.getElementById('questPanel');
                panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
                if (panel.style.display === 'flex') {
                    updateQuestUI();
                }
            }

            function updateQuestUI() {
                const content = document.getElementById('questContent');
                content.innerHTML = '';

                if (!currentQuest) {
                    content.innerHTML = '<div style="color: #aaa;">No active quest.</div><button class="inv-btn" onclick="generateQuest()">Accept New Quest</button>';
                } else {
                    if (currentQuest.current >= currentQuest.target) {
                        content.innerHTML = `
                        <div style="color: #0f0; font-size: 18px;">${currentQuest.description}</div>
                        <div style="color: #fff;">Progress: ${currentQuest.current}/${currentQuest.target}</div>
                        <button class="inv-btn" style="background: #4CAF50; margin-top: 10px;" onclick="completeQuest(); toggleQuest();">Complete Quest</button>
                    `;
                    } else {
                        content.innerHTML = `
                        <div style="color: #fff; font-size: 18px;">${currentQuest.description}</div>
                        <div style="color: #aaa;">Progress: ${currentQuest.current}/${currentQuest.target}</div>
                        <div style="color: #ffd700; margin-top: 10px;">Reward: ${currentQuest.reward.gold} Gold, ${currentQuest.reward.xp} XP</div>
                    `;
                    }
                }
            }

            function buyItem(type) {
                let cost = 0;
                if (type === 'potion') cost = 50;
                else if (type === 'weapon') cost = 200;
                else if (type === 'armor') cost = 150;
                else if (type === 'accessory') cost = 150;

                if (player.gold >= cost) {
                    player.gold -= cost;
                    spawnFloatingText(player.x, player.y, `-${cost} G`, '#ffd700', 20);

                    if (type === 'potion') {
                        player.hp = Math.min(player.hp + 50, player.stats.maxHp);
                        spawnFloatingText(player.x, player.y, "+50 HP", '#0f0', 20);
                    } else {
                        let itemType = 4;
                        let itemColor = '#ffffff';
                        if (type === 'weapon') { itemType = 4; itemColor = '#00ffff'; }
                        if (type === 'armor') { itemType = 5; itemColor = '#ff00ff'; }
                        if (type === 'accessory') { itemType = 6; itemColor = '#ffffff'; }

                        const item = generateEquipment(type, false);
                        const newItem = {
                            type: itemType,
                            color: itemColor,
                            ...item
                        };
                        player.inventory.push(newItem);
                        spawnFloatingText(player.x, player.y, "ITEM BOUGHT", '#fff', 20);
                        updateInventoryUI();
                    }
                } else {
                    spawnFloatingText(player.x, player.y, "Not Enough Gold", '#f00', 20);
                }
            }


            const RECIPES = [
                { id: 'sword', name: 'Iron Sword', type: 'weapon', materials: { 'Iron Ore': 3, 'Wood': 1 } },
                { id: 'armor', name: 'Leather Armor', type: 'armor', materials: { 'Leather': 3, 'Iron Ore': 1 } },
                { id: 'accessory', name: 'Magic Ring', type: 'accessory', materials: { 'Magic Dust': 3 } }
            ];

            function toggleCrafting() {
                const panel = document.getElementById('craftingPanel');
                panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
                if (panel.style.display === 'flex') {
                    renderCraftingUI();
                }
            }

            function renderCraftingUI() {
                const list = document.getElementById('craftingList');
                list.innerHTML = '';

                RECIPES.forEach(recipe => {
                    const div = document.createElement('div');
                    div.style.background = 'rgba(255, 255, 255, 0.1)';
                    div.style.padding = '10px';
                    div.style.borderRadius = '5px';
                    div.style.display = 'flex';
                    div.style.justifyContent = 'space-between';
                    div.style.alignItems = 'center';

                    let matStr = '';
                    let canCraft = true;
                    for (const [matName, count] of Object.entries(recipe.materials)) {
                        const playerHas = player.inventory.filter(i => i.name === matName).length;
                        const color = playerHas >= count ? '#00ff00' : '#ff0000';
                        if (playerHas < count) canCraft = false;
                        matStr += `<div style="font-size:12px; color:${color};">${matName}: ${playerHas}/${count}</div>`;
                    }

                    div.innerHTML = `
                    <div>
                        <div style="font-weight:bold; color:#ff8800;">${recipe.name}</div>
                        <div style="display:flex; gap:10px; margin-top:5px;">${matStr}</div>
                    </div>
                    <button onclick="craftItem('${recipe.id}')" style="padding:5px 10px; background:${canCraft ? '#ff8800' : '#444'}; border:none; color:white; cursor:${canCraft ? 'pointer' : 'not-allowed'};" ${canCraft ? '' : 'disabled'}>CRAFT</button>
                `;
                    list.appendChild(div);
                });
            }

            function craftItem(recipeId) {
                const recipe = RECIPES.find(r => r.id === recipeId);
                if (!recipe) return;

                // Check materials again
                for (const [matName, count] of Object.entries(recipe.materials)) {
                    const playerHas = player.inventory.filter(i => i.name === matName).length;
                    if (playerHas < count) return;
                }

                // Consume materials
                for (const [matName, count] of Object.entries(recipe.materials)) {
                    for (let i = 0; i < count; i++) {
                        const idx = player.inventory.findIndex(item => item.name === matName);
                        if (idx !== -1) player.inventory.splice(idx, 1);
                    }
                }

                // Generate Item
                let newItem = generateEquipment(recipe.type);
                newItem.name = `Crafted ${newItem.name}`;
                newItem.quality = 2;
                newItem.color = '#00ff00';
                newItem.stats.attack += 2;
                newItem.stats.defense += 2;

                player.inventory.push(newItem);
                spawnFloatingText(player.x, player.y, "Crafted!", '#ff8800', 30);
                renderCraftingUI();
                updateInventoryUI();
            }
            function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                update();
                draw();
                requestAnimationFrame(animate);
            }

            try {
                console.log("Game Version: Quest System Implemented");
                resetGame();
                animate();
            } catch (e) {
                console.error("Game Init Error:", e);
                alert("Game Init Error: " + e.message);
            }
    </script>
</body>

</html>
