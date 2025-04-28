document.addEventListener('DOMContentLoaded', () => {
    console.log("gallery.js loaded"); // Debug: Pastikan script jalan

    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (!darkModeToggle) {
        console.error("Dark mode toggle button not found!");
        return;
    }
    console.log("Dark mode toggle button found:", darkModeToggle); // Debug: Tombol ketemu?

    const html = document.documentElement;

    // Load dark mode preference
    const currentTheme = localStorage.getItem('theme') || 'light';
    html.setAttribute('data-bs-theme', currentTheme);
    darkModeToggle.innerHTML = currentTheme === 'dark' ? '<i class="bi bi-sun"></i> Light Mode' : '<i class="bi bi-moon"></i> Dark Mode';

    // Toggle dark mode
    darkModeToggle.addEventListener('click', () => {
        console.log("Dark mode toggle clicked"); // Debug: Klik terdeteksi?
        const isDark = html.getAttribute('data-bs-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        html.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        darkModeToggle.innerHTML = isDark ? '<i class="bi bi-moon"></i> Dark Mode' : '<i class="bi bi-sun"></i> Light Mode';
        console.log(`Switched to ${newTheme} mode`);
    });

    // Handle image deletion
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const publicId = btn.dataset.publicId;
            if (!confirm('Apakah Anda yakin ingin menghapus gambar ini?')) return;

            try {
                const res = await fetch('/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ public_id: publicId })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    btn.closest('.col').remove();
                    alert('Gambar berhasil dihapus');
                } else {
                    alert(`Gagal menghapus gambar: ${data.error || 'Unknown error'}`);
                }
            } catch (err) {
                alert(`Gagal menghapus gambar: ${err.message}`);
            }
        });
    });
});