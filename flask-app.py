from flask import Flask, render_template, redirect, url_for, request, session, send_from_directory, jsonify, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import timedelta
import os, json, bleach # sanitized input
import subprocess, sys, time, psutil
import torch
from diffusers import StableDiffusionPipeline
import os
from PIL import Image, ImageFilter

auth_token = "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"

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24))  # Use a secure secret key
app.permanent_session_lifetime = timedelta(minutes=60)  # Session expiry after 60 minutes of inactivity

USER_JSON_PATH = os.path.join(app.static_folder, 'credentials.json')  # Path to 'static/credentials.json'
CONVERSATIONS_FILE_PATH = os.path.join('json', 'conversations.json') # Path to the conversations.json file
DEFAULT_PFP = 'default.png'  # Default Profile Picture
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB limit for profile pictures

# Define the path to save generated images
GENERATED_IMAGES_FOLDER = os.path.join('static', 'img', 'GeneratedImages')

# Create the folder if it doesn't exist
os.makedirs(GENERATED_IMAGES_FOLDER, exist_ok=True)

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

# Load the Stable Diffusion model
def load_model():
    model_id = "CompVis/stable-diffusion-v1-4"
    if torch.cuda.is_available():
        device = "cuda"
        dtype = torch.float16
    elif torch.backends.mps.is_available():
        device = "mps"
        dtype = torch.float16
    else:
        device = "cpu"
        dtype = torch.float32

    print(f"Using device: {device}")
    try:
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=dtype,
            use_auth_token=auth_token  # Replace with your token
        )
        pipe.to(device)
        return pipe, device
    except Exception as e:
        print(f"Error loading model: {e}")
        return None, None

# Initialise model and device
model, device = load_model()

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

@app.route('/archive')
def archive():
    return render_template('archive.html')

# Serve the conversation.json file
@app.route('/assets/json/conversations.json')
def get_conversation_data():
    try:
        # Open and read the JSON file
        with open(CONVERSATIONS_FILE_PATH, 'r') as f:
            conversation_data = json.load(f)  # Ensure it's a Python object (list)

        return jsonify(conversation_data)  # Return as JSON response
    except Exception as e:
        print(f"Error reading the JSON file: {e}")
        return jsonify({"error": "Failed to load conversations"}), 500

@app.route('/delete_story', methods=['POST'])
def delete_story():
    try:
        # Get the title from the request
        data = request.get_json()
        title_to_delete = data.get('title')

        if not title_to_delete:
            return jsonify({'success': False, 'message': 'Title not provided'}), 400

        # Load the JSON file
        if not os.path.exists(CONVERSATIONS_FILE_PATH ):
            return jsonify({'success': False, 'message': 'File not found'}), 404

        with open(CONVERSATIONS_FILE_PATH, 'r') as file:
            stories = json.load(file)

        # Filter out the story with the matching title
        updated_stories = [story for story in stories if story['title'] != title_to_delete]

        # Save the updated list back to the file
        with open(CONVERSATIONS_FILE_PATH , 'w') as file:
            json.dump(updated_stories, file, indent=4)

        return jsonify({'success': True, 'message': 'Story deleted successfully'})

    except Exception as e:
        print(f'Error: {e}')
        return jsonify({'success': False, 'message': 'An error occurred'}), 500

def load_credentials():
    with open(USER_JSON_PATH, 'r') as f:
        return json.load(f)
    
def iterative_upscale(image, scale_factor=3.0, steps=2):
    """
    Upscale an image by 'scale_factor' in multiple steps
    using the LANCZOS resampling filter.
    """
    width, height = image.size
    step_factor = scale_factor ** (1 / steps)  # e.g., 3^(1/2) ~ 1.732 if steps=2
    
    upscaled = image
    for _ in range(steps):
        new_width = int(upscaled.width * step_factor)
        new_height = int(upscaled.height * step_factor)
        upscaled = upscaled.resize((new_width, new_height), Image.LANCZOS)
    return upscaled

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

