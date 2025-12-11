class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = 100;
        this.maxHp = 100;
        this.score = 0;
        this.shootTimer = 0;
        this.energy = 0;
        this.maxEnergy = 100;
        this.flameActive = false;
        this.flameTimer = 0;
        this.flameCooldown = 0;
        this.flameMaxCooldown = 600;
        this.flameDuration = 300;
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 100;
        this.statPoints = 0;
        this.skillPoints = 0;
        this.talentPoints = 0;
        this.gold = 0;

        // Stats System
        this.baseStats = {
            attack: 10,
            speed: 0.15,
            critRate: 0.05,
            critDamage: 1.5,
            maxHp: 100,
            defense: 0
        };

        // Skill System
        this.SKILLS = [
            { id: 0, name: 'Dash', levelReq: 2, cooldown: 180, maxCooldown: 180, active: false, unlocked: false, icon: '⚡', desc: 'Quick burst of speed' },
            { id: 1, name: 'PowerShot', levelReq: 4, cooldown: 300, maxCooldown: 300, active: false, unlocked: false, icon: '💥', desc: 'High damage projectile' },
            { id: 2, name: 'Spread', levelReq: 6, cooldown: 400, maxCooldown: 400, active: false, unlocked: false, icon: '🌊', desc: 'Fires 8 bullets around' },
            { id: 3, name: 'Heal', levelReq: 8, cooldown: 600, maxCooldown: 600, active: false, unlocked: false, icon: '❤️', desc: 'Restore 30% HP' },
            { id: 4, name: 'Shockwave', levelReq: 10, cooldown: 500, maxCooldown: 500, active: false, unlocked: false, icon: '🌀', desc: 'Push back enemies' }
        ];

        // Talent System
        this.TALENTS = [
            { id: 'might', name: 'Might', maxLevel: 5, level: 0, desc: '+5% Attack per level', effect: (p) => p.baseStats.attack += p.baseStats.attack * 0.05 },
            { id: 'alacrity', name: 'Alacrity', maxLevel: 5, level: 0, desc: '+2% Speed per level', effect: (p) => p.baseStats.speed += 0.005 },
            { id: 'vitality', name: 'Vitality', maxLevel: 5, level: 0, desc: '+10% Max HP per level', effect: (p) => { p.baseStats.maxHp *= 1.1; p.hp = p.baseStats.maxHp; } },
            { id: 'fireAmmo', name: 'Fire Ammo', maxLevel: 1, level: 0, desc: 'Chance to burn enemies', effect: () => { } },
            { id: 'lightningAmmo', name: 'Lightning Ammo', maxLevel: 1, level: 0, desc: 'Chance to chain lightning', effect: () => { } }
        ];

        this.inventory = [];
        this.equipment = {
            weapon: null,
            armor: null,
            accessory: null
        };

        this.WEAPONS = {
            DEFAULT: { name: 'Pistol', count: 1, spread: 0, speed: 0.4, damageMult: 1, rate: 15, color: '#00ffff' },
            SHOTGUN: { name: 'Shotgun', count: 5, spread: 0.3, speed: 0.3, damageMult: 0.6, rate: 45, color: '#ff0000' },
            MACHINE_GUN: { name: 'Machine Gun', count: 1, spread: 0.1, speed: 0.5, damageMult: 0.4, rate: 5, color: '#ffff00' },
            SNIPER: { name: 'Sniper', count: 1, spread: 0, speed: 0.8, damageMult: 4, rate: 70, color: '#00ff00' }
        };

        // Initialize with default weapon item
        this.equipment.weapon = {
            name: 'Rusty Pistol',
            stats: { attack: 0 },
            weaponStats: this.WEAPONS.DEFAULT,
            slot: 'weapon',
            color: '#aaa'
        };

        this.aimAngle = 0;
        this.aimDist = 0;
    }

    get stats() {
        let s = { ...this.baseStats };
        if (this.equipment.weapon) this.applyStats(s, this.equipment.weapon.stats);
        if (this.equipment.armor) this.applyStats(s, this.equipment.armor.stats);
        if (this.equipment.accessory) this.applyStats(s, this.equipment.accessory.stats);
        return s;
    }

    get weapon() {
        return this.equipment.weapon ? this.equipment.weapon.weaponStats : this.WEAPONS.DEFAULT;
    }

    applyStats(target, source) {
        for (let key in source) {
            if (target[key] !== undefined) target[key] += source[key];
        }
    }

    move(dx, dy, map) {
        if (dx !== 0 || dy !== 0) {
            // Normalize diagonal movement
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;

            const moveSpeed = this.stats.speed;
            const size = 0.3; // Collision radius

            // Try Move X
            const nextX = this.x + dx * moveSpeed;
            if (!this.checkCollision(nextX, this.y, map, size)) {
                this.x = nextX;
            }

            // Try Move Y
            const nextY = this.y + dy * moveSpeed;
            if (!this.checkCollision(this.x, nextY, map, size)) {
                this.y = nextY;
            }
        }
    }

    checkCollision(x, y, map, size) {
        // Check 4 corners
        return this.isSolid(x - size, y - size, map) ||
            this.isSolid(x + size, y - size, map) ||
            this.isSolid(x - size, y + size, map) ||
            this.isSolid(x + size, y + size, map);
    }

    attack(enemies, bullets, effects, items, floatingTexts, spawnItem) {
        if (this.energy >= this.maxEnergy) {
            this.activateUltimate(enemies, effects, items, floatingTexts, spawnItem);
        }
    }

    update() {
        // Energy Regen
        if (this.energy < this.maxEnergy) this.energy += 0.05;

        // Skills Update
        this.SKILLS.forEach(skill => {
            if (skill.cooldown > 0) skill.cooldown--;
        });

        // Flame Skill Timer
        if (this.flameCooldown > 0) this.flameCooldown--;
        if (this.flameActive) {
            this.flameTimer--;
            if (this.flameTimer <= 0) this.flameActive = false;
        }

        // Shooting Timer
        if (this.shootTimer > 0) this.shootTimer--;
    }

    isSolid(x, y, map) {
        const MAP_SIZE = map.length;
        let gridX = Math.floor(x);
        let gridY = Math.floor(y);
        if (gridX < 0 || gridX >= MAP_SIZE || gridY < 0 || gridY >= MAP_SIZE) return true;
        return map[gridY][gridX] === 1;
    }

    unlockSkill(index) {
        if (index >= 0 && index < this.SKILLS.length) {
            const skill = this.SKILLS[index];
            if (!skill.unlocked && this.level >= skill.levelReq && this.skillPoints > 0) {
                skill.unlocked = true;
                this.skillPoints--;
                return true;
            }
        }
        return false;
    }

    upgradeTalent(index) {
        if (index >= 0 && index < this.TALENTS.length) {
            const talent = this.TALENTS[index];
            if (talent.level < talent.maxLevel && this.talentPoints > 0) {
                talent.level++;
                this.talentPoints--;
                talent.effect(this);
                return true;
            }
        }
        return false;
    }

    useSkill(index, enemies, effects, items, floatingTexts, bullets, map) {
        if (index >= 0 && index < this.SKILLS.length) {
            const skill = this.SKILLS[index];
            if (skill.unlocked && skill.cooldown <= 0) {
                skill.cooldown = skill.maxCooldown;

                // Skill Logic
                switch (index) {
                    case 0: // Dash
                        const dashDist = 3;
                        const dashX = this.x + Math.cos(this.aimAngle) * dashDist;
                        const dashY = this.y + Math.sin(this.aimAngle) * dashDist;
                        // Simple collision check before dash
                        if (!this.isSolid(dashX, dashY, map)) {
                            this.x = dashX;
                            this.y = dashY;
                        }
                        effects.push({ x: this.x, y: this.y, radius: 0.5, maxRadius: 1, life: 20, color: '#fff', type: 'nova' });
                        break;
                    case 1: // PowerShot
                        bullets.push({
                            x: this.x, y: this.y,
                            vx: Math.cos(this.aimAngle) * 1.0, vy: Math.sin(this.aimAngle) * 1.0,
                            life: 100, damageMult: 5, color: '#ff00ff', size: 8
                        });
                        break;
                    case 2: // Spread
                        for (let i = 0; i < 8; i++) {
                            const angle = (Math.PI * 2 / 8) * i;
                            bullets.push({
                                x: this.x, y: this.y,
                                vx: Math.cos(angle) * 0.5, vy: Math.sin(angle) * 0.5,
                                life: 60, damageMult: 0.8, color: '#00ffff'
                            });
                        }
                        break;
                    case 3: // Heal
                        this.hp = Math.min(this.hp + this.stats.maxHp * 0.3, this.stats.maxHp);
                        effects.push({ x: this.x, y: this.y, radius: 1, maxRadius: 2, life: 40, color: '#00ff00', type: 'nova' });
                        floatingTexts.push({ x: this.x, y: this.y - 1, text: "+HP", color: '#00ff00', size: 20, life: 60 });
                        break;
                    case 4: // Shockwave
                        effects.push({ x: this.x, y: this.y, radius: 1, maxRadius: 5, life: 30, color: '#ffff00', type: 'nova' });
                        enemies.forEach(e => {
                            const dist = Math.sqrt((this.x - e.x) ** 2 + (this.y - e.y) ** 2);
                            if (dist < 5) {
                                e.x += (e.x - this.x) / dist * 2; // Pushback
                                e.y += (e.y - this.y) / dist * 2;
                                e.hp -= this.stats.attack * 2;
                                floatingTexts.push({ x: e.x, y: e.y, text: Math.floor(this.stats.attack * 2), color: '#ffff00', size: 20, life: 60 });
                            }
                        });
                        break;
                }
            }
        }
    }

    activateUltimate(enemies, effects, items, floatingTexts, spawnItem) {
        this.energy = 0;
        effects.push({ x: this.x, y: this.y, radius: 1, maxRadius: 15, life: 60, color: '#00ffff', type: 'nova' });

        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            let dist = Math.sqrt((this.x - e.x) ** 2 + (this.y - e.y) ** 2);
            if (dist < 10) {
                let damage = this.stats.attack * 5;
                e.hp -= damage;
                floatingTexts.push({ x: e.x, y: e.y - 1, text: Math.floor(damage), color: '#00ffff', size: 30, life: 60, maxLife: 60 });

                if (Math.random() < 0.3) {
                    if (spawnItem) {
                        spawnItem(e.x, e.y);
                    } else {
                        items.push({ x: e.x, y: e.y, type: Math.random() < 0.7 ? 0 : 1, life: 1800 });
                    }
                }

                this.gainXp(e.level * 20, effects);
                this.energy = Math.min(this.energy + 5, this.maxEnergy);
                enemies.splice(i, 1);
            }
        }
    }

    shoot(mouseX, mouseY, bullets, canvas) {
        const dx = mouseX - canvas.width / 2;
        const dy = mouseY - canvas.height / 2;
        const angle = Math.atan2(dy, dx); // Screen space angle

        const weapon = this.equipment.weapon || this.WEAPONS.DEFAULT;
        const weaponStats = weapon.weaponStats || this.WEAPONS.DEFAULT; // Fallback or structure match

        for (let i = 0; i < weaponStats.count; i++) {
            const spread = (Math.random() - 0.5) * weaponStats.spread;
            const finalAngle = angle + spread;

            // Convert screen angle to world velocity (Inverse Isometric)
            const screenVx = Math.cos(finalAngle);
            const screenVy = Math.sin(finalAngle);

            let worldVx = screenVx + 2 * screenVy;
            let worldVy = 2 * screenVy - screenVx;

            // Normalize
            const len = Math.sqrt(worldVx * worldVx + worldVy * worldVy);
            worldVx /= len;
            worldVy /= len;

            // Check Talents
            let isFire = this.TALENTS[3].level > 0 && Math.random() < 0.3;
            let isLightning = this.TALENTS[4].level > 0 && Math.random() < 0.3;
            let color = weapon.color || weaponStats.color;
            if (isFire) color = '#ff8800';
            if (isLightning) color = '#8888ff';

            bullets.push({
                x: this.x,
                y: this.y,
                vx: worldVx * weaponStats.speed,
                vy: worldVy * weaponStats.speed,
                life: 60,
                damageMult: weaponStats.damageMult,
                color: color,
                isFire: isFire,
                isLightning: isLightning
            });
        }
    }

    gainXp(amount, effects) {
        this.xp += amount;
        this.score += 100 + amount;
        if (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.level++;
            this.statPoints += 5;
            this.skillPoints += 1; // New
            this.talentPoints += 1; // New
            this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.2);
            this.baseStats.maxHp += 10;
            this.hp = this.stats.maxHp; // Sync HP to new max (including equipment)
            if (typeof updateStatUI === 'function') updateStatUI();
            // Isometric Level Up Effect - Flat ring on ground
            effects.push({ x: this.x, y: this.y, radius: 1, maxRadius: 3, life: 60, color: '#ffff00', type: 'levelup' });
        }
    }

    draw(ctx, x, y) {
        const centerX = x;
        const centerY = y + 16;
        const size = 20;
        const height = 40;

        // Draw Player Box (Isometric Prism)

        // Top Face
        ctx.fillStyle = '#0088ff';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - height - size / 2);
        ctx.lineTo(centerX + size, centerY - height);
        ctx.lineTo(centerX, centerY - height + size / 2);
        ctx.lineTo(centerX - size, centerY - height);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Right Face
        ctx.fillStyle = '#0055aa';
        ctx.beginPath();
        ctx.moveTo(centerX + size, centerY - height);
        ctx.lineTo(centerX + size, centerY);
        ctx.lineTo(centerX, centerY + size / 2);
        ctx.lineTo(centerX, centerY - height + size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Left Face
        ctx.fillStyle = '#0066cc';
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY - height);
        ctx.lineTo(centerX - size, centerY);
        ctx.lineTo(centerX, centerY + size / 2);
        ctx.lineTo(centerX, centerY - height + size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Weapon (Aiming Line)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // Semi-transparent white
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dashed line
        ctx.beginPath();
        // Start from center of player box
        const weaponX = centerX;
        const weaponY = centerY;
        ctx.moveTo(weaponX, weaponY);
        // Draw line towards aim angle with dynamic distance
        ctx.lineTo(weaponX + Math.cos(this.aimAngle) * this.aimDist, weaponY + Math.sin(this.aimAngle) * this.aimDist);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
    }
}
