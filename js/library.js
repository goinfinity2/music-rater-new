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
    if (artistFilter) artistFilter.innerHTML = '<option value="all">Все артисты</option>' + allArtists.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    
    const albumsArtistFilter = document.getElementById('albums-artist-filter');
    if (albumsArtistFilter) albumsArtistFilter.innerHTML = '<option value="all">Все артисты</option>' + allArtists.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    const albumFilter = document.getElementById('album-filter');
    if (albumFilter) albumFilter.innerHTML = '<option value="all">Все альбомы</option><option value="no-album">Без альбома</option>' + allAlbums.map(a => `<option value="${a.id}">${a.title}</option>`).join('');
}

function getScoreClass(score) { return `score-${Math.min(10, Math.max(1, Math.round(score)))}`; }
function getScoreColor(score) {
    if (score >= 9.5) return '#00ff00';
    if (score >= 8.5) return '#40ff00';
    if (score >= 7.5) return '#80ff00';
    if (score >= 6.5) return '#ffff00';
    if (score >= 5.5) return '#ffcc00';
    if (score >= 4.5) return '#ff9900';
    if (score >= 3.5) return '#ff6600';
    if (score >= 2.5) return '#ff3300';
    if (score >= 1.5) return '#ff0000';
    return '#cc0000';
}

function updateStats() {
    const statsBar = document.getElementById('stats-bar');
    if (!statsBar) return;

    if (currentTab === 'tracks') {
        const total = allTracks.length;
        const avgScore = total > 0 ? (allTracks.reduce((sum, t) => sum + t.total_score, 0) / total).toFixed(1) : '—';
        const topScore = total > 0 ? Math.max(...allTracks.map(t => t.total_score)).toFixed(1) : '—';
        statsBar.innerHTML = `<div class="stat"><span>${total}</span><small>треков</small></div><div class="stat"><span style="color: ${getScoreColor(parseFloat(avgScore))}">${avgScore}</span><small>средняя</small></div><div class="stat"><span style="color: ${getScoreColor(parseFloat(topScore))}">${topScore}</span><small>лучшая</small></div>`;
    } else if (currentTab === 'albums') {
        statsBar.innerHTML = `<div class="stat"><span>${allAlbums.length}</span><small>альбомов</small></div><div class="stat"><span>${allTracks.length}</span><small>треков</small></div><div class="stat"><span>${allArtists.length}</span><small>артистов</small></div>`;
    } else {
        statsBar.innerHTML = `<div class="stat"><span>${allArtists.length}</span><small>артистов</small></div><div class="stat"><span>${allAlbums.length}</span><small>альбомов</small></div><div class="stat"><span>${allTracks.length}</span><small>треков</small></div>`;
    }
}

function updateReorderButton() {
    const reorderBtn = document.getElementById('reorder-btn');
    if (!reorderBtn) return;
    let sortSelect = currentTab === 'tracks' ? document.getElementById('sort-select').value : 
                     currentTab === 'albums' ? document.getElementById('albums-sort-select').value : 
                     document.getElementById('artists-sort-select').value;
    const isScoreSort = sortSelect === 'score-desc' || sortSelect === 'score-asc';
    reorderBtn.classList.toggle('hidden', !isScoreSort);
}

function applyFilters() {
    updateReorderButton();
    if (currentTab === 'tracks') applyTracksFilters();
    else if (currentTab === 'albums') applyAlbumsFilters();
    else applyArtistsFilters();
}