@app.errorhandler(Exception)
def handle_error(e):
    # You can log the error here if needed
    return render_template('404.html'), 500

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/clear-cookies', methods=['POST'])
def clear_cookies():
    resp = make_response('Cookies cleared')
    resp.delete_cookie('email')
    resp.delete_cookie('name')
    return resp

def query_ollama(prompt):
    try:
        # Determine the platform
        is_windows = sys.platform.startswith('win')
        
        # Set the ollama executable path based on the platform
        ollama_path = 'ollama'  # Default for macOS/Linux
        if is_windows:
            ollama_path = 'ollama.exe'  # Adjust for Windows

        def is_ollama_running():
            """Check if Ollama is running."""
            for process in psutil.process_iter(['name']):
                if process.info['name'] and 'ollama' in process.info['name'].lower():
                    return True
            return False

        def start_ollama():
            """Start Ollama server."""
            try:
                start_command = [ollama_path, 'serve']
                subprocess.Popen(start_command)
                print("Ollama server started.")  # Debugging log
                time.sleep(5)  # Allow the server some time to initialize
            except Exception as e:
                print(f"Failed to start Ollama: {str(e)}")
                raise

        # Ensure Ollama server is running
        if not is_ollama_running():
            print("Ollama is not running. Starting the server...")
            start_ollama()
        
        # Construct the command for querying
        command = [ollama_path, 'run', 'orca-mini:latest'] #tinyllama:1.1b-chat <- testing model orca-mini:latest <-- actual model we use
        print(f"Sending prompt: {prompt}")  # Debugging log

        # Run the subprocess to query Ollama
        result = subprocess.run(
            command,
            input=prompt,  # Pass the user prompt via stdin
            capture_output=True, text=True
        )

        # Process the output
        if result.returncode != 0:
            error_message = result.stderr.strip()
            print(f"Error output from Ollama: {error_message}")  # Debugging log for errors
            return f"Error: {error_message}"
        
        response = result.stdout.strip()
        print(f"Ollama response: {response}")  # Debugging log for response
        return response

    except FileNotFoundError:
        return "Error: Ollama executable not found. Ensure it's installed and available in PATH."
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

@app.route('/save-conversation', methods=['POST'])
def save_conversation():
    try:
        # Get the JSON data from the request
        conversation_data = request.get_json()

        # Read the existing conversations from the file
        if os.path.exists(CONVERSATIONS_FILE_PATH):
            with open(CONVERSATIONS_FILE_PATH, 'r') as file:
                conversations = json.load(file)
        else:
            conversations = []

        # Append the new conversation
        conversations.append(conversation_data)

        # Save the updated conversations back to the JSON file
        with open(CONVERSATIONS_FILE_PATH, 'w') as file:
            json.dump(conversations, file, indent=4)

        return jsonify({"message": "Conversation saved successfully"}), 200

    except Exception as e:
        print(f"Error saving conversation: {e}")
        return jsonify({"message": "Error saving conversation"}), 500
    
@app.route('/update-title', methods=['POST'])
def update_title():
    try:
        # Get the JSON data from the request
        data = request.get_json()
        story_id = data.get('story_id')
        new_title = data.get('newTitle')

        # Check if story_id and newTitle are provided
        if not story_id or not new_title:
            return jsonify({"message": "Missing story_id or newTitle"}), 400

        # Read the existing conversations from the file
        if os.path.exists(CONVERSATIONS_FILE_PATH):
            with open(CONVERSATIONS_FILE_PATH, 'r') as file:
                conversations = json.load(file)
        else:
            return jsonify({"message": "Conversations file not found"}), 404

        # Find and update the title for the matching story_id
        updated = False
        for conversation in conversations:
            if conversation.get("story_id") == story_id:
                conversation["title"] = new_title
                updated = True
                break

        # If no conversation with the matching story_id is found
        if not updated:
            return jsonify({"message": "Story ID not found"}), 404

        # Save the updated conversations back to the JSON file
        with open(CONVERSATIONS_FILE_PATH, 'w') as file:
            json.dump(conversations, file, indent=4)

        return jsonify({"message": "Title updated successfully"}), 200

    except Exception as e:
        print(f"Error updating title: {e}")
        return jsonify({"message": "Error updating title"}), 500
    
