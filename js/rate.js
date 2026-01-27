const urlParams = new URLSearchParams(window.location.search);
const presetAlbumId = urlParams.get('album');
const presetArtistId = urlParams.get('artist');

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
    if (!session) return;

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

    // Заполняем альбомы
    const albumSelect = document.getElementById('album-select');
    allAlbums.forEach(album => {
        const artist = allArtists.find(a => a.id === album.artist_id);
        albumSelect.innerHTML += `<option value="${album.id}">${album.title} — ${artist?.name || album.artist}</option>`;
    });

    // Пресеты
    if (presetAlbumId) {
        albumSelect.value = presetAlbumId;
        const album = allAlbums.find(a => a.id === presetAlbumId);
        if (album) {
            document.getElementById('artist-input').value = album.artist;
            selectedArtistId = album.artist_id;
            document.getElementById('back-btn').href = `album.html?id=${presetAlbumId}`;
        }
    }

    if (presetArtistId) {
        const artist = allArtists.find(a => a.id === presetArtistId);
        if (artist) {
            document.getElementById('artist-input').value = artist.name;
            selectedArtistId = presetArtistId;
            document.getElementById('back-btn').href = `artist.html?id=${presetArtistId}`;
        }
    }
}

// Автодополнение
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
const hasVocalsCheckbox = document.getElementById('has-vocals');
const charismaGroup = document.getElementById('charisma-group');

sliders.forEach(id => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(`${id}-value`);
    slider.addEventListener('input', () => {
        valueDisplay.textContent = parseFloat(slider.value).toFixed(1);
        calculateTotal();
    });
});

hasVocalsCheckbox.addEventListener('change', () => {
    charismaGroup.classList.toggle('disabled', !hasVocalsCheckbox.checked);
    calculateTotal();
});

function calculateTotal() {
    const hasVocals = hasVocalsCheckbox.checked;
    let sum = 0, count = 0;

    sliders.forEach(id => {
        if (id === 'charisma' && !hasVocals) return;
        sum += parseFloat(document.getElementById(id).value);
        count++;
    });

    const total = sum / count;
    const el = document.getElementById('total-score');
    el.textContent = total.toFixed(1);
    el.style.color = total >= 8.5 ? '#34d399' : total >= 5 ? '#8b5cf6' : '#ef4444';
}

// Сохранение
document.getElementById('rate-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const session = await checkAuth();
    if (!session) return;

    const title = document.getElementById('title').value.trim();
    const artistName = artistInput.value.trim();
    const albumId = document.getElementById('album-select').value || null;
    const hasVocals = hasVocalsCheckbox.checked;

    if (!title || !artistName) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Сохраняем...';

    // Создаём артиста если нужно
    if (!selectedArtistId) {
        const { data: newArtist } = await supabaseClient
            .from('artists')
            .insert([{ user_id: session.user.id, name: artistName }])
            .select()
            .single();
        if (newArtist) selectedArtistId = newArtist.id;
    }

    let imageUrl = null;
    if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
    }

    const trackData = {
        user_id: session.user.id,
        title,
        artist: artistName,
        artist_id: selectedArtistId,
        album_id: albumId,
        image_url: imageUrl,
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

    const { error } = await supabaseClient.from('tracks').insert([trackData]);

    if (error) {
        alert('Ошибка: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Добавить в библиотеку';
    } else {
        if (presetAlbumId) {
            window.location.href = `album.html?id=${presetAlbumId}`;
        } else if (presetArtistId) {
            window.location.href = `artist.html?id=${presetArtistId}`;
        } else {
            window.location.href = 'index.html';
        }
    }
});

loadData();
calculateTotal();