function applyTracksFilters() {
    const sortBy = document.getElementById('sort-select').value;
    const artistFilter = document.getElementById('artist-filter').value;
    const albumFilter = document.getElementById('album-filter').value;
    const scoreFilter = document.getElementById('score-filter').value;

    let filtered = [...allTracks];
    if (artistFilter !== 'all') filtered = filtered.filter(t => t.artist_id === artistFilter);
    if (albumFilter === 'no-album') filtered = filtered.filter(t => !t.album_id);
    else if (albumFilter !== 'all') filtered = filtered.filter(t => t.album_id === albumFilter);
    if (scoreFilter !== 'all') {
        if (scoreFilter === 'low') filtered = filtered.filter(t => t.total_score < 5);
        else filtered = filtered.filter(t => t.total_score >= parseFloat(scoreFilter));
    }

    filtered.sort((a, b) => {
        if (sortBy === 'score-desc') return (b.total_score - a.total_score) || (b.custom_order || 0) - (a.custom_order || 0);
        if (sortBy === 'score-asc') return (a.total_score - b.total_score) || (a.custom_order || 0) - (b.custom_order || 0);
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return new Date(b.created_at) - new Date(a.created_at);
    });
    renderTracks(filtered);
}

function getAlbumAvgScore(album) {
    const tracks = allTracks.filter(t => t.album_id === album.id);
    if (tracks.length === 0) return 0;
    return tracks.reduce((sum, t) => sum + t.total_score, 0) / tracks.length;
}

function applyAlbumsFilters() {
    const sortBy = document.getElementById('albums-sort-select').value;
    const artistFilter = document.getElementById('albums-artist-filter').value;
    let filtered = [...allAlbums];
    if (artistFilter !== 'all') filtered = filtered.filter(a => a.artist_id === artistFilter);
    filtered = filtered.map(a => ({ ...a, avgScore: getAlbumAvgScore(a) }));

    filtered.sort((a, b) => {
        if (sortBy === 'score-desc') return (b.avgScore - a.avgScore) || (b.custom_order || 0) - (a.custom_order || 0);
        if (sortBy === 'score-asc') return (a.avgScore - b.avgScore) || (a.custom_order || 0) - (b.custom_order || 0);
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'year') return (b.year || 0) - (a.year || 0);
        return new Date(b.created_at) - new Date(a.created_at);
    });
    renderAlbums(filtered);
}

function applyArtistsFilters() {
    const sortBy = document.getElementById('artists-sort-select').value;
    let filtered = allArtists.map(artist => {
        const tracks = allTracks.filter(t => t.artist_id === artist.id);
        const avgScore = tracks.length > 0 ? tracks.reduce((s, t) => s + t.total_score, 0) / tracks.length : 0;
        return { ...artist, avgScore, trackCount: tracks.length, albumCount: allAlbums.filter(a => a.artist_id === artist.id).length };
    });

    filtered.sort((a, b) => {
        if (sortBy === 'score-desc') return (b.avgScore - a.avgScore) || (b.custom_order || 0) - (a.custom_order || 0);
        if (sortBy === 'score-asc') return (a.avgScore - b.avgScore) || (a.custom_order || 0) - (b.custom_order || 0);
        if (sortBy === 'tracks') return b.trackCount - a.trackCount;
        if (sortBy === 'albums') return b.albumCount - a.albumCount;
        return a.name.localeCompare(b.name);
    });
    renderArtists(filtered);
}

function getTrackCover(track) {
    if (track.image_url) return track.image_url;
    if (track.album_id) return allAlbums.find(a => a.id === track.album_id)?.image_url;
    return null;
}

