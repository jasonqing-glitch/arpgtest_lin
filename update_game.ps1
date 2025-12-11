$path = "d:\遊戲\arpg\game_v2.html"
$content = Get-Content -Path $path -Raw -Encoding UTF8

# CSS
$css = @"
        }

        /* Inventory Tabs */
        .inv-tabs {
            display: flex;
            gap: 5px;
            margin-bottom: 10px;
        }

        .inv-tab-btn {
            padding: 5px 10px;
            background: #222;
            border: 1px solid #444;
            color: #888;
            cursor: pointer;
            font-size: 12px;
            border-radius: 3px;
        }

        .inv-tab-btn.active {
            background: #444;
            color: #fff;
            border-color: #666;
        }

        /* Tooltip */
        #itemTooltip {
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid #666;
            padding: 10px;
            border-radius: 5px;
            color: #fff;
            pointer-events: none;
            display: none;
            z-index: 1000;
            min-width: 200px;
            box-shadow: 0 0 10px rgba(0,0,0,0.8);
        }

        .tooltip-header {
            font-weight: bold;
            margin-bottom: 5px;
            border-bottom: 1px solid #444;
            padding-bottom: 5px;
        }

        .tooltip-stat {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 2px;
        }

        .stat-better {
            color: #00ff00;
        }

        .stat-worse {
            color: #ff0000;
        }
    </style>
"@
# Regex replace for CSS
$content = $content -replace "        }\s*</style>", $css

# HTML Tabs
$tabs = @"
                <h3 style="margin-top: 20px; border-bottom: 1px solid #444;">Inventory</h3>
                <div class="inv-tabs">
                    <button class="inv-tab-btn active" onclick="switchInventoryTab('all')">All</button>
                    <button class="inv-tab-btn" onclick="switchInventoryTab('weapon')">Weapons</button>
                    <button class="inv-tab-btn" onclick="switchInventoryTab('armor')">Armor</button>
                    <button class="inv-tab-btn" onclick="switchInventoryTab('accessory')">Accessories</button>
                </div>
                <div id="inventoryList"
"@
$content = $content -replace '<h3 style="margin-top: 20px; border-bottom: 1px solid #444;">Inventory</h3>\s*<div id="inventoryList"', $tabs

# HTML Tooltip
$content = $content -replace '<canvas id="gameCanvas">', '<div id="itemTooltip"></div><canvas id="gameCanvas">'

# JS State
$content = $content -replace 'let currentQuest = null;', 'let currentQuest = null; let currentInventoryTab = "all";'

