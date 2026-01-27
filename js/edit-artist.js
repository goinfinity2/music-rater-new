const urlParams = new URLSearchParams(window.location.search);
const artistId = urlParams.get('id');

let artist = null;
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
    if (!session || !artistId) {
        window.location.href = 'index.html';
        return;
    }

    const { data: artistData } = await supabaseClient
        .from('artists')
        .select('*')
        .eq('id', artistId)
        .single();
    
    if (!artistData) {
        window.location.href = 'index.html';
        return;
    }
    artist = artistData;

    populateForm();
}

function populateForm() {
    document.getElementById('name').value = artist.name;
    document.getElementById('spotify-url').value = artist.spotify_url || '';
    document.getElementById('youtube-url').value = artist.youtube_url || '';

    if (artist.image_url) {
        const preview = document.getElementById('image-preview');
        preview.innerHTML = `<img src="${artist.image_url}" alt="">`;
        preview.classList.add('has-image');
    }

    document.getElementById('back-btn').href = `artist.html?id=${artistId}`;
}

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
    const fileName = `artists/${session.user.id}/${Date.now()}.${fileExt}`;

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
document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const session = await checkAuth();
    if (!session) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Сохраняем...';

    let imageUrl = artist.image_url;
    if (selectedFile) {
        const uploaded = await uploadImage(selectedFile);
        if (uploaded) imageUrl = uploaded;
    }

    const updateData = {
        name: document.getElementById('name').value.trim(),
        image_url: imageUrl,
        spotify_url: document.getElementById('spotify-url').value || null,
        youtube_url: document.getElementById('youtube-url').value || null
    };

    const { error } = await supabaseClient
        .from('artists')
        .update(updateData)
        .eq('id', artistId);

    if (error) {
        alert('Ошибка: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Сохранить изменения';
    } else {
        window.location.href = `artist.html?id=${artistId}`;
    }
});

loadData();