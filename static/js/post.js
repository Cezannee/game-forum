document.addEventListener('DOMContentLoaded', () => {
    const threadForm = document.getElementById('thread-form');
    const uploadBtn = document.getElementById('upload-btn');
    const status = document.getElementById('status');
    const fileInput = document.getElementById('image-input');
    const dropArea = document.getElementById('drop-area');
    const progressBar = document.querySelector('.progress');
    const progress = document.querySelector('.progress-bar');
    const loadingOverlay = document.getElementById('loading-overlay');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const html = document.documentElement;

    // Load dark mode preference
    const currentTheme = localStorage.getItem('theme') || 'light';
    html.setAttribute('data-bs-theme', currentTheme);
    darkModeToggle.innerHTML = currentTheme === 'dark' ? '<i class="bi bi-sun"></i> Light Mode' : '<i class="bi bi-moon"></i> Dark Mode';

    // Toggle dark mode
    darkModeToggle.addEventListener('click', () => {
        const isDark = html.getAttribute('data-bs-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        html.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        darkModeToggle.innerHTML = isDark ? '<i class="bi bi-moon"></i> Dark Mode' : '<i class="bi bi-sun"></i> Light Mode';
    });

    // Drag & Drop area events
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('border-primary');
    });

    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('border-primary');
    });

    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('border-primary');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            setStatus('Gambar siap diupload.', 'text-info');
        } else {
            setStatus('Tidak ada gambar yang dipilih.', 'text-danger');
        }
    });

    // Form submit for creating thread
    threadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('thread-title').value;
        const description = document.getElementById('thread-description').value;
        const file = fileInput.files[0];
        const maxSize = 5 * 1024 * 1024; // 5MB
        const validTypes = ['image/jpeg', 'image/png', 'image/gif'];

        // Setup UI
        const spinner = uploadBtn.querySelector('.spinner-border');
        spinner.classList.remove('d-none');
        uploadBtn.disabled = true;
        threadForm.classList.add('pe-none');
        setStatus('Membuat thread...', 'text-info', 0);
        progressBar.classList.add('d-none');
        loadingOverlay.classList.add('d-none');

        let imageData = null;
        if (file) {
            // Validasi file
            if (!validTypes.includes(file.type)) {
                resetUI();
                setStatus('File harus berupa JPG, PNG, atau GIF.', 'text-danger');
                return;
            }
            if (file.size > maxSize) {
                resetUI();
                setStatus('Ukuran file maksimum 5MB.', 'text-danger');
                return;
            }

            // Show upload progress
            progressBar.classList.remove('d-none');
            progress.style.width = '0%';
            progress.textContent = '0%';
            loadingOverlay.classList.remove('d-none');

            try {
                const formData = new FormData();
                formData.append('image', file);

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/upload');
                xhr.timeout = 15000;

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = (event.loaded / event.total) * 100;
                        progress.style.width = `${percent}%`;
                        progress.textContent = `${Math.round(percent)}%`;
                    }
                };

                imageData = await new Promise((resolve, reject) => {
                    xhr.onload = () => {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            if (xhr.status === 200 && data.success) {
                                resolve(data);
                            } else {
                                reject(new Error(data.error || 'Upload failed'));
                            }
                        } catch (err) {
                            reject(new Error('Invalid response format'));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Network error'));
                    xhr.ontimeout = () => reject(new Error('Upload timeout'));
                    xhr.send(formData);
                });
            } catch (err) {
                resetUI();
                setStatus(`Gagal mengunggah gambar: ${err.message}`, 'text-danger');
                return;
            }
        }

        // Create thread
        try {
            const res = await fetch('/create_thread', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    image_url: imageData ? imageData.image_url : null,
                    public_id: imageData ? imageData.public_id : null,
                    date: imageData ? imageData.date : null
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setStatus('Thread berhasil dibuat! Kembali ke halaman utama.', 'text-success');
                threadForm.reset();
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                setStatus(`Gagal membuat thread: ${data.error || 'Unknown error'}`, 'text-danger');
            }
        } catch (err) {
            setStatus(`Gagal membuat thread: ${err.message}`, 'text-danger');
        } finally {
            resetUI();
        }

        function resetUI() {
            spinner.classList.add('d-none');
            uploadBtn.disabled = false;
            threadForm.classList.remove('pe-none');
            progressBar.classList.add('d-none');
            loadingOverlay.classList.add('d-none');
        }
    });

    // Fungsi untuk set status dengan timeout
    function setStatus(message, className, timeout = 5000) {
        status.textContent = message;
        status.className = `mt-2 ${className}`;
        if (timeout > 0) {
            setTimeout(() => {
                status.textContent = '';
                status.className = 'mt-2';
            }, timeout);
        }
    }
});