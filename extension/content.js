(function() {
    if (window !== window.top) return;

    const isFirefox = typeof browser !== 'undefined' || navigator.userAgent.indexOf('Firefox') > -1;

    function safeFetch(url, options = {}) {
        if (isFirefox) {
            return fetch(url, options);
        } else {
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'proxyFetch',
                    url: url,
                    method: options.method || 'GET',
                    headers: options.headers,
                    body: options.body ? JSON.parse(options.body) : undefined
                }, response => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.success) {
                        resolve({
                            json: () => Promise.resolve(response.data)
                        });
                    } else {
                        reject(new Error(response?.error || 'Erro no proxyFetch'));
                    }
                });
            });
        }
    }

    function createModalStructure() {
        if (document.getElementById('drainfeed-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'drainfeed-overlay';
        overlay.innerHTML = `
            <div class="drainfeed-modal">
                <div class="drainfeed-header">
                    <h2>Drainfeed</h2>
                    <span style="color: #8b919a; font-size: 12px;">Tanque: Checando...</span>
                </div>
                <div class="drainfeed-video-preview">
                    <div class="drainfeed-thumbnail" id="df-thumb"></div>
                    <div class="drainfeed-video-info">
                        <h3 id="df-title">Carregando...</h3>
                    </div>
                </div>
                <div class="drainfeed-form-group">
                    <label>Ciclo de Vida</label>
                    <div class="drainfeed-selection-grid">
                        <button class="drainfeed-btn-select active" id="df-btn-perecivel">⏳ Perecível</button>
                        <button class="drainfeed-btn-select" id="df-btn-atemporal">♾️ Atemporal</button>
                    </div>
                </div>
                <div class="drainfeed-form-group">
                    <label>Categoria</label>
                    <select class="drainfeed-select" id="df-category">
                        <option>Estudo & Código</option>
                        <option>Entretenimento</option>
                        <option>Notícias & Mundo</option>
                    </select>
                </div>
                <div class="drainfeed-actions">
                    <button class="drainfeed-btn-secondary" id="df-btn-cancel">Cancelar</button>
                    <button class="drainfeed-btn-primary" id="df-btn-add">Listar</button>
                </div>
                <div class="drainfeed-system-msg" id="df-msg">Conteúdo adicionado ao tanque com sucesso.</div>
            </div>
        `;
        document.body.appendChild(overlay);
        setupModalEvents();
    }

    function setupModalEvents() {
        const overlay = document.getElementById('drainfeed-overlay');
        const btnCancel = document.getElementById('df-btn-cancel');
        const btnAdd = document.getElementById('df-btn-add');
        const btnPerecivel = document.getElementById('df-btn-perecivel');
        const btnAtemporal = document.getElementById('df-btn-atemporal');
        const msg = document.getElementById('df-msg');

        const closeModal = () => {
            overlay.classList.add('closing');
            setTimeout(() => {
                overlay.classList.remove('active', 'closing');
                msg.style.display = 'none';
                btnAdd.textContent = 'LISTAR';
                btnAdd.style.opacity = '1';
            }, 150);
        };

        btnCancel.onclick = closeModal;
        btnPerecivel.onclick = () => { btnPerecivel.classList.add('active'); btnAtemporal.classList.remove('active'); };
        btnAtemporal.onclick = () => { btnAtemporal.classList.add('active'); btnPerecivel.classList.remove('active'); };

        btnAdd.onclick = () => {
            btnAdd.textContent = 'ENCHENDO...';
            btnAdd.style.opacity = '0.7';

            const isPerecivel = btnPerecivel.classList.contains('active');
            const categoryValue = document.getElementById('df-category').value;
            const videoTitle = document.getElementById('df-title').innerText;
            const thumbBg = document.getElementById('df-thumb').style.backgroundImage;
            const thumbUrl = thumbBg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');

            const payload = {
                title: videoTitle,
                url: window.location.href,
                thumbnail_url: thumbUrl,
                lifecycle_type: isPerecivel ? 'PERISHABLE' : 'TIMELESS',
                category: categoryValue
            };

            safeFetch('http://localhost:3000/api/videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    msg.textContent = "Conteúdo adicionado ao tanque com sucesso.";
                    msg.style.borderLeftColor = "#9D00FF";
                    msg.style.color = "#9D00FF";
                    msg.style.display = 'block';
                    btnAdd.textContent = 'LISTADO';
                    setTimeout(closeModal, 1000);
                } else if (data.capacity_reached) {
                    msg.textContent = "TANQUE CHEIO. Apague vídeos no Dashboard para liberar espaço.";
                    msg.style.borderLeftColor = "#FF0055";
                    msg.style.color = "#FF0055";
                    msg.style.display = 'block';
                    btnAdd.textContent = 'BLOQUEADO';
                }
            })
            .catch(error => {
                console.error("Erro no Drainfeed:", error);
                msg.textContent = "Erro ao conectar com o Tanque.";
                msg.style.borderLeftColor = "#fb7185";
                msg.style.color = "#fb7185";
                msg.style.display = 'block';
                btnAdd.textContent = 'FALHA';
            });
        };
    }

    async function openDrainfeedModal() {
        createModalStructure();
        const overlay = document.getElementById('drainfeed-overlay');
        const msg = document.getElementById('df-msg');
        const btnAdd = document.getElementById('df-btn-add');
        const headerCapacity = document.querySelector('.drainfeed-header span');
        
        overlay.classList.add('active');
        msg.style.display = 'none';
        btnAdd.style.display = 'block';

        try {
            const response = await safeFetch('http://localhost:3000/api/videos');
            const videos = await response.json();
            const currentCapacity = videos.length;
            
            headerCapacity.innerText = `Tanque: ${currentCapacity}/50`;

            if (currentCapacity >= 50) {
                headerCapacity.style.color = '#FF0055';
                msg.textContent = "[!] TANQUE CHEIO. Apague vídeos no Dashboard para liberar espaço.";
                msg.style.borderLeftColor = "#FF0055";
                msg.style.color = "#FF0055";
                msg.style.display = 'block';
                btnAdd.style.display = 'none';
            } else {
                headerCapacity.style.color = '#8b919a';
            }
        } catch (err) {
            headerCapacity.innerText = "Tanque: Offline";
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');
        const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        
        const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
        const videoTitle = titleElement ? titleElement.innerText : "Vídeo do YouTube";

        document.getElementById('df-title').innerText = videoTitle;
        document.getElementById('df-thumb').style.backgroundImage = `url('${thumbUrl}')`;
    }

    function renderListButton() {
        if (document.querySelector('.drainfeed-btn-list')) return;
        const titleContainer = document.querySelector('ytd-watch-metadata #title');
        if (titleContainer) {
            const btn = document.createElement('button');
            btn.innerText = '⚡ LISTAR';
            btn.className = 'drainfeed-btn-list';
            btn.onclick = openDrainfeedModal;
            titleContainer.parentElement.insertBefore(btn, titleContainer);
        }
    }

    setInterval(renderListButton, 1000);
})();