# JS Functions
$newFuncs = @"
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

        function updateInventoryUI() {
            const list = document.getElementById('inventoryList');
            list.innerHTML = '';

            const filteredInventory = player.inventory.map((item, index) => ({ item, index })).filter(({ item }) => {
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

                    if (item.stats.attack) statsStr += 'ATK: +' + item.stats.attack + ' ';
                    if (item.stats.speed) statsStr += 'SPD: +' + item.stats.speed.toFixed(2) + ' ';
                    if (item.stats.maxHp) statsStr += 'HP: +' + item.stats.maxHp + ' ';
                    if (item.stats.defense) statsStr += 'DEF: +' + item.stats.defense + ' ';
                    if (item.stats.critRate) statsStr += 'CRIT %: +' + (item.stats.critRate * 100).toFixed(1) + '% ';
                    if (item.stats.critDamage) statsStr += 'CRIT DMG: +' + item.stats.critDamage.toFixed(1) + ' ';

                    div.innerHTML = '<div><span class="inv-name" style="color:' + item.color + '">' + item.name + '</span><span style="color:#666; font-size:10px;">' + statsStr + '</span></div><button class="inv-btn" onclick="equipItem(' + index + ')">EQUIP</button>';
                    list.appendChild(div);
                });
            }

            // Update Equipped
            const eqWeapon = document.getElementById('eq-weapon');
            const eqArmor = document.getElementById('eq-armor');
            const eqAccessory = document.getElementById('eq-accessory');

            if (player.equipment.weapon) {
                eqWeapon.innerHTML = '<span style="color:' + player.equipment.weapon.color + '">' + player.equipment.weapon.name + '</span><button class="unequip-btn" onclick="unequipItem(\'' + 'weapon' + '\')">X</button>';
            } else {
                eqWeapon.textContent = 'None';
            }

            if (player.equipment.armor) {
                eqArmor.innerHTML = '<span style="color:' + player.equipment.armor.color + '">' + player.equipment.armor.name + '</span><button class="unequip-btn" onclick="unequipItem(\'' + 'armor' + '\')">X</button>';
            } else {
                eqArmor.textContent = 'None';
            }

            if (player.equipment.accessory) {
                eqAccessory.innerHTML = '<span style="color:' + player.equipment.accessory.color + '">' + player.equipment.accessory.name + '</span><button class="unequip-btn" onclick="unequipItem(\'' + 'accessory' + '\')">X</button>';
            } else {
                eqAccessory.textContent = 'None';
            }
        }

        const tooltip = document.getElementById('itemTooltip');

        function showItemTooltip(item, e) {
            tooltip.style.display = 'block';
            moveItemTooltip(e);

            const equipped = player.equipment[item.slot];
            let content = '<div class="tooltip-header" style="color:' + item.color + '">' + item.name + '</div>';
            
            // Helper to compare stats
            const compare = (label, val, eqVal, isPercent = false) => {
                if (!val && !eqVal) return '';
                const v = val || 0;
                const ev = eqVal || 0;
                const diff = v - ev;
                const diffStr = isPercent ? (diff * 100).toFixed(1) + '%' : diff.toFixed(1);
                const valStr = isPercent ? (v * 100).toFixed(1) + '%' : v.toFixed(1);
                
                let diffHtml = '';
                if (diff > 0.001) diffHtml = '<span class="stat-better"> (+' + diffStr + ' ↑)</span>';
                else if (diff < -0.001) diffHtml = '<span class="stat-worse"> (' + diffStr + ' ↓)</span>';
                
                return '<div class="tooltip-stat"><span>' + label + ': ' + valStr + '</span>' + diffHtml + '</div>';
            };

            const eqStats = equipped ? equipped.stats : {};
            
            content += compare('Attack', item.stats.attack, eqStats.attack);
            content += compare('Defense', item.stats.defense, eqStats.defense);
            content += compare('Speed', item.stats.speed, eqStats.speed);
            content += compare('Max HP', item.stats.maxHp, eqStats.maxHp);
            content += compare('Crit Rate', item.stats.critRate, eqStats.critRate, true);
            content += compare('Crit Dmg', item.stats.critDamage, eqStats.critDamage, true);

            if (equipped) {
                content += '<div style="margin-top:5px; font-size:10px; color:#aaa;">Comparision with equipped ' + equipped.name + '</div>';
            } else {
                 content += '<div style="margin-top:5px; font-size:10px; color:#aaa;">No item equipped in this slot</div>';
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
"@

$oldFunc = @"
        function updateInventoryUI() {
            const list = document.getElementById('inventoryList');
            list.innerHTML = '';

            if (player.inventory.length === 0) {
                list.innerHTML = '<p style="color:#666;">Inventory is empty.</p>';
            } else {
                player.inventory.forEach((item, index) => {
                    const div = document.createElement('div');
                    div.className = 'inv-item';
                    let statsStr = '';

                    if (item.stats.attack) statsStr += `ATK: +${item.stats.attack} `;
                    if (item.stats.speed) statsStr += `SPD: +${item.stats.speed.toFixed(2)} `;
                    if (item.stats.maxHp) statsStr += `HP: +${item.stats.maxHp} `;
                    if (item.stats.defense) statsStr += `DEF: +${item.stats.defense} `;
                    if (item.stats.critRate) statsStr += `CRIT %: +${(item.stats.critRate * 100).toFixed(1)}% `;
                    if (item.stats.critDamage) statsStr += `CRIT DMG: +${item.stats.critDamage.toFixed(1)} `;

                    div.innerHTML = `<div>
                <span class="inv-name" style="color:${item.color}">${item.name}</span>
                <span style="color:#666; font-size:10px;">${statsStr}</span>
            </div>
            <button class="inv-btn" onclick="equipItem(${index})">EQUIP</button>`;
                    list.appendChild(div);
                });
            }

            // Update Equipped
            const eqWeapon = document.getElementById('eq-weapon');
            const eqArmor = document.getElementById('eq-armor');
            const eqAccessory = document.getElementById('eq-accessory');

            if (player.equipment.weapon) {
                eqWeapon.innerHTML = `<span style="color:${player.equipment.weapon.color}">${player.equipment.weapon.name}</span>
            <button class="unequip-btn" onclick="unequipItem('weapon')">X</button>`;
            } else {
                eqWeapon.textContent = 'None';
            }

            if (player.equipment.armor) {
                eqArmor.innerHTML = `<span style="color:${player.equipment.armor.color}">${player.equipment.armor.name}</span>
            <button class="unequip-btn" onclick="unequipItem('armor')">X</button>`;
            } else {
                eqArmor.textContent = 'None';
            }

            if (player.equipment.accessory) {
                eqAccessory.innerHTML = `<span style="color:${player.equipment.accessory.color}">${player.equipment.accessory.name}</span>
            <button class="unequip-btn" onclick="unequipItem('accessory')">X</button>`;
            } else {
                eqAccessory.textContent = 'None';
            }
        }
"@

# Replace backticks in oldFunc with proper PS string if needed, but here-string should handle it.
# Actually, the file content has backticks. The here-string preserves them.
# But in PowerShell, backtick is escape char.
# I need to escape backticks in the here-string if they are meant to be literal backticks?
# No, inside @" "@, backticks are literal unless before a variable.
# But wait, the file content has `${...}` which PS might try to interpolate.
# I should use single quote here-string @' '@ to avoid interpolation.

$oldFunc = @'
        function updateInventoryUI() {
            const list = document.getElementById('inventoryList');
            list.innerHTML = '';

            if (player.inventory.length === 0) {
                list.innerHTML = '<p style="color:#666;">Inventory is empty.</p>';
            } else {
                player.inventory.forEach((item, index) => {
                    const div = document.createElement('div');
                    div.className = 'inv-item';
                    let statsStr = '';

                    if (item.stats.attack) statsStr += `ATK: +${item.stats.attack} `;
                    if (item.stats.speed) statsStr += `SPD: +${item.stats.speed.toFixed(2)} `;
                    if (item.stats.maxHp) statsStr += `HP: +${item.stats.maxHp} `;
                    if (item.stats.defense) statsStr += `DEF: +${item.stats.defense} `;
                    if (item.stats.critRate) statsStr += `CRIT %: +${(item.stats.critRate * 100).toFixed(1)}% `;
                    if (item.stats.critDamage) statsStr += `CRIT DMG: +${item.stats.critDamage.toFixed(1)} `;

                    div.innerHTML = `<div>
                <span class="inv-name" style="color:${item.color}">${item.name}</span>
                <span style="color:#666; font-size:10px;">${statsStr}</span>
            </div>
            <button class="inv-btn" onclick="equipItem(${index})">EQUIP</button>`;
                    list.appendChild(div);
                });
            }

            // Update Equipped
            const eqWeapon = document.getElementById('eq-weapon');
            const eqArmor = document.getElementById('eq-armor');
            const eqAccessory = document.getElementById('eq-accessory');

            if (player.equipment.weapon) {
                eqWeapon.innerHTML = `<span style="color:${player.equipment.weapon.color}">${player.equipment.weapon.name}</span>
            <button class="unequip-btn" onclick="unequipItem('weapon')">X</button>`;
            } else {
                eqWeapon.textContent = 'None';
            }

            if (player.equipment.armor) {
                eqArmor.innerHTML = `<span style="color:${player.equipment.armor.color}">${player.equipment.armor.name}</span>
            <button class="unequip-btn" onclick="unequipItem('armor')">X</button>`;
            } else {
                eqArmor.textContent = 'None';
            }

            if (player.equipment.accessory) {
                eqAccessory.innerHTML = `<span style="color:${player.equipment.accessory.color}">${player.equipment.accessory.name}</span>
            <button class="unequip-btn" onclick="unequipItem('accessory')">X</button>`;
            } else {
                eqAccessory.textContent = 'None';
            }
        }
'@

$content = $content.Replace($oldFunc, $newFuncs)

Set-Content -Path $path -Value $content -Encoding UTF8
