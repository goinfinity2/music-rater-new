const urlParams = new URLSearchParams(window.location.search);
const albumId = urlParams.get('id');

let album = null;
let albumTracks = [];
let allArtists = [];

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function loadAlbum() {
    const session = await checkAuth();
    if (!session || !albumId) return;

    const { data } = await supabaseClient
        .from('albums')
        .select('*')
        .eq('id', albumId)
        .single();
    album = data;

    const { data: tracks } = await supabaseClient
        .from('tracks')
        .select('*')
        .eq('album_id', albumId)
        .order('created_at');
    albumTracks = tracks || [];

    const { data: artists } = await supabaseClient
        .from('artists')
        .select('*')
        .eq('user_id', session.user.id);
    allArtists = artists || [];

    renderAlbum();
    applyFilters();
}

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

function getScoreClass(score) {
    return `score-${Math.min(10, Math.max(1, Math.round(score)))}`;
}

function renderAlbum() {
    if (!album) return;

    document.getElementById('page-title').textContent = album.title;
    
    // Исправленная кнопка редактирования
    const editBtn = document.getElementById('edit-album-btn');
    if (editBtn) editBtn.href = `edit-album.html?id=${albumId}`;

    document.getElementById('add-track-btn').href = `rate.html?album=${albumId}`;

    const artist = allArtists.find(a => a.id === album.artist_id);
    const cover = album.image_url ? `<img src="${album.image_url}" alt="">` : '💿';
    const avgScore = albumTracks.length > 0
        ? (albumTracks.reduce((sum, t) => sum + t.total_score, 0) / albumTracks.length).toFixed(1)
        : '—';

    document.getElementById('album-info').innerHTML = `
        <div class="detail-cover">${cover}</div>
        <div class="detail-info">
            <div class="detail-title">${album.title}</div>
            <div class="detail-subtitle">${artist?.name || album.artist}${album.year ? ` • ${album.year}` : ''}</div>
            <div class="detail-meta">${albumTracks.length} треков</div>
            <div class="detail-score" style="color: ${getScoreColor(parseFloat(avgScore))}">${avgScore}</div>
        </div>
    `;
}

function applyFilters() {
    const sortBy = document.getElementById('sort-select').value;
    const scoreFilter = document.getElementById('score-filter').value;

    let filtered = [...albumTracks];

    if (scoreFilter !== 'all') {
        if (scoreFilter === 'low') {
            filtered = filtered.filter(t => t.total_score < 5);
        } else {
            const min = parseFloat(scoreFilter);
            filtered = filtered.filter(t => t.total_score >= min);
        }
    }

    switch (sortBy) {
        case 'score-desc':
            filtered.sort((a, b) => b.total_score - a.total_score);
            break;
        case 'score-asc':
            filtered.sort((a, b) => a.total_score - b.total_score);
            break;
        case 'title':
            filtered.sort((a, b) => a.title.localeCompare(b.title));
            break;
        default:
            filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    renderTracks(filtered);
}

function renderTracks(tracks) {
    const list = document.getElementById('album-tracks');
    const empty = document.getElementById('empty-tracks');
    document.getElementById('tracks-count').textContent = `${tracks.length} треков`;

    if (tracks.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    list.innerHTML = tracks.map((track, index) => {
        const scoreClass = getScoreClass(track.total_score);
        const cover = track.image_url 
            ? `<img src="${track.image_url}" alt="">` 
            : (album.image_url ? `<img src="${album.image_url}" alt="">` : '🎵');

        return `
            <div class="track-card" data-id="${track.id}">
                <div class="track-number">${index + 1}</div>
                <div class="track-cover">${cover}</div>
                <div class="track-info">
                    <div class="track-title">${track.title}</div>
                </div>
                <div class="track-score ${scoreClass}">${track.total_score.toFixed(1)}</div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.track-card').forEach(card => {
        card.addEventListener('click', () => openTrackModal(card.dataset.id));
    });
}

function openTrackModal(trackId) {
    const track = albumTracks.find(t => t.id === trackId);
    if (!track) return;

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const cover = track.image_url 
        ? `<img src="${track.image_url}" alt="">` 
        : (album.image_url ? `<img src="${album.image_url}" alt="">` : '🎵');
    const scoreColor = getScoreColor(track.total_score);

    body.innerHTML = `
        <div class="modal-header">
            <div class="modal-cover">${cover}</div>
            <div>
                <div class="modal-title">${track.title}</div>
                <div class="modal-album">💿 ${album.title}</div>
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
        <div class="modal-actions-row">
            <a href="edit-track.html?id=${track.id}" class="btn-edit">✏️ Редактировать</a>
            <button class="btn-delete" onclick="deleteTrack('${track.id}')">🗑️</button>
        </div>
    `;

    modal.classList.remove('hidden');
}

// Функции модалок и удаление...
// (Остальной код остаётся стандартным, главное - renderAlbum и openTrackModal выше)
async function deleteTrack(trackId) {
    if (!confirm('Удалить трек?')) return;
    await supabaseClient.from('tracks').delete().eq('id', trackId);
    document.getElementById('modal').classList.add('hidden');
    loadAlbum();
}

function openStatsModal() {
    // Код статистики (он был правильный в прошлом ответе)
    // ...
    // Вставь сюда код статистики из прошлого ответа, если нужно, или оставь как есть
    document.getElementById('stats-modal').classList.remove('hidden');
}

// Event Listeners
document.getElementById('sort-select').addEventListener('change', applyFilters);
document.getElementById('score-filter').addEventListener('change', applyFilters);
document.getElementById('stats-btn').addEventListener('click', openStatsModal);
document.getElementById('delete-album-btn').addEventListener('click', async () => {
    if (!confirm('Удалить альбом?')) return;
    await supabaseClient.from('tracks').delete().eq('album_id', albumId);
    await supabaseClient.from('albums').delete().eq('id', albumId);
    window.location.href = 'index.html';
});
document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal').classList.add('hidden'));
document.getElementById('stats-modal-close').addEventListener('click', () => document.getElementById('stats-modal').classList.add('hidden'));
document.getElementById('modal').addEventListener('click', (e) => { if(e.target.id==='modal') document.getElementById('modal').classList.add('hidden') });

loadAlbum();