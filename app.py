import os
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, abort
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

app = Flask(__name__)
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
if database_url and database_url.startswith('postgresql://') and '+psycopg' not in database_url:
    database_url = database_url.replace('postgresql://', 'postgresql+psycopg://', 1)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-me-in-production-please')
app.config['SQLALCHEMY_DATABASE_URI'] = database_url or ('sqlite:///' + os.path.join(BASE_DIR, 'blog.db'))
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Войдите, чтобы получить доступ.'


post_likes = db.Table(
    'post_likes',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('post_id', db.Integer, db.ForeignKey('post.id'), primary_key=True),
)


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    bio = db.Column(db.Text, default='')
    avatar = db.Column(db.String(255), default='')
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    posts = db.relationship('Post', backref='author', lazy=True, cascade='all, delete-orphan')
    comments = db.relationship('Comment', backref='author', lazy=True, cascade='all, delete-orphan')
    liked_posts = db.relationship('Post', secondary=post_likes, backref='liked_by')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    slug = db.Column(db.String(50), unique=True, nullable=False)
    posts = db.relationship('Post', backref='category', lazy=True)


class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    image = db.Column(db.String(255), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    views = db.Column(db.Integer, default=0)

    comments = db.relationship('Comment', backref='post', lazy=True, cascade='all, delete-orphan')

    def excerpt(self, limit=180):
        text = self.content.strip()
        return text if len(text) <= limit else text[:limit].rsplit(' ', 1)[0] + '…'


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            abort(403)
        return f(*args, **kwargs)
    return decorated


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_image(file):
    if not file or file.filename == '' or not allowed_file(file.filename):
        return ''
    filename = secure_filename(file.filename)
    name, ext = os.path.splitext(filename)
    stamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    final_name = f"{name}_{stamp}{ext}"
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], final_name))
    return final_name


@app.context_processor
def inject_globals():
    return {
        'categories': Category.query.order_by(Category.name).all(),
        'current_year': datetime.utcnow().year,
    }


@app.route('/')
def index():
    page = request.args.get('page', 1, type=int)
    q = request.args.get('q', '').strip()
    cat_slug = request.args.get('category', '').strip()

    query = Post.query
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(Post.title.ilike(like), Post.content.ilike(like)))
    if cat_slug:
        cat = Category.query.filter_by(slug=cat_slug).first()
        if cat:
            query = query.filter_by(category_id=cat.id)

    pagination = query.order_by(Post.created_at.desc()).paginate(page=page, per_page=6, error_out=False)
    popular = Post.query.order_by(Post.views.desc()).limit(5).all()
    return render_template('index.html', pagination=pagination, popular=popular, q=q, cat_slug=cat_slug)


@app.route('/post/<int:post_id>', methods=['GET', 'POST'])
def post_detail(post_id):
    post = Post.query.get_or_404(post_id)
    post.views = (post.views or 0) + 1
    db.session.commit()

    if request.method == 'POST':
        if not current_user.is_authenticated:
            flash('Войдите, чтобы оставить комментарий.', 'warning')
            return redirect(url_for('login'))
        content = request.form.get('content', '').strip()
        if content:
            comment = Comment(content=content, user_id=current_user.id, post_id=post.id)
            db.session.add(comment)
            db.session.commit()
            flash('Комментарий добавлен.', 'success')
        return redirect(url_for('post_detail', post_id=post.id))

    return render_template('post_detail.html', post=post)


@app.route('/post/<int:post_id>/like', methods=['POST'])
@login_required
def post_like(post_id):
    post = Post.query.get_or_404(post_id)
    if current_user in post.liked_by:
        post.liked_by.remove(current_user)
    else:
        post.liked_by.append(current_user)
    db.session.commit()
    return redirect(request.referrer or url_for('post_detail', post_id=post.id))


