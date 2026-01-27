let selectedFile = null;
let allArtists = [];
let selectedArtistId = null;

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function loadArtists() {
    const session = await checkAuth();
    if (!session) return;

    const { data } = await supabaseClient
        .from('artists')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name');

    allArtists = data || [];
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
    }

    suggestions.classList.add('hidden');
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-container')) {
        suggestions.classList.add('hidden');
    }
});

// Превью изображения
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

async function uploadImage(file, folder) {
    const session = await checkAuth();
    if (!session || !file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${session.user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabaseClient.storage
        .from('covers')
        .upload(fileName, file);

    if (error) return null;

    const { data } = supabaseClient.storage
        .from('covers')
        .getPublicUrl(fileName);

    return data.publicUrl;
}

// Сохранение
document.getElementById('album-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const session = await checkAuth();
    if (!session) return;

    const title = document.getElementById('title').value.trim();
    const artistName = artistInput.value.trim();
    const year = document.getElementById('year').value;

    if (!title || !artistName) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Сохраняем...';

    // Создаём артиста если нужно
    if (!selectedArtistId) {
        const { data: newArtist, error } = await supabaseClient
            .from('artists')
            .insert([{ user_id: session.user.id, name: artistName }])
            .select()
            .single();

        if (newArtist) {
            selectedArtistId = newArtist.id;
        }
    }

    let imageUrl = null;
    if (selectedFile) {
        imageUrl = await uploadImage(selectedFile, 'albums');
    }

    const { error } = await supabaseClient.from('albums').insert([{
        user_id: session.user.id,
        title,
        artist: artistName,
        artist_id: selectedArtistId,
        year: year ? parseInt(year) : null,
        image_url: imageUrl
    }]);

    if (error) {
        alert('Ошибка: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Добавить альбом';
    } else {
        window.location.href = 'index.html';
    }
});

loadArtists();