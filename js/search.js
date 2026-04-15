let allTracks = [];
let allAlbums = [];
let allArtists = [];

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

    const { data: tracks } = await supabaseClient
        .from('tracks')
        .select('*')
        .eq('user_id', session.user.id);
    allTracks = tracks || [];

    const { data: albums } = await supabaseClient
        .from('albums')
        .select('*')
        .eq('user_id', session.user.id);
    allAlbums = albums || [];

    const { data: artists } = await supabaseClient
        .from('artists')
        .select('*')
        .eq('user_id', session.user.id);
    allArtists = artists || [];
}

function getScoreColor(score) {
    if (score >= 8) return '#22c55e';
    if (score >= 7) return '#eab308';
    if (score >= 5) return '#f97316';
    return '#ef4444';
}

function getScoreClass(score) {
    return `score-${Math.min(10, Math.max(1, Math.round(score)))}`;
}

function getTrackCover(track) {
    if (track.image_url) return track.image_url;
    if (track.album_id) {
        const album = allAlbums.find(a => a.id === track.album_id);
        if (album?.image_url) return album.image_url;
    }
    return null;
}

function search(query) {
    const results = document.getElementById('search-results');
    
    if (!query.trim()) {
        results.innerHTML = '<p class="search-hint">Начни вводить для поиска</p>';
        return;
    }

    const q = query.toLowerCase();

    const matchedTracks = allTracks.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.artist.toLowerCase().includes(q)
    );

    const matchedAlbums = allAlbums.filter(a => 
        a.title.toLowerCase().includes(q) || 
        a.artist?.toLowerCase().includes(q)
    );

    const matchedArtists = allArtists.filter(a => 
        a.name.toLowerCase().includes(q)
    );

    if (matchedTracks.length === 0 && matchedAlbums.length === 0 && matchedArtists.length === 0) {
        results.innerHTML = '<p class="search-hint">Ничего не найдено</p>';
        return;
    }

    let html = '';

    if (matchedArtists.length > 0) {
        html += '<h3 class="search-section">🎤 Артисты</h3>';
        html += matchedArtists.slice(0, 5).map(artist => `
            <a href="artist.html?id=${artist.id}" class="search-item">
                <div class="search-icon">${artist.image_url ? `<img src="${artist.image_url}">` : artist.name.charAt(0)}</div>
                <div class="search-info">
                    <div class="search-title">${artist.name}</div>
                </div>
            </a>
        `).join('');
    }

    if (matchedAlbums.length > 0) {
        html += '<h3 class="search-section">💿 Альбомы</h3>';
        html += matchedAlbums.slice(0, 5).map(album => {
            const artist = allArtists.find(a => a.id === album.artist_id);
            return `
                <a href="album.html?id=${album.id}" class="search-item">
                    <div class="search-icon">${album.image_url ? `<img src="${album.image_url}">` : '💿'}</div>
                    <div class="search-info">
                        <div class="search-title">${album.title}</div>
                        <div class="search-subtitle">${artist?.name || album.artist}</div>
                    </div>
                </a>
            `;
        }).join('');
    }

    if (matchedTracks.length > 0) {
        html += '<h3 class="search-section">🎵 Треки</h3>';
        html += matchedTracks.slice(0, 10).map(track => {
            const artist = allArtists.find(a => a.id === track.artist_id);
            const coverUrl = getTrackCover(track);
            return `
                <div class="search-item" data-id="${track.id}">
                    <div class="search-icon">${coverUrl ? `<img src="${coverUrl}">` : '🎵'}</div>
                    <div class="search-info">
                        <div class="search-title">${track.title}</div>
                        <div class="search-subtitle">${artist?.name || track.artist}</div>
                    </div>
                    <span class="search-score ${getScoreClass(track.total_score)}">${track.total_score.toFixed(1)}</span>
                </div>
            `;
        }).join('');
    }

    results.innerHTML = html;

    // Обработчики для треков
    results.querySelectorAll('.search-item[data-id]').forEach(item => {
        item.addEventListener('click', () => openTrackModal(item.dataset.id));
    });
}

function openTrackModal(trackId) {
    const track = allTracks.find(t => t.id === trackId);
    if (!track) return;

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const coverUrl = getTrackCover(track);
    const cover = coverUrl ? `<img src="${coverUrl}" alt="">` : '🎵';
    const artist = allArtists.find(a => a.id === track.artist_id);
    const album = allAlbums.find(a => a.id === track.album_id);
    const scoreColor = getScoreColor(track.total_score);

    body.innerHTML = `
        <div class="modal-header">
            <div class="modal-cover">${cover}</div>
            <div>
                <div class="modal-title">${track.title}</div>
                <div class="modal-artist">${artist?.name || track.artist}</div>
                ${album ? `<div class="modal-album">💿 ${album.title}</div>` : ''}
                <div class="modal-total" style="color: ${scoreColor}">${track.total_score.toFixed(1)}</div>
            </div>
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
        <div class="modal-actions-row">
            <a href="edit-track.html?id=${track.id}" class="btn-edit">✏️ Редактировать</a>
            <button class="btn-delete" onclick="deleteTrack('${track.id}')">🗑️</button>
        </div>
    `;

    modal.classList.remove('hidden');
}

function randomTrack() {
    if (allTracks.length === 0) {
        alert('Нет треков в библиотеке');
        return;
    }
    const random = allTracks[Math.floor(Math.random() * allTracks.length)];
    openTrackModal(random.id);
}

document.getElementById('search-input').addEventListener('input', (e) => {
    search(e.target.value);
});

document.getElementById('random-btn').addEventListener('click', randomTrack);

document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
});

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') document.getElementById('modal').classList.add('hidden');
});

loadData();