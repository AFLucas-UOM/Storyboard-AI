from flask import Flask, render_template, redirect, url_for, request, session, send_from_directory, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import os, json

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24))  # Use a secure secret key

USER_JSON_PATH = os.path.join(app.static_folder, 'credentials.json')  # Path to 'static/credentials.json'

# Function to check if the email already exists in the database (credentials.json)
def email_exists(email):
    if os.path.exists(USER_JSON_PATH):
        with open(USER_JSON_PATH, 'r') as f:
            existing_users = json.load(f)
            for user in existing_users:
                if user['email'] == email:
                    return True  # Email exists
    return False  # Email does not exist

# Function to authenticate user based on email and password
def authenticate_user(email, password):
    if os.path.exists(USER_JSON_PATH):
        with open(USER_JSON_PATH, 'r') as f:
            users = json.load(f)
            for user in users:
                if user['email'] == email and check_password_hash(user['password'], password):
                    return user  # Return user data including 'name'
    return None  # Invalid credentials

# Main route (Home Page)
@app.route('/')
def index():
    return render_template('index.html')

# Login route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        # Use JSON data for the login attempt
        if request.is_json:
            data = request.get_json()
            email = data.get('email')
            password = data.get('password')
            
            # Attempt to authenticate the user
            user = authenticate_user(email, password)
            
            if user:
                session['user'] = user['email']  # Store user email in session
                return jsonify({
                    "success": True,
                    "message": "Login successful",
                    "redirect": url_for('index2'),
                    "name": user['name']  # Return the user's name only
                })
            else:
                return jsonify({"success": False, "message": "Invalid credentials"})
        
        return jsonify({"success": False, "message": "Request must be JSON"})
    
    return render_template('login.html')

@app.route('/check-email', methods=['POST'])
def check_email():
    email = request.json.get('email')
    if email_exists(email):
        return jsonify({"exists": True})
    return jsonify({"exists": False})

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        try:
            data = request.get_json()  # Get JSON data from the POST request
            name = data.get('name')
            email = data.get('email')
            password = data.get('password')
            confirm_password = data.get('confirmPassword')

            # Validate the data
            if not name or not email or not password or not confirm_password:
                return jsonify({"success": False, "message": "Invalid input"}), 400

            if email_exists(email):
                return jsonify({"success": False, "message": "An account with this email already exists."}), 400

            if password != confirm_password:
                return jsonify({"success": False, "message": "Passwords do not match"}), 400

            if len(password) < 8 or not any(char.isdigit() for char in password):
                return jsonify({"success": False, "message": "Password must be at least 8 characters long and include a number"}), 400

            # Hash the password before saving it
            hashed_password = generate_password_hash(password)

            # Save user to JSON file (now storing hashed password)
            user_data = {"name": name, "email": email, "password": hashed_password}

            # Read existing users or initialize a new list
            if os.path.exists(USER_JSON_PATH):
                with open(USER_JSON_PATH, 'r') as f:
                    existing_users = json.load(f)
            else:
                existing_users = []

            # Append new user and save to the JSON file
            existing_users.append(user_data)
            with open(USER_JSON_PATH, 'w') as f:
                json.dump(existing_users, f, indent=4)

            return jsonify({"success": True, "message": "Account created successfully!"})
        
        except Exception as e:
            print(f"Error: {e}")
            return jsonify({"success": False, "message": "Server error"}), 500

    return render_template('signup.html')  # Handle GET request by rendering signup form

# Main route (Home Page)
@app.route('/home')
def index2():
    return render_template('index2.html')

# Serve files from the 'assets' folder
@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('assets', filename)

# Custom 404 error handler
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True)
