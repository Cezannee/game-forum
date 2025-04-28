document.addEventListener('DOMContentLoaded', () => {
    const threadsList = document.getElementById('threads-list');
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

    // Handle comment and reply submission
    threadsList.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!e.target.classList.contains('comment-form') && !e.target.classList.contains('reply-form')) return;

        const form = e.target;
        const threadCard = form.closest('.thread-card');
        const threadId = parseInt(threadCard.dataset.threadId);

        if (form.classList.contains('comment-form')) {
            // Add new comment
            const content = form.querySelector('input').value;
            try {
                const res = await fetch(`/add_comment/${threadId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'Anonymous', content })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    const commentsList = threadCard.querySelector('.comments-list');
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'comment';
                    commentDiv.dataset.commentIndex = commentsList.children.length;
                    commentDiv.innerHTML = `
                        <div class="border-bottom py-2">
                            <strong>${data.comment.username}</strong> <small class="text-muted">(${data.comment.created_at})</small>
                            <p class="mb-1">${data.comment.content}</p>
                            <button class="btn btn-sm btn-link reply-btn p-0">Balas</button>
                        </div>
                        <div class="replies ms-4 mt-2"></div>
                        <form class="reply-form d-none mt-2 ms-4">
                            <div class="mb-2">
                                <input type="text" class="form-control form-control-sm" name="content" placeholder="Tulis balasan..." required>
                            </div>
                            <div class="mb-2">
                                <input type="file" class="form-control form-control-sm" name="image" accept="image/*">
                            </div>
                            <div class="d-flex gap-2">
                                <button type="submit" class="btn btn-sm btn-primary">Kirim</button>
                                <button type="button" class="btn btn-sm btn-secondary cancel-reply">Batal</button>
                            </div>
                        </form>
                    `;
                    commentsList.appendChild(commentDiv);
                    form.reset();
                } else {
                    alert(`Gagal menambahkan komentar: ${data.error || 'Unknown error'}`);
                }
            } catch (err) {
                alert(`Gagal menambahkan komentar: ${err.message}`);
            }
        } else if (form.classList.contains('reply-form')) {
            // Add reply to comment with optional image
            const commentDiv = form.closest('.comment');
            const commentIndex = parseInt(commentDiv.dataset.commentIndex);
            const content = form.querySelector('input[name="content"]').value;
            const file = form.querySelector('input[name="image"]').files[0];

            const formData = new FormData();
            formData.append('content', content);
            formData.append('username', 'Anonymous');
            if (file) {
                formData.append('image', file);
            }

            try {
                const res = await fetch(`/add_reply/${threadId}/${commentIndex}`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    const repliesDiv = commentDiv.querySelector('.replies');
                    const replyDiv = document.createElement('div');
                    replyDiv.className = 'border-bottom py-2';
                    replyDiv.innerHTML = `
                        <strong>${data.reply.username}</strong> <small class="text-muted">(${data.reply.created_at})</small>
                        <p class="mb-1">${data.reply.content}</p>
                        ${data.reply.image ? `
                            <img src="${data.reply.image.url}" class="img-fluid rounded mb-2 reply-img" alt="Reply image" style="max-height: 200px; object-fit: cover;" onclick="showModal('${data.reply.image.url}')">
                            <small class="text-muted d-block mb-1">Uploaded: ${data.reply.image.date}</small>
                        ` : ''}
                    `;
                    repliesDiv.appendChild(replyDiv);
                    form.classList.add('d-none');
                    form.reset();
                } else {
                    alert(`Gagal menambahkan balasan: ${data.error || 'Unknown error'}`);
                }
            } catch (err) {
                alert(`Gagal menambahkan balasan: ${err.message}`);
            }
        }
    });

    // Handle reply button click
    threadsList.addEventListener('click', (e) => {
        if (!e.target.classList.contains('reply-btn') && !e.target.classList.contains('cancel-reply')) return;

        if (e.target.classList.contains('reply-btn')) {
            const commentDiv = e.target.closest('.comment');
            const replyForm = commentDiv.querySelector('.reply-form');
            replyForm.classList.toggle('d-none');
        } else if (e.target.classList.contains('cancel-reply')) {
            const replyForm = e.target.closest('.reply-form');
            replyForm.classList.add('d-none');
            replyForm.reset();
        }
    });

    // Handle like toggle
    threadsList.addEventListener('click', async (e) => {
        if (!e.target.closest('.like-btn')) return;

        const btn = e.target.closest('.like-btn');
        const threadCard = btn.closest('.thread-card');
        const threadId = parseInt(threadCard.dataset.threadId);
        const isLiked = btn.dataset.liked === 'true';

        try {
            const res = await fetch(`/toggle_like/${threadId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                btn.dataset.liked = data.liked;
                const icon = btn.querySelector('i');
                icon.className = `bi ${data.liked ? 'bi-star-fill text-warning' : 'bi-star'}`;
                btn.querySelector('.like-count').textContent = data.likes;
            } else {
                alert(`Gagal toggle like: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            alert(`Gagal toggle like: ${err.message}`);
        }
    });
});