function renderTracks(tracks) {
    const list = document.getElementById('tracks-list');
    const empty = document.getElementById('empty-tracks');
    list.className = `tracks-list ${viewMode === 'grid' ? 'grid-view' : ''}`;
    if (tracks.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    list.innerHTML = tracks.map(track => {
        const cover = getTrackCover(track);
        const artist = allArtists.find(a => a.id === track.artist_id);
        return `
            <div class="track-card" data-id="${track.id}">
                <div class="track-cover">${cover ? `<img src="${cover}">` : '🎵'}</div>
                <div class="track-info"><div class="track-title">${track.title}</div><div class="track-artist">${artist?.name || track.artist}</div></div>
                <div class="track-score ${getScoreClass(track.total_score)}">${track.total_score.toFixed(1)}</div>
            </div>`;
    }).join('');
    list.querySelectorAll('.track-card').forEach(c => c.addEventListener('click', () => openTrackModal(c.dataset.id)));
}

function renderAlbums(albums) {
    const list = document.getElementById('albums-list');
    const empty = document.getElementById('empty-albums');
    list.className = viewMode === 'list' ? 'albums-list-view' : 'albums-grid';
    if (albums.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    list.innerHTML = albums.map(album => {
        const avg = album.avgScore !== undefined ? album.avgScore : getAlbumAvgScore(album);
        const artist = allArtists.find(a => a.id === album.artist_id);
        const tracksCount = allTracks.filter(t => t.album_id === album.id).length;
        const scoreDisplay = viewMode === 'list' ? avg.toFixed(1) : `${avg.toFixed(1)} (${tracksCount})`;
        return `
            <div class="album-card" data-id="${album.id}">
                <div class="album-cover">${album.image_url ? `<img src="${album.image_url}">` : '💿'}</div>
                <div class="album-info"><div class="album-title">${album.title}</div><div class="album-artist">${artist?.name || ''}</div></div>
                <div class="album-score ${avg > 0 ? getScoreClass(avg) : ''}">${avg > 0 ? scoreDisplay : '—'}</div>
            </div>`;
    }).join('');
    list.querySelectorAll('.album-card').forEach(c => c.addEventListener('click', () => window.location.href=`album.html?id=${c.dataset.id}`));
}

function renderArtists(artists) {
    const list = document.getElementById('artists-list');
    const empty = document.getElementById('empty-artists');
    if (artists.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    list.innerHTML = artists.map(artist => {
        const avg = artist.avgScore !== undefined ? artist.avgScore : 0;
        return `
            <div class="artist-card" data-id="${artist.id}">
                <div class="artist-avatar">${artist.image_url ? `<img src="${artist.image_url}">` : artist.name.charAt(0)}</div>
                <div class="artist-info"><div class="artist-name">${artist.name}</div><div class="artist-stats">${artist.albumCount || 0} альбомов • ${artist.trackCount || 0} треков</div></div>
                <div class="track-score ${avg > 0 ? getScoreClass(avg) : ''}">${avg > 0 ? avg.toFixed(1) : '—'}</div>
            </div>`;
    }).join('');
    list.querySelectorAll('.artist-card').forEach(c => c.addEventListener('click', () => window.location.href=`artist.html?id=${c.dataset.id}`));
}

function openTrackModal(trackId) {
    const track = allTracks.find(t => t.id === trackId);
    if (!track) return;
    const modal = document.getElementById('modal');
    const artist = allArtists.find(a => a.id === track.artist_id);
    const album = allAlbums.find(a => a.id === track.album_id);
    const cover = getTrackCover(track);
    const scoreColor = getScoreColor(track.total_score);
    
    document.getElementById('modal-body').innerHTML = `
        <div class="modal-header">
            <div class="modal-cover">${cover ? `<img src="${cover}">` : '🎵'}</div>
            <div><div class="modal-title">${track.title}</div><div class="modal-artist">${artist?.name || track.artist}</div>${album ? `<div class="modal-album">💿 ${album.title}</div>` : ''}<div class="modal-total" style="color: ${scoreColor}">${track.total_score.toFixed(1)}</div></div>
        </div>
        <div class="modal-scores">
            <div class="score-row"><span class="score-label">Инструментал</span><span class="score-value" style="color: ${getScoreColor(track.instrumental)}">${track.instrumental}</span></div>
            ${track.has_vocals ? `<div class="score-row"><span class="score-label">Харизма</span><span class="score-value" style="color: ${getScoreColor(track.charisma)}">${track.charisma}</span></div>` : ''}
            <div class="score-row"><span class="score-label">Смысл</span><span class="score-value" style="color: ${getScoreColor(track.meaning)}">${track.meaning}</span></div>
            <div class="score-row"><span class="score-label">Вайб</span><span class="score-value" style="color: ${getScoreColor(track.vibe)}">${track.vibe}</span></div>
            <div class="score-row"><span class="score-label">Структура</span><span class="score-value" style="color: ${getScoreColor(track.structure)}">${track.structure}</span></div>
            <div class="score-row"><span class="score-label">Оригинальность</span><span class="score-value" style="color: ${getScoreColor(track.originality)}">${track.originality}</span></div>
            <div class="score-row"><span class="score-label">Репитабельность</span><span class="score-value" style="color: ${getScoreColor(track.replayability)}">${track.replayability}</span></div>
        </div>
        ${track.notes ? `<div class="modal-notes"><strong>Заметки:</strong> ${track.notes}</div>` : ''}
        ${(track.spotify_url || track.youtube_url) ? `
        <div class="modal-links">
            ${track.spotify_url ? `<a href="${track.spotify_url}" target="_blank" class="link-btn spotify">Spotify</a>` : ''}
            ${track.youtube_url ? `<a href="${track.youtube_url}" target="_blank" class="link-btn youtube">YouTube</a>` : ''}
        </div>
        ` : ''}
        <div class="modal-actions-row"><a href="edit-track.html?id=${track.id}" class="btn-edit">✏️ Редактировать</a><button class="btn-delete" onclick="deleteTrack('${track.id}')">🗑️</button></div>
    `;
    modal.classList.remove('hidden');
}

async function deleteTrack(trackId) {
    if (!confirm('Удалить трек?')) return;
    await supabaseClient.from('tracks').delete().eq('id', trackId);
    document.getElementById('modal').classList.add('hidden');
    loadData();
}

// DRAG & DROP
function openReorderModal() {
    const modal = document.getElementById('reorder-modal');
    let items = [];
    if (currentTab === 'tracks') {
        reorderType = 'tracks';
        const sortBy = document.getElementById('sort-select').value;
        items = [...allTracks].sort((a, b) => {
            if (sortBy === 'score-desc') return (b.total_score - a.total_score) || (b.custom_order || 0) - (a.custom_order || 0);
            return (a.total_score - b.total_score) || (a.custom_order || 0) - (b.custom_order || 0);
        }).map(t => ({ id: t.id, title: t.title, subtitle: allArtists.find(a => a.id === t.artist_id)?.name || t.artist, score: t.total_score, cover: getTrackCover(t) }));
    } else if (currentTab === 'albums') {
        reorderType = 'albums';
        const sortBy = document.getElementById('albums-sort-select').value;
        items = [...allAlbums].map(a => ({...a, avgScore: getAlbumAvgScore(a)})).sort((a, b) => {
            if (sortBy === 'score-desc') return (b.avgScore - a.avgScore) || (b.custom_order || 0) - (a.custom_order || 0);
            return (a.avgScore - b.avgScore) || (a.custom_order || 0) - (b.custom_order || 0);
        }).map(a => ({ id: a.id, title: a.title, subtitle: allArtists.find(ar => ar.id === a.artist_id)?.name || '', score: a.avgScore, cover: a.image_url }));
    } else return; 

    document.getElementById('reorder-list').innerHTML = items.map((item, i) => `
        <div class="reorder-item" data-id="${item.id}" data-index="${i}">
            <div class="reorder-handle">☰</div><div class="reorder-position">${i+1}</div>
            <div class="reorder-cover">${item.cover ? `<img src="${item.cover}">` : '🎵'}</div>
            <div class="reorder-info"><div class="reorder-title">${item.title}</div><div class="reorder-subtitle">${item.subtitle}</div></div>
            <div class="reorder-score ${getScoreClass(item.score)}">${item.score.toFixed(1)}</div>
        </div>`).join('');
    
    initDragAndDrop();
    modal.classList.remove('hidden');
}

function initDragAndDrop() {
    const list = document.getElementById('reorder-list');
    let draggedItem = null;
    list.querySelectorAll('.reorder-handle').forEach(handle => {
        const item = handle.closest('.reorder-item');
        handle.addEventListener('mousedown', (e) => { e.preventDefault(); draggedItem = item; item.classList.add('dragging'); item.draggable = true; });
        handle.addEventListener('touchstart', (e) => { e.preventDefault(); draggedItem = item; item.classList.add('dragging'); }, { passive: false });
    });
    list.addEventListener('touchmove', (e) => {
        if (!draggedItem) return;
        e.preventDefault();
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.reorder-item');
        if (target && target !== draggedItem) {
            const rect = target.getBoundingClientRect();
            if (touch.clientY < rect.top + rect.height / 2) target.parentNode.insertBefore(draggedItem, target);
            else target.parentNode.insertBefore(draggedItem, target.nextSibling);
        }
    }, { passive: false });
    list.addEventListener('touchend', () => { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem = null; updatePositions(); } });
    document.addEventListener('mouseup', () => { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem.draggable = false; draggedItem = null; updatePositions(); } });
}

function updatePositions() {
    document.querySelectorAll('.reorder-item').forEach((item, index) => { item.querySelector('.reorder-position').textContent = index + 1; item.dataset.index = index; });
}

async function saveOrder() {
    const items = document.querySelectorAll('.reorder-item');
    const maxOrder = items.length;
    document.getElementById('reorder-modal').classList.add('hidden');
    for (const item of items) {
        await supabaseClient.from(reorderType).update({ custom_order: maxOrder - parseInt(item.dataset.index) }).eq('id', item.dataset.id);
    }
    loadData();
}

// EVENT LISTENERS
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        document.getElementById('tracks-section').classList.toggle('hidden', currentTab !== 'tracks');
        document.getElementById('albums-section').classList.toggle('hidden', currentTab !== 'albums');
        document.getElementById('artists-section').classList.toggle('hidden', currentTab !== 'artists');
        document.getElementById('tracks-filters').classList.toggle('hidden', currentTab !== 'tracks');
        document.getElementById('albums-filters').classList.toggle('hidden', currentTab !== 'albums');
        document.getElementById('artists-filters').classList.toggle('hidden', currentTab !== 'artists');
        updateStats();
        applyFilters();
    });
});

