const urlParams = new URLSearchParams(window.location.search);
const albumId = urlParams.get('id');

let album = null;
let allArtists = [];
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
    if (!session || !albumId) {
        window.location.href = 'index.html';
        return;
    }

    const { data: albumData } = await supabaseClient
        .from('albums')
        .select('*')
        .eq('id', albumId)
        .single();
    
    if (!albumData) {
        window.location.href = 'index.html';
        return;
    }
    album = albumData;

    const { data: artists } = await supabaseClient
        .from('artists')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name');
    allArtists = artists || [];

    populateForm();
}

function populateForm() {
    document.getElementById('title').value = album.title;
    document.getElementById('artist-input').value = album.artist || '';
    selectedArtistId = album.artist_id;
    document.getElementById('year').value = album.year || '';
    document.getElementById('spotify-url').value = album.spotify_url || '';
    document.getElementById('youtube-url').value = album.youtube_url || '';

    if (album.image_url) {
        const preview = document.getElementById('image-preview');
        preview.innerHTML = `<img src="${album.image_url}" alt="">`;
        preview.classList.add('has-image');
    }

    document.getElementById('back-btn').href = `album.html?id=${albumId}`;
}

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
    }

    suggestions.classList.add('hidden');
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-container')) {
        suggestions.classList.add('hidden');
    }
});

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
    const fileName = `albums/${session.user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabaseClient.storage
        .from('covers')
        .upload(fileName, file);

    if (error) return null;

    const { data } = supabaseClient.storage
        .from('covers')
        .getPublicUrl(fileName);

    return data.publicUrl;
}

document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const session = await checkAuth();
    if (!session) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Сохраняем...';

    const artistName = artistInput.value.trim();

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

    let imageUrl = album.image_url;
    if (selectedFile) {
        const uploaded = await uploadImage(selectedFile);
        if (uploaded) imageUrl = uploaded;
    }

    const updateData = {
        title: document.getElementById('title').value.trim(),
        artist: artistName,
        artist_id: selectedArtistId,
        year: document.getElementById('year').value ? parseInt(document.getElementById('year').value) : null,
        image_url: imageUrl,
        spotify_url: document.getElementById('spotify-url').value || null,
        youtube_url: document.getElementById('youtube-url').value || null
    };

    const { error } = await supabaseClient
        .from('albums')
        .update(updateData)
        .eq('id', albumId);

    if (error) {
        alert('Ошибка: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Сохранить изменения';
    } else {
        window.location.href = `album.html?id=${albumId}`;
    }
});

loadData();