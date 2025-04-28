from flask import Flask, request, jsonify, render_template
import cloudinary
import cloudinary.uploader
import os
from dotenv import load_dotenv
import json
from datetime import datetime
from collections import defaultdict

load_dotenv(dotenv_path=".env")

app = Flask(__name__)

# Tambah filter enumerate ke Jinja2
app.jinja_env.filters['enumerate'] = enumerate

# Konfigurasi Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

HISTORY_FILE = 'upload_history.json'
THREADS_FILE = 'threads.json'

# Fungsi untuk load dan simpan riwayat upload
def load_history():
    history_file_path = os.path.join(os.path.dirname(__file__), HISTORY_FILE)
    print(f"Loading history from: {history_file_path}")
    if not os.path.exists(history_file_path):
        print("No history file found, starting with empty history")
        return []
    try:
        with open(history_file_path, 'r') as f:
            history = json.load(f)
        valid_history = [
            img for img in history
            if img.get('url') and img.get('date') and img.get('public_id') and isinstance(img.get('public_id'), str) and img.get('public_id').strip()
        ]
        if len(valid_history) < len(history):
            print(f"Filtered {len(history) - len(valid_history)} invalid history entries")
            save_history(valid_history)
        return valid_history
    except Exception as e:
        print(f"Error loading history: {e}")
        return []

def save_history(history):
    history_file_path = os.path.join(os.path.dirname(__file__), HISTORY_FILE)
    try:
        with open(history_file_path, 'w') as f:
            json.dump(history, f, indent=2)
        print(f"Saved history to: {history_file_path}")
    except Exception as e:
        print(f"Error saving history: {e}")
        raise

