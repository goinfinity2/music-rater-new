const urlParams = new URLSearchParams(window.location.search);
const trackId = urlParams.get('id');

let track = null;
let allArtists = [];
let allAlbums = [];
let selectedArtistId = null;
let selectedFile = null;

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
    if (!session || !trackId) {
        window.location.href = 'index.html';
        return;
    }

    // Загружаем трек
    const { data: trackData } = await supabaseClient
        .from('tracks')
        .select('*')
        .eq('id', trackId)
        .single();
    
    if (!trackData) {
        window.location.href = 'index.html';
        return;
    }
    track = trackData;

    // Загружаем артистов и альбомы
    const { data: artists } = await supabaseClient
        .from('artists')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name');
    allArtists = artists || [];

    const { data: albums } = await supabaseClient
        .from('albums')
        .select('*')
        .eq('user_id', session.user.id)
        .order('title');
    allAlbums = albums || [];

    populateForm();
}

function populateForm() {
    // Основные поля
    document.getElementById('title').value = track.title;
    document.getElementById('artist-input').value = track.artist;
    selectedArtistId = track.artist_id;

    // Альбомы
    const albumSelect = document.getElementById('album-select');
    albumSelect.innerHTML = '<option value="">Без альбома (сингл)</option>';
    allAlbums.forEach(album => {
        const artist = allArtists.find(a => a.id === album.artist_id);
        albumSelect.innerHTML += `<option value="${album.id}">${album.title} — ${artist?.name || ''}</option>`;
    });
    if (track.album_id) {
        albumSelect.value = track.album_id;
    }

    // Ссылки и заметки
    document.getElementById('spotify-url').value = track.spotify_url || '';
    document.getElementById('youtube-url').value = track.youtube_url || '';
    document.getElementById('notes').value = track.notes || '';

    // Обложка
    if (track.image_url) {
        const preview = document.getElementById('image-preview');
        preview.innerHTML = `<img src="${track.image_url}" alt="">`;
        preview.classList.add('has-image');
    }

    // Вокал
    document.getElementById('has-vocals').checked = track.has_vocals;
    updateCharismaVisibility();

    // Слайдеры
    setSliderValue('instrumental', track.instrumental);
    setSliderValue('charisma', track.charisma || 5);
    setSliderValue('meaning', track.meaning);
    setSliderValue('vibe', track.vibe);
    setSliderValue('structure', track.structure);
    setSliderValue('originality', track.originality);
    setSliderValue('replayability', track.replayability);

    calculateTotal();

    // Кнопка назад
    if (track.album_id) {
        document.getElementById('back-btn').href = `album.html?id=${track.album_id}`;
    } else if (track.artist_id) {
        document.getElementById('back-btn').href = `artist.html?id=${track.artist_id}`;
    }
}

function setSliderValue(id, value) {
    const slider = document.getElementById(id);
    const display = document.getElementById(`${id}-value`);
    slider.value = value;
    display.textContent = parseFloat(value).toFixed(1);
}

function updateCharismaVisibility() {
    const hasVocals = document.getElementById('has-vocals').checked;
    document.getElementById('charisma-group').classList.toggle('disabled', !hasVocals);
}

function calculateTotal() {
    const hasVocals = document.getElementById('has-vocals').checked;
    let sum = 0, count = 0;

    const sliders = ['instrumental', 'charisma', 'meaning', 'vibe', 'structure', 'originality', 'replayability'];
    sliders.forEach(id => {
        if (id === 'charisma' && !hasVocals) return;
        sum += parseFloat(document.getElementById(id).value);
        count++;
    });

    const total = sum / count;
    const el = document.getElementById('total-score');
    el.textContent = total.toFixed(1);
    el.style.color = getScoreColor(total);
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
    return '#ff0000';
}

// Автодополнение артиста
const artistInput = document.getElementById('artist-input');
const suggestions = document.getElementById('artist-suggestions');

