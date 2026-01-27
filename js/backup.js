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

    renderInfo();
}

function renderInfo() {
    document.getElementById('backup-info').innerHTML = `
        <div class="info-row"><span>Треков:</span><span>${allTracks.length}</span></div>
        <div class="info-row"><span>Альбомов:</span><span>${allAlbums.length}</span></div>
        <div class="info-row"><span>Артистов:</span><span>${allArtists.length}</span></div>
        <div class="info-row"><span>Последнее обновление:</span><span>${new Date().toLocaleString('ru-RU')}</span></div>
    `;
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function exportJSON() {
    const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        artists: allArtists.map(a => ({
            name: a.name,
            image_url: a.image_url,
            spotify_url: a.spotify_url,
            youtube_url: a.youtube_url
        })),
        albums: allAlbums.map(a => ({
            title: a.title,
            artist: a.artist,
            year: a.year,
            image_url: a.image_url,
            spotify_url: a.spotify_url,
            youtube_url: a.youtube_url
        })),
        tracks: allTracks.map(t => {
            const artist = allArtists.find(a => a.id === t.artist_id);
            const album = allAlbums.find(a => a.id === t.album_id);
            return {
                title: t.title,
                artist: artist?.name || t.artist,
                album: album?.title || null,
                image_url: t.image_url,
                has_vocals: t.has_vocals,
                instrumental: t.instrumental,
                charisma: t.charisma,
                meaning: t.meaning,
                vibe: t.vibe,
                structure: t.structure,
                originality: t.originality,
                replayability: t.replayability,
                total_score: t.total_score,
                notes: t.notes,
                spotify_url: t.spotify_url,
                youtube_url: t.youtube_url,
                created_at: t.created_at
            };
        })
    };

    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(json, `music-rater-backup-${date}.json`, 'application/json');
}

function exportCSV() {
    const headers = ['Название', 'Артист', 'Альбом', 'Инструментал', 'Харизма', 'Смысл', 'Вайб', 'Структура', 'Оригинальность', 'Репитабельность', 'Итог', 'Дата'];
    
    const rows = allTracks.map(t => {
        const artist = allArtists.find(a => a.id === t.artist_id);
        const album = allAlbums.find(a => a.id === t.album_id);
        return [
            `"${t.title.replace(/"/g, '""')}"`,
            `"${(artist?.name || t.artist).replace(/"/g, '""')}"`,
            `"${(album?.title || '').replace(/"/g, '""')}"`,
            t.instrumental,
            t.charisma || '',
            t.meaning,
            t.vibe,
            t.structure,
            t.originality,
            t.replayability,
            t.total_score,
            new Date(t.created_at).toLocaleDateString('ru-RU')
        ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const date = new Date().toISOString().split('T')[0];
    downloadFile('\uFEFF' + csv, `music-rater-backup-${date}.csv`, 'text/csv;charset=utf-8');
}

async function importJSON(file) {
    const session = await checkAuth();
    if (!session) return;

    const status = document.getElementById('import-status');
    status.textContent = 'Читаем файл...';
    status.style.color = '#ffcc00';

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.version || !data.tracks) {
            throw new Error('Неверный формат файла');
        }

        status.textContent = 'Импортируем артистов...';

        // Импорт артистов
        const artistMap = {};
        for (const artist of (data.artists || [])) {
            const existing = allArtists.find(a => a.name.toLowerCase() === artist.name.toLowerCase());
            if (existing) {
                artistMap[artist.name] = existing.id;
            } else {
                const { data: newArtist } = await supabaseClient
                    .from('artists')
                    .insert([{
                        user_id: session.user.id,
                        name: artist.name,
                        image_url: artist.image_url,
                        spotify_url: artist.spotify_url,
                        youtube_url: artist.youtube_url
                    }])
                    .select()
                    .single();
                if (newArtist) {
                    artistMap[artist.name] = newArtist.id;
                    allArtists.push(newArtist);
                }
            }
        }

        status.textContent = 'Импортируем альбомы...';

        // Импорт альбомов
        const albumMap = {};
        for (const album of (data.albums || [])) {
            const existing = allAlbums.find(a => 
                a.title.toLowerCase() === album.title.toLowerCase() && 
                a.artist?.toLowerCase() === album.artist?.toLowerCase()
            );
            if (existing) {
                albumMap[album.title] = existing.id;
            } else {
                const { data: newAlbum } = await supabaseClient
                    .from('albums')
                    .insert([{
                        user_id: session.user.id,
                        title: album.title,
                        artist: album.artist,
                        artist_id: artistMap[album.artist] || null,
                        year: album.year,
                        image_url: album.image_url,
                        spotify_url: album.spotify_url,
                        youtube_url: album.youtube_url
                    }])
                    .select()
                    .single();
                if (newAlbum) {
                    albumMap[album.title] = newAlbum.id;
                    allAlbums.push(newAlbum);
                }
            }
        }

        status.textContent = 'Импортируем треки...';

        // Импорт треков
        let imported = 0;
        let skipped = 0;

        for (const track of data.tracks) {
            const existing = allTracks.find(t => 
                t.title.toLowerCase() === track.title.toLowerCase() && 
                t.artist?.toLowerCase() === track.artist?.toLowerCase()
            );

            if (existing) {
                skipped++;
                continue;
            }

            await supabaseClient
                .from('tracks')
                .insert([{
                    user_id: session.user.id,
                    title: track.title,
                    artist: track.artist,
                    artist_id: artistMap[track.artist] || null,
                    album_id: track.album ? albumMap[track.album] || null : null,
                    image_url: track.image_url,
                    has_vocals: track.has_vocals,
                    instrumental: track.instrumental,
                    charisma: track.charisma,
                    meaning: track.meaning,
                    vibe: track.vibe,
                    structure: track.structure,
                    originality: track.originality,
                    replayability: track.replayability,
                    total_score: track.total_score,
                    notes: track.notes,
                    spotify_url: track.spotify_url,
                    youtube_url: track.youtube_url
                }]);

            imported++;
        }

        status.textContent = `✅ Готово! Импортировано: ${imported} треков. Пропущено (уже есть): ${skipped}`;
        status.style.color = '#34d399';

        // Перезагружаем данные
        loadData();

    } catch (error) {
        status.textContent = `❌ Ошибка: ${error.message}`;
        status.style.color = '#ef4444';
    }
}

document.getElementById('export-json').addEventListener('click', exportJSON);
document.getElementById('export-csv').addEventListener('click', exportCSV);

document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        importJSON(file);
    }
});

loadData();