document.getElementById('sort-select').addEventListener('change', applyFilters);
document.getElementById('artist-filter').addEventListener('change', applyFilters);
document.getElementById('album-filter').addEventListener('change', applyFilters);
document.getElementById('score-filter').addEventListener('change', applyFilters);
document.getElementById('albums-sort-select').addEventListener('change', applyFilters);
document.getElementById('albums-artist-filter').addEventListener('change', applyFilters);
document.getElementById('artists-sort-select').addEventListener('change', applyFilters);

document.getElementById('view-toggle').addEventListener('click', () => {
    viewMode = viewMode === 'list' ? 'grid' : 'list';
    document.getElementById('view-toggle').textContent = viewMode === 'list' ? '▦' : '☰';
    applyFilters();
});

document.getElementById('reorder-btn').addEventListener('click', openReorderModal);
document.getElementById('save-order-btn').addEventListener('click', saveOrder);
document.getElementById('reorder-modal-close').addEventListener('click', () => document.getElementById('reorder-modal').classList.add('hidden'));
document.getElementById('fab-btn').addEventListener('click', () => document.getElementById('fab-menu').classList.toggle('hidden'));
document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal').classList.add('hidden'));
document.getElementById('modal').addEventListener('click', (e) => { if(e.target.id === 'modal') document.getElementById('modal').classList.add('hidden'); });
document.getElementById('menu-btn')?.addEventListener('click', () => document.getElementById('menu-dropdown').classList.toggle('hidden'));
document.addEventListener('click', (e) => { if (!e.target.closest('#menu-btn') && !e.target.closest('#menu-dropdown')) document.getElementById('menu-dropdown')?.classList.add('hidden'); });
document.getElementById('logout-btn')?.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; });

loadData();