artistInput.addEventListener('input', () => {
    const value = artistInput.value.toLowerCase().trim();
    selectedArtistId = null;

    if (!value) {
        suggestions.classList.add('hidden');
        return;
    }

    const matches = allArtists.filter(a => a.name.toLowerCase().includes(value));

    if (matches.length === 0) {
        suggestions.innerHTML = `<div class="suggestion-item suggestion-new">+ Создать "${artistInput.value}"</div>`;
    } else {
        suggestions.innerHTML = matches.map(a =>
            `<div class="suggestion-item" data-id="${a.id}">${a.name}</div>`
        ).join('');
    }

    suggestions.classList.remove('hidden');
});

suggestions.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (!item) return;

    if (item.dataset.id) {
        selectedArtistId = item.dataset.id;
        artistInput.value = item.textContent;

        // Фильтруем альбомы
        const albumSelect = document.getElementById('album-select');
        const artistAlbums = allAlbums.filter(a => a.artist_id === selectedArtistId);
        albumSelect.innerHTML = '<option value="">Без альбома (сингл)</option>';
        artistAlbums.forEach(album => {
            albumSelect.innerHTML += `<option value="${album.id}">${album.title}</option>`;
        });
    }

    suggestions.classList.add('hidden');
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-container')) {
        suggestions.classList.add('hidden');
    }
});

// Изображение
document.getElementById('image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('image-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="">`;
            preview.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }
});

async function uploadImage(file) {
    const session = await checkAuth();
    if (!session || !file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `tracks/${session.user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabaseClient.storage
        .from('covers')
        .upload(fileName, file);

    if (error) return null;

    const { data } = supabaseClient.storage
        .from('covers')
        .getPublicUrl(fileName);

    return data.publicUrl;
}

// Слайдеры
const sliders = ['instrumental', 'charisma', 'meaning', 'vibe', 'structure', 'originality', 'replayability'];
sliders.forEach(id => {
    const slider = document.getElementById(id);
    slider.addEventListener('input', () => {
        document.getElementById(`${id}-value`).textContent = parseFloat(slider.value).toFixed(1);
        calculateTotal();
    });
});

document.getElementById('has-vocals').addEventListener('change', () => {
    updateCharismaVisibility();
    calculateTotal();
});

// Сохранение
document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const session = await checkAuth();
    if (!session) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Сохраняем...';

    const artistName = artistInput.value.trim();

    // Создаём артиста если нужно
    if (!selectedArtistId && artistName) {
        const existing = allArtists.find(a => a.name.toLowerCase() === artistName.toLowerCase());
        if (existing) {
            selectedArtistId = existing.id;
        } else {
            const { data: newArtist } = await supabaseClient
                .from('artists')
                .insert([{ user_id: session.user.id, name: artistName }])
                .select()
                .single();
            if (newArtist) selectedArtistId = newArtist.id;
        }
    }

    let imageUrl = track.image_url;
    if (selectedFile) {
        const uploaded = await uploadImage(selectedFile);
        if (uploaded) imageUrl = uploaded;
    }

    const hasVocals = document.getElementById('has-vocals').checked;

    const updateData = {
        title: document.getElementById('title').value.trim(),
        artist: artistName,
        artist_id: selectedArtistId,
        album_id: document.getElementById('album-select').value || null,
        image_url: imageUrl,
        spotify_url: document.getElementById('spotify-url').value || null,
        youtube_url: document.getElementById('youtube-url').value || null,
        notes: document.getElementById('notes').value || null,
        has_vocals: hasVocals,
        instrumental: parseFloat(document.getElementById('instrumental').value),
        charisma: hasVocals ? parseFloat(document.getElementById('charisma').value) : null,
        meaning: parseFloat(document.getElementById('meaning').value),
        vibe: parseFloat(document.getElementById('vibe').value),
        structure: parseFloat(document.getElementById('structure').value),
        originality: parseFloat(document.getElementById('originality').value),
        replayability: parseFloat(document.getElementById('replayability').value),
        total_score: parseFloat(document.getElementById('total-score').textContent)
    };

    const { error } = await supabaseClient
        .from('tracks')
        .update(updateData)
        .eq('id', trackId);

    if (error) {
        alert('Ошибка: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Сохранить изменения';
    } else {
        window.history.back();
    }
});

loadData();