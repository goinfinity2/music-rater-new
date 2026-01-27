let allTracks = [];
let allAlbums = [];
let allArtists = [];
let currentTab = 'tracks';
let viewMode = 'list';
let reorderItems = [];
let reorderType = '';

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function loadData() {
    const session = await checkAuth();
    if (!session) return;

    const { data: tracks } = await supabaseClient.from('tracks').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    allTracks = tracks || [];

    const { data: albums } = await supabaseClient.from('albums').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    allAlbums = albums || [];

    const { data: artists } = await supabaseClient.from('artists').select('*').eq('user_id', session.user.id).order('name');
    allArtists = artists || [];

    populateFilters();
    updateStats();
    applyFilters();
}

function populateFilters() {
    const artistFilter = document.getElementById('artist-filter');
    if(artistFilter) {
        artistFilter.innerHTML = '<option value="all">Все артисты</option>' + allArtists.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    }
    const albumFilter = document.getElementById('album-filter');
    if(albumFilter) {
        albumFilter.innerHTML = '<option value="all">Все альбомы</option><option value="no-album">Без альбома</option>' + allAlbums.map(a => `<option value="${a.id}">${a.title}</option>`).join('');
    }
}

// ... Вставь функции getScoreColor, getScoreClass, updateStats из прошлых версий ...
function getScoreClass(score) { return `score-${Math.min(10, Math.max(1, Math.round(score)))}`; }
function getScoreColor(score) { /* (Код цветов, он у тебя есть) */ if(score>=9.5) return '#00ff00'; return '#ff0000'; } // Сократил для примера
function updateStats() { /* (Код статистики) */ }

function updateReorderButton() {
    const reorderBtn = document.getElementById('reorder-btn');
    if (!reorderBtn) return;
    let sortSelect = currentTab === 'tracks' ? document.getElementById('sort-select').value : 
                     currentTab === 'albums' ? document.getElementById('albums-sort-select').value : 
                     document.getElementById('artists-sort-select').value;
    reorderBtn.classList.toggle('hidden', !(sortSelect === 'score-desc' || sortSelect === 'score-asc'));
}

function applyFilters() {
    updateReorderButton();
    if (currentTab === 'tracks') applyTracksFilters();
    else if (currentTab === 'albums') applyAlbumsFilters();
    else applyArtistsFilters();
}

// ... applyTracksFilters, applyAlbumsFilters, applyArtistsFilters ...
// В applyAlbumsFilters добавь вызов renderAlbums(filtered)

function renderAlbums(albums) {
    const list = document.getElementById('albums-list');
    const empty = document.getElementById('empty-albums');
    
    // ВАЖНО: Переключение классов для вида
    list.className = viewMode === 'list' ? 'albums-list-view' : 'albums-grid';

    if (albums.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    list.innerHTML = albums.map(album => {
        // Подсчет средней...
        const tracks = allTracks.filter(t => t.album_id === album.id);
        const avg = tracks.length > 0 ? (tracks.reduce((s,t)=>s+t.total_score,0)/tracks.length).toFixed(1) : '—';
        const cover = album.image_url ? `<img src="${album.image_url}">` : '💿';
        const artist = allArtists.find(a => a.id === album.artist_id);

        // РАЗНЫЙ HTML ДЛЯ РАЗНЫХ ВИДОВ
        if (viewMode === 'list') {
            return `
                <div class="album-card" data-id="${album.id}">
                    <div class="album-cover">${cover}</div>
                    <div class="album-info">
                        <div class="album-title">${album.title}</div>
                        <div class="album-artist">${artist?.name || ''}</div>
                    </div>
                    <div class="album-score ${getScoreClass(avg)}">${avg}</div>
                </div>
            `;
        } else {
            return `
                <div class="album-card" data-id="${album.id}">
                    <div class="album-cover">${cover}</div>
                    <div class="album-title">${album.title}</div>
                    <div class="album-artist">${artist?.name || ''}</div>
                    <div class="album-score ${getScoreClass(avg)}">${avg}</div>
                </div>
            `;
        }
    }).join('');
    
    list.querySelectorAll('.album-card').forEach(c => c.addEventListener('click', () => window.location.href=`album.html?id=${c.dataset.id}`));
}

// ===== ИСПРАВЛЕННЫЙ DRAG & DROP =====
function initDragAndDrop() {
    const list = document.getElementById('reorder-list');
    let draggedItem = null;

    list.querySelectorAll('.reorder-handle').forEach(handle => {
        const item = handle.closest('.reorder-item');
        
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            draggedItem = item;
            item.classList.add('dragging');
            item.draggable = true;
        });

        // ВАЖНО: Начало тача ТОЛЬКО на ручке
        handle.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Блокируем скролл при касании ручки
            draggedItem = item;
            item.classList.add('dragging');
        }, { passive: false });
    });

    // Touch move на списке (сработает только если есть draggedItem)
    list.addEventListener('touchmove', (e) => {
        if (!draggedItem) return; // Если не тянем - даем скроллить
        e.preventDefault(); // Блокируем скролл если тянем
        
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.reorder-item');
        
        if (target && target !== draggedItem) {
            const rect = target.getBoundingClientRect();
            if (touch.clientY < rect.top + rect.height / 2) {
                target.parentNode.insertBefore(draggedItem, target);
            } else {
                target.parentNode.insertBefore(draggedItem, target.nextSibling);
            }
        }
    }, { passive: false });

    list.addEventListener('touchend', () => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            updatePositions();
        }
    });
}

// Остальные функции (renderTracks, openTrackModal, Event Listeners) оставь как были,
// но убедись что viewToggle меняет viewMode и вызывает applyFilters()
document.getElementById('view-toggle').addEventListener('click', () => {
    viewMode = viewMode === 'list' ? 'grid' : 'list';
    document.getElementById('view-toggle').textContent = viewMode === 'list' ? '▦' : '☰';
    applyFilters(); // Это перерисует и треки, и альбомы в новом виде
});

loadData();