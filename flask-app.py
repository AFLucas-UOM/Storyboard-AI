from flask import Flask, render_template, redirect, url_for, request, session, send_from_directory, jsonify, make_response
from werkzeug.security import generate_password_hash, check_password_hash
import os, json
from datetime import timedelta
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24))  # Use a secure secret key

USER_JSON_PATH = os.path.join(app.static_folder, 'credentials.json')  # Path to 'static/credentials.json'
DEFAULT_PFP = 'default.png'  # Default Profile Picture
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('assets', filename)

# Function to check if the email already exists in the database (credentials.json)
def email_exists(email):
    if os.path.exists(USER_JSON_PATH):
        with open(USER_JSON_PATH, 'r') as f:
            existing_users = json.load(f)
            return any(user['email'] == email for user in existing_users)
    return False  # Email does not exist

# Function to authenticate user based on email and password
def authenticate_user(email, password):
    if os.path.exists(USER_JSON_PATH):
        with open(USER_JSON_PATH, 'r') as f:
            users = json.load(f)
            return next((user for user in users if user['email'] == email and check_password_hash(user['password'], password)), None)
    return None  # Invalid credentials

# Main route (Home Page)
@app.route('/')
def index():
    return render_template('index.html')

# Login route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
            email = data.get('email')
            password = data.get('password')
            remember_me = data.get('rememberMe', False)
            
            user = authenticate_user(email, password)
            
            if user:
                session['user'] = user['email']
                
                if remember_me:
                    resp = make_response(jsonify({
                        "success": True,
                        "message": "Login successful",
                        "redirect": url_for('index2'),
                        "name": user['name']
                    }))
                    resp.set_cookie('email', user['email'], max_age=timedelta(days=30), secure=True, httponly=True)
                    resp.set_cookie('name', user['name'], max_age=timedelta(days=30), secure=True, httponly=True)
                    return resp
                
                return jsonify({
                    "success": True,
                    "message": "Login successful",
                    "redirect": url_for('index2'),
                    "name": user['name']
                })
            else:
                return jsonify({"success": False, "message": "Invalid credentials"})
        
        return jsonify({"success": False, "message": "Request must be JSON"})
    
    email = request.cookies.get('email')
    name = request.cookies.get('name')
    if email and name:
        session['user'] = email
        return redirect(url_for('index2'))
    
    return render_template('login.html')

@app.route('/check-email', methods=['POST'])
def check_email():
    email = request.json.get('email')
    return jsonify({"exists": email_exists(email)})

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        try:
            data = request.get_json()
            name = data.get('name')
            email = data.get('email')
            password = data.get('password')
            confirm_password = data.get('confirmPassword')

            if not all([name, email, password, confirm_password]):
                return jsonify({"success": False, "message": "Invalid input"}), 400

            if email_exists(email):
                return jsonify({"success": False, "message": "An account with this email already exists."}), 400

            if password != confirm_password:
                return jsonify({"success": False, "message": "Passwords do not match"}), 400

            if len(password) < 8 or not any(char.isdigit() for char in password):
                return jsonify({"success": False, "message": "Password must be at least 8 characters long and include a number"}), 400

            hashed_password = generate_password_hash(password)

            user_data = {"name": name, "email": email, "password": hashed_password, "profile_pic": DEFAULT_PFP}

            existing_users = []
            if os.path.exists(USER_JSON_PATH):
                with open(USER_JSON_PATH, 'r') as f:
                    existing_users = json.load(f)

            existing_users.append(user_data)
            with open(USER_JSON_PATH, 'w') as f:
                json.dump(existing_users, f, indent=4)

            return jsonify({"success": True, "message": "Account created successfully!"})
        
        except Exception as e:
            return jsonify({"success": False, "message": "Server error"}), 500

    return render_template('signup.html')

@app.route('/home')
def index2():
    return render_template('index2.html')

def load_credentials():
    with open(USER_JSON_PATH, 'r') as f:
        return json.load(f)

@app.route('/profile')
def profile():
    user_email = session.get('user')
    if user_email:
        user_credentials = load_credentials()
        user = next((u for u in user_credentials if u['email'] == user_email), None)
        if user:
            return render_template('profile.html', user=user)
    return redirect(url_for('login'))

@app.route('/update_profile', methods=['POST'])
def update_profile():
    name = request.form['name']
    email = request.form['email']
    password = request.form['password']
    profile_pic = DEFAULT_PFP

    user_credentials = load_credentials()

    user = next((u for u in user_credentials if u['email'] == email), None)
    if user:
        # Handle profile picture removal or upload
        if request.form.get('remove_profile_pic') == "true":
            existing_pic = user.get('profile_pic')
            if existing_pic and existing_pic != DEFAULT_PFP:
                pic_path = os.path.join('static/img/PFPs', existing_pic)
                if os.path.exists(pic_path):
                    os.remove(pic_path)

            profile_pic = DEFAULT_PFP

        elif 'profile_pic' in request.files:
            pic = request.files['profile_pic']
            if pic and pic.filename and allowed_file(pic.filename):
                pic_filename = secure_filename(pic.filename)
                profile_pic = f"{name}_{pic_filename}"
                pic.save(os.path.join('static/img/PFPs', profile_pic))

        # Hash the new password before saving
        if password:
            hashed_password = generate_password_hash(password)
            user.update({
                'name': name,
                'email': email,
                'password': hashed_password,
                'profile_pic': profile_pic
            })
        else:
            user.update({
                'name': name,
                'email': email,
                'profile_pic': profile_pic
            })

        with open(USER_JSON_PATH, 'w') as f:
            json.dump(user_credentials, f)

    return redirect(url_for('profile'))

@app.route('/signout')
def signout():
    session.pop('user', None)

    resp = make_response(redirect(url_for('index')))
    resp.set_cookie('email', '', expires=0)
    resp.set_cookie('name', '', expires=0)

    return resp

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/clear-cookies', methods=['POST'])
def clear_cookies():
    resp = make_response('Cookies cleared')
    resp.set_cookie('email', '', expires=0, path='/')
    resp.set_cookie('name', '', expires=0, path='/')
    resp.set_cookie('session', '', expires=0, path='/')
    return resp

if __name__ == '__main__':
    app.run(debug=True)