@app.route('/create', methods=['GET', 'POST'])
@login_required
def create_post():
    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        content = request.form.get('content', '').strip()
        category_id = request.form.get('category_id') or None
        image_file = request.files.get('image')

        if not title or not content:
            flash('Заполните заголовок и текст статьи.', 'danger')
            return redirect(url_for('create_post'))

        image_name = save_image(image_file) if image_file else ''
        post = Post(
            title=title,
            content=content,
            user_id=current_user.id,
            category_id=int(category_id) if category_id else None,
            image=image_name,
        )
        db.session.add(post)
        db.session.commit()
        flash('Статья опубликована.', 'success')
        return redirect(url_for('post_detail', post_id=post.id))

    return render_template('post_form.html', post=None)


@app.route('/post/<int:post_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_post(post_id):
    post = Post.query.get_or_404(post_id)
    if post.user_id != current_user.id and not current_user.is_admin:
        abort(403)
    if request.method == 'POST':
        post.title = request.form.get('title', '').strip()
        post.content = request.form.get('content', '').strip()
        category_id = request.form.get('category_id') or None
        post.category_id = int(category_id) if category_id else None
        image_file = request.files.get('image')
        if image_file and image_file.filename:
            new_name = save_image(image_file)
            if new_name:
                post.image = new_name
        db.session.commit()
        flash('Статья обновлена.', 'success')
        return redirect(url_for('post_detail', post_id=post.id))
    return render_template('post_form.html', post=post)


@app.route('/post/<int:post_id>/delete', methods=['POST'])
@login_required
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    if post.user_id != current_user.id and not current_user.is_admin:
        abort(403)
    db.session.delete(post)
    db.session.commit()
    flash('Статья удалена.', 'info')
    if current_user.is_admin:
        return redirect(request.referrer or url_for('admin_posts'))
    return redirect(url_for('profile', username=current_user.username))


@app.route('/user/<username>')
def profile(username):
    user = User.query.filter_by(username=username).first_or_404()
    posts = Post.query.filter_by(user_id=user.id).order_by(Post.created_at.desc()).all()
    return render_template('profile.html', user=user, posts=posts)


@app.route('/profile/edit', methods=['GET', 'POST'])
@login_required
def profile_edit():
    if request.method == 'POST':
        current_user.bio = request.form.get('bio', '').strip()
        avatar_file = request.files.get('avatar')
        if avatar_file and avatar_file.filename:
            new_name = save_image(avatar_file)
            if new_name:
                current_user.avatar = new_name
        db.session.commit()
        flash('Профиль обновлён.', 'success')
        return redirect(url_for('profile', username=current_user.username))
    return render_template('profile_edit.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')

        if len(username) < 3 or len(password) < 6:
            flash('Имя пользователя ≥ 3 символов, пароль ≥ 6.', 'danger')
            return redirect(url_for('register'))
        if User.query.filter_by(username=username).first():
            flash('Имя пользователя занято.', 'danger')
            return redirect(url_for('register'))
        if User.query.filter_by(email=email).first():
            flash('Email уже зарегистрирован.', 'danger')
            return redirect(url_for('register'))

        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        login_user(user)
        flash('Регистрация прошла успешно.', 'success')
        return redirect(url_for('index'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        login_value = request.form.get('login', '').strip()
        password = request.form.get('password', '')
        user = User.query.filter(
            db.or_(User.username == login_value, User.email == login_value.lower())
        ).first()
        if user and user.check_password(password):
            login_user(user, remember=bool(request.form.get('remember')))
            return redirect(request.args.get('next') or url_for('index'))
        flash('Неверный логин или пароль.', 'danger')
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))


#Admin Panel

@app.route('/admin')
@login_required
@admin_required
def admin_dashboard():
    stats = {
        'users':      User.query.count(),
        'posts':      Post.query.count(),
        'comments':   Comment.query.count(),
        'categories': Category.query.count(),
    }
    recent_users  = User.query.order_by(User.created_at.desc()).limit(5).all()
    recent_posts  = Post.query.order_by(Post.created_at.desc()).limit(5).all()
    return render_template('admin/dashboard.html', stats=stats,
                           recent_users=recent_users, recent_posts=recent_posts)


@app.route('/admin/users')
@login_required
@admin_required
def admin_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return render_template('admin/users.html', users=users)


@app.route('/admin/users/<int:user_id>/toggle-admin', methods=['POST'])
@login_required
@admin_required
def admin_toggle_admin(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        flash('Нельзя изменить свои права.', 'warning')
    else:
        user.is_admin = not user.is_admin
        db.session.commit()
        state = 'администратором' if user.is_admin else 'обычным пользователем'
        flash(f'{user.username} теперь {state}.', 'success')
    return redirect(url_for('admin_users'))


@app.route('/admin/users/<int:user_id>/delete', methods=['POST'])
@login_required
@admin_required
def admin_delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        flash('Нельзя удалить собственную учётную запись.', 'warning')
    else:
        db.session.delete(user)
        db.session.commit()
        flash(f'Пользователь удалён.', 'info')
    return redirect(url_for('admin_users'))


@app.route('/admin/posts')
@login_required
@admin_required
def admin_posts():
    posts = Post.query.order_by(Post.created_at.desc()).all()
    return render_template('admin/posts.html', posts=posts)


@app.route('/admin/comments')
@login_required
@admin_required
def admin_comments():
    comments = Comment.query.order_by(Comment.created_at.desc()).all()
    return render_template('admin/comments.html', comments=comments)


@app.route('/admin/comments/<int:comment_id>/delete', methods=['POST'])
@login_required
@admin_required
def admin_delete_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    db.session.delete(comment)
    db.session.commit()
    flash('Комментарий удалён.', 'info')
    return redirect(request.referrer or url_for('admin_comments'))


@app.route('/admin/categories')
@login_required
@admin_required
def admin_categories():
    categories = Category.query.order_by(Category.name).all()
    return render_template('admin/categories.html', categories=categories)


@app.route('/admin/categories/add', methods=['POST'])
@login_required
@admin_required
def admin_add_category():
    name = request.form.get('name', '').strip()
    slug = request.form.get('slug', '').strip().lower().replace(' ', '-')
    if not name or not slug:
        flash('Заполните название и slug.', 'danger')
    elif Category.query.filter_by(slug=slug).first():
        flash('Категория с таким slug уже существует.', 'danger')
    else:
        db.session.add(Category(name=name, slug=slug))
        db.session.commit()
        flash(f'Категория «{name}» добавлена.', 'success')
    return redirect(url_for('admin_categories'))


@app.route('/admin/categories/<int:cat_id>/delete', methods=['POST'])
@login_required
@admin_required
def admin_delete_category(cat_id):
    cat = Category.query.get_or_404(cat_id)
    # unlink posts
    Post.query.filter_by(category_id=cat.id).update({'category_id': None})
    db.session.delete(cat)
    db.session.commit()
    flash(f'Категория «{cat.name}» удалена.', 'info')
    return redirect(url_for('admin_categories'))


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/rules')
def rules():
    return render_template('rules.html')


@app.route('/contacts')
def contacts():
    return render_template('contacts.html')


@app.cli.command('init-db')
def init_db_command():
    db.create_all()
    seed()
    print('БД инициализирована.')


def seed():
    if Category.query.count() == 0:
        defaults = [
            ('Технологии', 'tech'),
            ('Дизайн', 'design'),
            ('Образование', 'education'),
            ('Путешествия', 'travel'),
            ('Стиль жизни', 'lifestyle'),
        ]
        for name, slug in defaults:
            db.session.add(Category(name=name, slug=slug))
        db.session.commit()
    # Create default admin if none exists
    if not User.query.filter_by(is_admin=True).first():
        admin = User(username='admin', email='admin@inkspot.ru', is_admin=True)
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()


def init_database():
    db.create_all()
    # Legacy SQLite instances may not have this column yet.
    try:
        db.session.execute(db.text('ALTER TABLE "user" ADD COLUMN is_admin BOOLEAN DEFAULT FALSE'))
        db.session.commit()
    except Exception:
        db.session.rollback()
    seed()


with app.app_context():
    init_database()


if __name__ == '__main__':
    app.run(debug=True)
