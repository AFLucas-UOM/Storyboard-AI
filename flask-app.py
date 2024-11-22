from flask import Flask, render_template, redirect, url_for, request, session, send_from_directory, jsonify, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import timedelta
import os, json, bleach # sanitized input
import subprocess

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24))  # Use a secure secret key
app.permanent_session_lifetime = timedelta(minutes=60)  # Session expiry after 60 minutes of inactivity

USER_JSON_PATH = os.path.join(app.static_folder, 'credentials.json')  # Path to 'static/credentials.json'
DEFAULT_PFP = 'default.png'  # Default Profile Picture
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB limit for profile pictures

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('assets', filename)

# Function to pretty-print and write to the credentials JSON file
def save_credentials_pretty(data):
    with open(USER_JSON_PATH, 'w') as f:
        json.dump(data, f, indent=4)  # Pretty-print with 4 spaces for indentation

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

# Sanitize input to avoid XSS
def sanitize_input(input_data):
    return bleach.clean(input_data)

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
            email = sanitize_input(data.get('email'))
            password = sanitize_input(data.get('password'))
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
    email = sanitize_input(request.json.get('email'))
    return jsonify({"exists": email_exists(email)})

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        try:
            data = request.get_json()
            name = sanitize_input(data.get('name'))
            email = sanitize_input(data.get('email'))
            password = sanitize_input(data.get('password'))
            confirm_password = sanitize_input(data.get('confirmPassword'))

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
            save_credentials_pretty(existing_users)  # Save with pretty formatting

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
            # Exclude the password field from the user data
            user_without_password = {key: value for key, value in user.items() if key != 'password'}
            return render_template('profile.html', user=user_without_password)
    return redirect(url_for('login'))

@app.route('/update_profile', methods=['POST'])
def update_profile():
    name = sanitize_input(request.form['name'])
    email = sanitize_input(request.form['email'])
    password = sanitize_input(request.form['password'])
    profile_pic = DEFAULT_PFP

    user_credentials = load_credentials()

    # Find the user by email
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
                if len(pic.read()) > MAX_FILE_SIZE:
                    return jsonify({"success": False, "message": "File size exceeds the 10MB limit"}), 400
                pic.seek(0)  # Reset file pointer after reading size
                pic_filename = secure_filename(pic.filename)
                profile_pic = f"{name}_{pic_filename}"
                pic.save(os.path.join('static/img/PFPs', profile_pic))

        # Update the user profile
        if password:
            # Check if the new password differs from the current password
            if not check_password_hash(user['password'], password):
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
        else:
            user.update({
                'name': name,
                'email': email,
                'profile_pic': profile_pic
            })

        # Save the updated credentials with pretty formatting
        save_credentials_pretty(user_credentials)

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
    resp.delete_cookie('email')
    resp.delete_cookie('name')
    return resp

# Function to query Ollama
def query_ollama(prompt):
    try:
        print(f"Sending prompt to Ollama: {prompt}")  # Debugging log
        result = subprocess.run(
            ['ollama', 'run', 'tinyllama:1.1b-chat'],  # Run the Ollama model
            input=prompt,  # Pass the user prompt via stdin
            capture_output=True, text=True, shell=True
        )
        response = result.stdout.strip()  # Get the model's output
        if result.stderr:
            print(f"Error output from Ollama: {result.stderr}")  # Debugging log for errors
        print(f"Ollama response: {response}")  # Debugging log for response
        return response
    except Exception as e:
        print(f"Error querying Ollama: {str(e)}")  # Debugging log for exceptions
        return f"Error querying Ollama: {str(e)}"
    

@app.route('/chat', methods=['GET', 'POST'])
def chat():
    user_email = session.get('user')
    if user_email:
        user_credentials = load_credentials()
        user = next((u for u in user_credentials if u['email'] == user_email), None)
        if user:
            # Extract relevant user information (e.g., name and profile_pic)
            profile_pic = user.get('profile_pic')
            profile_pic_path = f'img/PFPs/{profile_pic}' if profile_pic else 'img/PFPs/default.png'
            user_info = {
                'name': user.get('name', 'Guest'),
                'profile_pic': profile_pic_path
            }

            # Handle POST requests (chatbot functionality)
            if request.method == 'POST':
                user_input = request.json.get('prompt', "").strip()
                if not user_input:
                    return jsonify({"response": "Error: No prompt provided."}), 400
                
                # Query Ollama with the user prompt
                response = query_ollama(user_input)
                return jsonify({"response": response})

            # Render the chat page for GET requests
            return render_template('chat.html', user_info=user_info)
    
    return redirect(url_for('login'))


if __name__ == '__main__':
    app.run(debug=True)