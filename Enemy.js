class Enemy {
    constructor(x, y, level, isBoss = false) {
        this.x = x;
        this.y = y;
        this.level = level;
        this.isBoss = isBoss;

        // Boss Scaling
        const hpMult = isBoss ? 10 : 1;
        const dmgMult = isBoss ? 2 : 1;

        this.hp = (50 + (level * 20)) * hpMult;
        this.maxHp = this.hp;
        this.damage = (3 + (level * 1.5)) * dmgMult;
        this.defense = level * 1 + (isBoss ? 5 : 0);
        this.speed = (0.02 + (level * 0.001)) * (isBoss ? 0.8 : 1); // Boss is slightly slower

        this.status = {
            burn: 0,
            burnTimer: 0
        };
        this.attackCooldown = 0;
        this.attackRate = isBoss ? 40 : 60; // Boss attacks faster
    }

    update(player, map, bullets, floatingTexts, effects, items, spawnItem, allEnemies) {
        // Status Effects
        if (this.status.burn > 0) {
            this.status.burnTimer--;
            if (this.status.burnTimer <= 0) {
                this.hp -= this.status.burn;
                floatingTexts.push({ x: this.x, y: this.y - 1, text: this.status.burn, color: '#ff8800', size: 15, life: 30 });
                this.status.burnTimer = 60; // Tick every second
                this.status.burn--; // Reduce burn stack
            }
        }

        // Movement
        let edx = player.x - this.x;
        let edy = player.y - this.y;
        let dist = Math.sqrt(edx * edx + edy * edy);

        if (dist > 0.5) {
            edx /= dist;
            edy /= dist;
            let nextEX = this.x + edx * this.speed;
            let nextEY = this.y + edy * this.speed;

            if (!this.isSolid(nextEX, this.y, map)) this.x = nextEX;
            if (!this.isSolid(this.x, nextEY, map)) this.y = nextEY;
        }

        // Attack Player
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (dist < 1.0 && this.attackCooldown <= 0) {
            let damage = Math.max(0, this.damage - player.stats.defense);
            player.hp -= damage;
            floatingTexts.push({
                x: player.x,
                y: player.y - 1,
                text: `-${Math.floor(damage)}`,
                color: '#ff0000',
                size: 20,
                life: 60
            });
            this.attackCooldown = this.attackRate;
        }

        // Bullet Collisions
        for (let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i];
            let bDist = Math.sqrt((b.x - this.x) ** 2 + (b.y - this.y) ** 2);
            if (bDist < 0.5) {
                // Hit
                let damage = player.stats.attack * b.damageMult;

                // Crit
                let isCrit = Math.random() < player.stats.critRate;
                if (isCrit) damage *= player.stats.critDamage;

                // Defense
                damage = Math.max(1, damage - this.defense);

                this.hp -= damage;
                floatingTexts.push({
                    x: this.x,
                    y: this.y - 1,
                    text: Math.floor(damage),
                    color: isCrit ? '#ff0000' : '#fff',
                    size: isCrit ? 25 : 15,
                    life: 60
                });

                // Elemental Effects
                if (b.isFire) {
                    this.status.burn += 5; // Stack burn
                    this.status.burnTimer = 0; // Trigger immediately
                    effects.push({ x: this.x, y: this.y, radius: 0.5, maxRadius: 1, life: 30, color: '#ff8800', type: 'flame' });
                }

                if (b.isLightning) {
                    // Chain to nearby enemies
                    let chainCount = 0;
                    if (allEnemies) {
                        allEnemies.forEach(e => {
                            if (e !== this && chainCount < 3) {
                                let d = Math.sqrt((e.x - this.x) ** 2 + (e.y - this.y) ** 2);
                                if (d < 5) {
                                    e.hp -= damage * 0.5;
                                    floatingTexts.push({ x: e.x, y: e.y - 1, text: Math.floor(damage * 0.5), color: '#8888ff', size: 15, life: 40 });

                                    // Draw Chain Lightning
                                    // Note: We can't draw here easily as we don't have ctx. 
                                    // We can push a special effect to be drawn later.
                                    effects.push({
                                        type: 'lightning',
                                        x1: this.x, y1: this.y,
                                        x2: e.x, y2: e.y,
                                        life: 10,
                                        color: '#8888ff'
                                    });
                                    chainCount++;
                                }
                            }
                        });
                    }
                }

                // Remove bullet
                b.life = 0;

                // Hit Effect
                effects.push({ x: b.x, y: b.y, radius: 0.2, maxRadius: 0.5, life: 10, color: '#fff', type: 'nova' });

                if (this.hp <= 0) {
                    break; // Enemy dead, stop checking bullets
                }
            }
        }

        // Death Logic
        if (this.hp <= 0) {
            player.gainXp(this.level * (this.isBoss ? 100 : 10), effects);
            player.energy = Math.min(player.energy + (this.isBoss ? 50 : 5), player.maxEnergy);
            if (spawnItem) {
                if (this.isBoss) {
                    // Boss drops multiple items, high chance of legendary
                    for (let i = 0; i < 3; i++) spawnItem(this.x + (Math.random() - 0.5) * 2, this.y + (Math.random() - 0.5) * 2, true);
                } else {
                    spawnItem(this.x, this.y);
                }
            }
        }
    }

    isSolid(x, y, map) {
        const MAP_SIZE = map.length;
        let gridX = Math.floor(x);
        let gridY = Math.floor(y);
        if (gridX < 0 || gridX >= MAP_SIZE || gridY < 0 || gridY >= MAP_SIZE) return true;
        return map[gridY][gridX] === 1;
    }

    draw(ctx, x, y) {
        const centerX = x;
        const centerY = y + 16;
        const size = this.isBoss ? 40 : 20;
        const height = this.isBoss ? 80 : 40;

        // Color based on level
        let topColor = '#aaaaaa';
        let sideColor1 = '#888888';
        let sideColor2 = '#666666';

        if (this.isBoss) {
            topColor = '#440000'; sideColor1 = '#330000'; sideColor2 = '#220000';
        } else if (this.level > 5) {
            topColor = '#ff0000'; sideColor1 = '#cc0000'; sideColor2 = '#990000';
        } else if (this.level > 3) {
            topColor = '#ff8800'; sideColor1 = '#cc6600'; sideColor2 = '#994400';
        }

        // Draw Enemy Box (Isometric Prism)

        // Top Face
        ctx.fillStyle = topColor;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - height - size / 2);
        ctx.lineTo(centerX + size, centerY - height);
        ctx.lineTo(centerX, centerY - height + size / 2);
        ctx.lineTo(centerX - size, centerY - height);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Right Face
        ctx.fillStyle = sideColor1;
        ctx.beginPath();
        ctx.moveTo(centerX + size, centerY - height);
        ctx.lineTo(centerX + size, centerY);
        ctx.lineTo(centerX, centerY + size / 2);
        ctx.lineTo(centerX, centerY - height + size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Left Face
        ctx.fillStyle = sideColor2;
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY - height);
        ctx.lineTo(centerX - size, centerY);
        ctx.lineTo(centerX, centerY + size / 2);
        ctx.lineTo(centerX, centerY - height + size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Level Text
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Lv.${this.level}`, centerX, centerY - height - 10);

        // HP Bar
        const hpWidth = 40;
        const hpPercent = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#333';
        ctx.fillRect(centerX - hpWidth / 2, centerY - height - 20, hpWidth, 5);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(centerX - hpWidth / 2, centerY - height - 20, hpWidth * hpPercent, 5);

        // Status Icons
        if (this.status.burn > 0) {
            ctx.fillStyle = '#ff8800';
            ctx.beginPath();
            ctx.arc(centerX + 10, centerY - height - 25, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
