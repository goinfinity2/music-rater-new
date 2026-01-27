// Проверка авторизации при загрузке
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session && window.location.pathname.includes('login.html')) {
        window.location.href = 'index.html';
    }
}

// Переключение табов
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
        document.getElementById('auth-error').textContent = '';
    });
});

// Функция для понятных сообщений об ошибках
function getErrorMessage(error) {
    const code = error.message || error.code || '';
    
    // Ошибки входа
    if (code.includes('Invalid login credentials')) {
        return '❌ Неверный email или пароль. Проверь данные.';
    }
    if (code.includes('Email not confirmed')) {
        return '📧 Email не подтверждён. Проверь почту или отключи подтверждение в Supabase.';
    }
    if (code.includes('Invalid email')) {
        return '❌ Некорректный формат email.';
    }
    
    // Ошибки регистрации
    if (code.includes('User already registered')) {
        return '⚠️ Этот email уже зарегистрирован. Попробуй войти.';
    }
    if (code.includes('Password should be at least')) {
        return '🔑 Пароль слишком короткий. Минимум 6 символов.';
    }
    if (code.includes('Unable to validate email')) {
        return '❌ Некорректный email адрес.';
    }
    
    // Сетевые ошибки
    if (code.includes('Failed to fetch') || code.includes('NetworkError')) {
        return '🌐 Нет соединения с сервером. Проверь интернет.';
    }
    
    // Если ничего не подошло — показываем оригинал
    return `⚠️ Ошибка: ${code}`;
}

// Показать ошибку
function showError(message) {
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

// Показать успех
function showSuccess(message) {
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = message;
    errorEl.style.color = '#34d399';
    errorEl.style.display = 'block';
}

// Вход
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = e.target.querySelector('button');
    
    // Валидация на клиенте
    if (!email) {
        showError('❌ Введи email');
        return;
    }
    if (!password) {
        showError('❌ Введи пароль');
        return;
    }
    
    // Блокируем кнопку
    submitBtn.disabled = true;
    submitBtn.textContent = 'Входим...';
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            showError(getErrorMessage(error));
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти';
        } else {
            showSuccess('✅ Успешно! Переходим...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        }
    } catch (err) {
        showError(getErrorMessage(err));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
    }
});

// Регистрация
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const submitBtn = e.target.querySelector('button');
    
    // Валидация на клиенте
    if (!email) {
        showError('❌ Введи email');
        return;
    }
    if (!password) {
        showError('❌ Введи пароль');
        return;
    }
    if (password.length < 6) {
        showError('🔑 Пароль должен быть минимум 6 символов');
        return;
    }
    
    // Блокируем кнопку
    submitBtn.disabled = true;
    submitBtn.textContent = 'Создаём аккаунт...';
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });
        
        if (error) {
            showError(getErrorMessage(error));
            submitBtn.disabled = false;
            submitBtn.textContent = 'Создать аккаунт';
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
            // Такой email уже есть
            showError('⚠️ Этот email уже зарегистрирован. Попробуй войти.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Создать аккаунт';
        } else {
            showSuccess('✅ Аккаунт создан! Переходим...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        }
    } catch (err) {
        showError(getErrorMessage(err));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Создать аккаунт';
    }
});

checkAuth();