# Fungsi untuk load dan simpan thread
def load_threads():
    threads_file_path = os.path.join(os.path.dirname(__file__), THREADS_FILE)
    if not os.path.exists(threads_file_path):
        print("No threads file found, starting with empty threads")
        with open(threads_file_path, 'w') as f:
            json.dump([], f)
        return []
    try:
        with open(threads_file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading threads: {e}")
        return []

def save_threads(threads):
    threads_file_path = os.path.join(os.path.dirname(__file__), THREADS_FILE)
    try:
        with open(threads_file_path, 'w') as f:
            json.dump(threads, f, indent=2)
        print(f"Saved threads to: {threads_file_path}")
    except Exception as e:
        print(f"Error saving threads: {e}")
        raise

@app.route('/')
def index():
    threads = load_threads()
    print(f"Rendering index with {len(threads)} threads")
    return render_template('index.html', threads=threads)

@app.route('/post')
def post():
    return render_template('post.html')

@app.route('/gallery')
def gallery():
    history = load_history()
    images_by_date = defaultdict(list)

    for img in history:
        tanggal = img['date'].split(' ')[0]
        images_by_date[tanggal].append(img)

    images_by_date = dict(sorted(images_by_date.items(), reverse=True))
    return render_template('gallery.html', images_by_date=images_by_date)

@app.route('/upload', methods=['POST'])
def upload():
    if 'image' not in request.files:
        print("Upload error: No image provided")
        return jsonify({'success': False, 'error': 'No image provided'}), 400

    image = request.files['image']
    try:
        result = cloudinary.uploader.upload(image, resource_type="image")
        url = result.get("secure_url")
        public_id = result.get("public_id")
        if not public_id:
            print("Upload error: Cloudinary returned no public_id")
            return jsonify({'success': False, 'error': 'No public_id from Cloudinary'}), 500
        date_uploaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        history = load_history()
        history.insert(0, {'url': url, 'date': date_uploaded, 'public_id': public_id})
        save_history(history)
        print(f"Uploaded image with public_id: {public_id}")

        return jsonify({
            'success': True,
            'image_url': url,
            'date': date_uploaded,
            'public_id': public_id
        })
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/delete', methods=['POST'])
def delete():
    data = request.get_json()
    public_id = data.get('public_id')
    print(f"Received delete request for public_id: {public_id}")
    if not public_id or not isinstance(public_id, str) or not public_id.strip():
        print(f"Delete error: Invalid or missing public_id: {public_id}")
        return jsonify({'success': False, 'error': 'Invalid or missing public_id'}), 400

    try:
        cloudinary_result = cloudinary.uploader.destroy(public_id)
        cloudinary_success = cloudinary_result.get('result') == 'ok'
        if not cloudinary_success:
            print(f"Delete warning: Cloudinary failed to delete {public_id}, result: {cloudinary_result}")
        else:
            print(f"Cloudinary deleted image with public_id: {public_id}")

        history = load_history()
        original_len = len(history)
        history = [img for img in history if img.get('public_id') != public_id]
        if len(history) < original_len:
            save_history(history)
            print(f"Removed image with public_id: {public_id} from history")
        else:
            print(f"Delete warning: No history entry found for public_id: {public_id}")

        if not cloudinary_success and len(history) == original_len:
            return jsonify({'success': False, 'error': 'Image not found in Cloudinary or history'}), 404

        return jsonify({'success': True})
    except Exception as e:
        print(f"Delete error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/create_thread', methods=['POST'])
def create_thread():
    data = request.get_json()
    title = data.get('title')
    description = data.get('description')
    image_url = data.get('image_url')
    public_id = data.get('public_id')
    date = data.get('date')

    if not title or not description:
        return jsonify({'success': False, 'error': 'Judul dan deskripsi harus diisi'}), 400

    threads = load_threads()
    thread = {
        'id': len(threads) + 1,
        'title': title,
        'description': description,
        'username': 'Anonymous',  # Default username
        'image': {'url': image_url, 'public_id': public_id, 'date': date} if image_url else None,
        'comments': [],
        'likes': 0,  # Initialize likes
        'liked': False,  # Track if liked (for simplicity, per-session)
        'created_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    threads.insert(0, thread)
    save_threads(threads)
    print(f"Created thread with id: {thread['id']}")

    return jsonify({'success': True, 'thread': thread})

@app.route('/add_comment/<int:thread_id>', methods=['POST'])
def add_comment(thread_id):
    data = request.get_json()
    username = data.get('username', 'Anonymous')
    content = data.get('content')

    if not content:
        return jsonify({'success': False, 'error': 'Komentar tidak boleh kosong'}), 400

    threads = load_threads()
    thread = next((t for t in threads if t['id'] == thread_id), None)
    if not thread:
        return jsonify({'success': False, 'error': 'Thread tidak ditemukan'}), 404

    comment = {
        'username': username,
        'content': content,
        'created_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'replies': []  # Initialize replies array
    }
    thread['comments'].append(comment)
    save_threads(threads)
    print(f"Added comment to thread {thread_id}")

    return jsonify({'success': True, 'comment': comment})

@app.route('/add_reply/<int:thread_id>/<int:comment_index>', methods=['POST'])
def add_reply(thread_id, comment_index):
    if 'image' in request.files:
        image = request.files['image']
        try:
            result = cloudinary.uploader.upload(image, resource_type="image")
            image_url = result.get("secure_url")
            public_id = result.get("public_id")
            date_uploaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            history = load_history()
            history.insert(0, {'url': image_url, 'date': date_uploaded, 'public_id': public_id})
            save_history(history)
            print(f"Uploaded reply image with public_id: {public_id}")
        except Exception as e:
            print(f"Upload reply image error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    else:
        image_url = None
        public_id = None
        date_uploaded = None

    data = request.form
    username = data.get('username', 'Anonymous')
    content = data.get('content')

    if not content:
        return jsonify({'success': False, 'error': 'Balasan tidak boleh kosong'}), 400

    threads = load_threads()
    thread = next((t for t in threads if t['id'] == thread_id), None)
    if not thread:
        return jsonify({'success': False, 'error': 'Thread tidak ditemukan'}), 404

    if comment_index < 0 or comment_index >= len(thread['comments']):
        return jsonify({'success': False, 'error': 'Komentar tidak ditemukan'}), 404

    reply = {
        'username': username,
        'content': content,
        'image': {'url': image_url, 'public_id': public_id, 'date': date_uploaded} if image_url else None,
        'created_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    thread['comments'][comment_index]['replies'] = thread['comments'][comment_index].get('replies', [])
    thread['comments'][comment_index]['replies'].append(reply)
    save_threads(threads)
    print(f"Added reply to thread {thread_id}, comment {comment_index}")

    return jsonify({'success': True, 'reply': reply})

@app.route('/toggle_like/<int:thread_id>', methods=['POST'])
def toggle_like(thread_id):
    threads = load_threads()
    thread = next((t for t in threads if t['id'] == thread_id), None)
    if not thread:
        return jsonify({'success': False, 'error': 'Thread tidak ditemukan'}), 404

    # Toggle like status
    liked = thread.get('liked', False)
    thread['liked'] = not liked
    thread['likes'] = thread.get('likes', 0) + (1 if not liked else -1)
    save_threads(threads)
    print(f"Toggled like for thread {thread_id}: likes={thread['likes']}, liked={thread['liked']}")

    return jsonify({'success': True, 'likes': thread['likes'], 'liked': thread['liked']})

if __name__ == '__main__':
    app.run(debug=True)