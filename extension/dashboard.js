const API_URL = 'http://localhost:3000/api';
let currentIndex = -1;

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/user`);
        const user = await response.json();
        document.getElementById('token-balance').innerText = user.token_balance || 0;
        document.getElementById('streak').innerText = user.current_streak || 0;
        
        // Aplica o tema ativo salvo, se houver
        if (user.active_theme) {
            applyTheme(user.active_theme);
        }
    } catch (err) {
        console.error("Erro ao carregar perfil:", err);
    }
}

async function loadDailyGoal() {
    try {
        const response = await fetch(`${API_URL}/daily-goal`);
        const data = await response.json();
        
        const tracker = document.getElementById('goal-tracker');
        tracker.innerHTML = '';
        
        for (let i = 0; i < data.daily_target; i++) {
            const block = document.createElement('div');
            block.className = 'goal-block';
            if (i < data.drained_today) {
                block.classList.add('filled');
            }
            tracker.appendChild(block);
        }
    } catch (err) {
        console.error("Erro ao carregar meta:", err);
    }
}

async function loadVideos() {
    try {
        const response = await fetch(`${API_URL}/videos`);
        const videos = await response.json();
        renderGrid(videos);
        currentIndex = 0;
        updateFocus();
    } catch (err) {
        document.getElementById('video-grid').innerHTML = '<p style="color:var(--neon-red)">Falha de conexão com a API.</p>';
    }
}

function renderGrid(videos) {
    const grid = document.getElementById('video-grid');
    document.getElementById('count').innerText = videos.length;
    grid.innerHTML = '';
    
    videos.forEach(vid => {
        const card = document.createElement('div');
        const isPerishable = vid.lifecycle_type === 'PERISHABLE';
        card.className = `card ${isPerishable ? 'perishable' : 'timeless'}`;
        card.id = `card-${vid.id}`;
        
        card.innerHTML = `
            <div class="thumb" style="background-image: url('${vid.thumbnail_url}')"></div>
            <div class="info">
                <div class="card-header-tags">
                    <div class="dir-tag">[ DIR: <span>${vid.category}</span> ]</div>
                    <div class="life-status ${isPerishable ? 'perishable' : 'timeless'}">
                        ${isPerishable ? ' Perecível' : ' Atemporal'}
                    </div>
                </div>
                <h3>${vid.title}</h3>
            </div>
            <div class="actions">
                <button class="btn btn-erase" data-action="ERASE" data-id="${vid.id}" data-url="${vid.url}">Apagar</button>
                <button class="btn btn-drain" data-action="DRAIN" data-id="${vid.id}" data-url="${vid.url}">Drenar</button>
            </div>
        `;

        card.querySelector('.btn-erase').addEventListener('click', () => {
            processVideo(vid.id, 'ERASE', vid.url);
        });

        card.querySelector('.btn-drain').addEventListener('click', () => {
            processVideo(vid.id, 'DRAIN', vid.url);
        });

        grid.appendChild(card);
    });
}

async function processVideo(id, action, url) {
    const card = document.getElementById(`card-${id}`);
    card.classList.add('processing');
    
    try {
        const response = await fetch(`${API_URL}/videos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action })
        });
        
        const data = await response.json();
        
        if (data.tokens_earned > 0) {
            const tokenEl = document.getElementById('token-balance');
            const currentTokens = parseInt(tokenEl.innerText);
            tokenEl.innerText = currentTokens + data.tokens_earned;
            
            tokenEl.classList.remove('token-pop');
            void tokenEl.offsetWidth;
            tokenEl.classList.add('token-pop');
        }

        if (action === 'DRAIN') {
            window.open(url, '_blank');
            loadDailyGoal();
        }
        
        loadUserProfile();
        
        setTimeout(() => {
            card.remove();
            const countEl = document.getElementById('count');
            countEl.innerText = parseInt(countEl.innerText) - 1;
            updateFocus();
        }, 200);

    } catch (err) {
        console.error("Erro ao processar:", err);
        card.classList.remove('processing');
    }
}