@app.route('/update-story', methods=['POST'])
def update_story():
    try:
        # Get the JSON data from the request
        data = request.get_json()
        story_id = int(data.get('story_id'))  # Convert story_id to an integer
        new_story = data.get('story')

        # Check if story_id and new_story are provided
        if not story_id or not new_story:
            return jsonify({"message": "Missing story_id or new story content"}), 400

        # Read the existing conversations from the file
        if os.path.exists(CONVERSATIONS_FILE_PATH):
            with open(CONVERSATIONS_FILE_PATH, 'r') as file:
                conversations = json.load(file)
        else:
            return jsonify({"message": "Conversations file not found"}), 404

        # Find and update the story for the matching story_id
        updated = False
        for conversation in conversations:
            if conversation.get("story_id") == story_id:
                conversation["story"] = new_story  # Update the story content
                updated = True
                break

        # If no conversation with the matching story_id is found
        if not updated:
            return jsonify({"message": "Story ID not found"}), 404

        # Save the updated conversations back to the JSON file
        with open(CONVERSATIONS_FILE_PATH, 'w') as file:
            json.dump(conversations, file, indent=4)

        return jsonify({"message": "Story updated successfully"}), 200

    except Exception as e:
        print(f"Error updating story: {e}")
        return jsonify({"message": "Error updating story"}), 500

@app.route('/generate', methods=['POST'])
def generate_image():
    """Generate and upscale the image using the prompt sent from HTML."""
    if not model:
        return jsonify({"error": "Model not loaded"}), 500

    # Get the prompt and story_id from the request
    data = request.json
    prompt = data.get("prompt")
    story_id = data.get("story_id")  # Get the story_id from the request
    if not prompt or not story_id:
        return jsonify({"error": "Prompt and story_id are required"}), 400

    try:
        # Run model inference
        if device == "cuda":
            with torch.autocast("cuda"), torch.no_grad():
                result = model(prompt, guidance_scale=8.5)
        else:
            with torch.no_grad():
                result = model(prompt, guidance_scale=8.5)

        # Save the generated image locally with the story_id as the filename
        image = result.images[0]
        generated_image_path = os.path.join(GENERATED_IMAGES_FOLDER, f"{story_id}.png")
        image.save(generated_image_path)

        # Upscale the image
        image = Image.open(generated_image_path).convert("RGB")
        upscaled_image = iterative_upscale(image, scale_factor=3.0, steps=2)

        # Save the upscaled image with the story_id
        upscaled_image_path = os.path.join(GENERATED_IMAGES_FOLDER, f"{story_id}_upscaled.png")
        upscaled_image.save(upscaled_image_path)

        # Return the relative URL path (not the file system path)
        upscaled_image_url = f"/static/img/GeneratedImages/{story_id}_upscaled.png"
        print("Generated image path:", generated_image_path)
        print("Upscaled image path:", upscaled_image_path)
        print("Upscaled image URL:", upscaled_image_url)


        return jsonify({"message": "Image generated and upscaled successfully", "image_url": upscaled_image_url})
    except Exception as e:
        print(f"Error generating image: {e}")
        return jsonify({"error": "Failed to generate image"}), 500
    
@app.route('/delete-image', methods=['POST'])
def delete_image():
    data = request.get_json()
    image_url = data.get('image_url')

    if not image_url:
        return jsonify({"success": False, "message": "No image URL provided."})

    # Extract the file path from the URL
    image_path = os.path.join(app.root_path, image_url.lstrip('/'))

    try:
        if os.path.exists(image_path):
            os.remove(image_path)
            return jsonify({"success": True, "message": "Image deleted successfully."})
        else:
            return jsonify({"success": False, "message": "Image file not found."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

    
if __name__ == '__main__':
    app.run(debug=True)