function updateFocus() {
    const cards = document.querySelectorAll('.card:not(.processing)');
    if (cards.length === 0) return;

    cards.forEach(c => c.classList.remove('active-focus'));

    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex >= cards.length) currentIndex = cards.length - 1;

    const activeCard = cards[currentIndex];
    activeCard.classList.add('active-focus');
    activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

window.addEventListener('keydown', (e) => {
    if (document.getElementById('shop-modal').style.display === 'flex') return;
    
    const cards = document.querySelectorAll('.card:not(.processing)');
    if (cards.length === 0) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        currentIndex++;
        updateFocus();
        e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        currentIndex--;
        updateFocus();
        e.preventDefault();
    } else if (e.key === 'Enter' && currentIndex >= 0) {
        cards[currentIndex].querySelector('.btn-drain').click();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && currentIndex >= 0) {
        cards[currentIndex].querySelector('.btn-erase').click();
    }
});

const shopModal = document.getElementById('shop-modal');
document.getElementById('open-shop-btn').addEventListener('click', () => {
    shopModal.style.display = 'flex';
    loadShopItems();
});
document.getElementById('close-shop-btn').addEventListener('click', () => {
    shopModal.style.display = 'none';
});

async function loadShopItems() {
    try {
        const res = await fetch(`${API_URL}/shop`);
        const items = await res.json();
        const grid = document.getElementById('shop-items-grid');
        grid.innerHTML = '';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.innerHTML = `
                <h3>${item.name}</h3>
                <p style="font-size: 12px; color: var(--text-dim); margin-bottom: 12px;">Custo: ${item.cost} Tokens</p>
                <button class="btn ${item.unlocked ? 'btn-drain' : 'btn-erase'}" style="width:100%; border: 1px solid var(--border);"
                    data-id="${item.id}" data-unlocked="${item.unlocked}" data-value="${item.value}">
                    ${item.unlocked ? 'Ativar / Equipado' : 'Desbloquear'}
                </button>
            `;
            
            card.querySelector('button').addEventListener('click', (e) => {
                const btn = e.target;
                buyItem(btn.dataset.id, btn.dataset.unlocked === "1", btn.dataset.value);
            });
            
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Erro ao carregar a loja:", err);
    }
}

async function buyItem(itemId, isUnlocked, themeValue) {
    if (isUnlocked) {
        applyTheme(themeValue);
        fetch(`${API_URL}/shop/equip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ themeValue })
        });
        return;
    }

    try {
        const res = await fetch(`${API_URL}/shop/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId })
        });
        const data = await res.json();

        if (data.success) {
            alert("Modificação aplicada com sucesso!");
            loadUserProfile();
            loadShopItems();
            applyTheme(data.theme_value);
        } else {
            alert(data.error || "Erro na transação.");
        }
    } catch (err) {
        console.error("Erro na transação:", err);
    }
}

function applyTheme(colorHex) {
    document.documentElement.style.setProperty('--theme-color', colorHex);
}

// ====== DEV TOOLS ======
async function runDevCommand(action) {
    try {
        await fetch(`${API_URL}/dev/${action}`, { method: 'POST' });
        loadUserProfile();
        loadDailyGoal();
    } catch (err) {
        console.error("Erro no comando Dev:", err);
    }
}

document.getElementById('dev-add-tokens').addEventListener('click', () => runDevCommand('add-tokens'));
document.getElementById('dev-reset-tokens').addEventListener('click', () => runDevCommand('reset-tokens'));
document.getElementById('dev-add-streak').addEventListener('click', () => runDevCommand('add-streak'));
document.getElementById('dev-break-streak').addEventListener('click', () => runDevCommand('break-streak'));

// Init
loadUserProfile();
loadDailyGoal();
loadVideos();
