import io
import datetime
import uuid
import os
import sys
import glob
import contextlib
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import exifread
import numpy as np
from sklearn.cluster import DBSCAN
import unittest

app = Flask(__name__)
CORS(app)

# Absolute path to 'uploads' folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def get_decimal_from_dms(dms, ref):
    """
    Convert GPS coordinates in DMS format to decimal degrees.
    dms: list of exifread Ratio objects.
    ref: 'N', 'S', 'E', or 'W'
    """
    try:
        degrees = float(dms[0].num) / dms[0].den
        minutes = float(dms[1].num) / dms[1].den
        seconds = float(dms[2].num) / dms[2].den
        decimal = degrees + minutes / 60.0 + seconds / 3600.0
        if ref in ['S', 'W']:
            decimal = -decimal
        return decimal
    except Exception as e:
        return None

def parse_exif(file_bytes):
    """
    Extract EXIF DateTimeOriginal and GPS (lat/lon) data.
    Returns:
      - dt_obj: datetime.datetime or None
      - lat, lon: float values (default to 0.0 if not available)
    """
    dt_obj = None
    lat, lon = None, None
    try:
        tags = exifread.process_file(io.BytesIO(file_bytes), details=False)
        if "EXIF DateTimeOriginal" in tags:
            dt_str = str(tags["EXIF DateTimeOriginal"])
            try:
                dt_obj = datetime.datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
            except Exception:
                dt_obj = None
        # Extract GPS info if available
        if ("GPS GPSLatitude" in tags and "GPS GPSLatitudeRef" in tags and
            "GPS GPSLongitude" in tags and "GPS GPSLongitudeRef" in tags):
            lat = get_decimal_from_dms(tags["GPS GPSLatitude"].values, str(tags["GPS GPSLatitudeRef"]))
            lon = get_decimal_from_dms(tags["GPS GPSLongitude"].values, str(tags["GPS GPSLongitudeRef"]))
    except Exception:
        pass
    # Use 0.0 as default if no GPS data found
    return dt_obj, lat if lat is not None else 0.0, lon if lon is not None else 0.0

def date_to_days(dt):
    """Convert datetime to float days since epoch."""
    if not dt:
        return 0.0
    epoch = datetime.datetime(1970, 1, 1)
    delta = dt - epoch
    return delta.total_seconds() / 86400.0

@app.route("/process", methods=["POST"])
def process_images():
    """
    Process multiple images from user-uploaded files and/or prepared photos:
    1. Extract EXIF metadata (date/time and GPS)
    2. Cluster based on date and location
    3. Return JSON with cluster levels, nodes, and links
    """
    files = request.files.getlist("photos")
    prep_photos = request.form.getlist("prepPhotos")  # get list of prep photo filenames

    # If neither uploaded files nor prep photos are provided, return error
    if not files and not prep_photos:
        return jsonify({"error": "No files or prepared photos selected"}), 400

    photo_data = []

    # Process user-uploaded files (if any)
    for f in files:
        file_bytes = f.read()
        f.seek(0)

        dt_obj, lat, lon = parse_exif(file_bytes)

        # Save the image to 'uploads' with a unique filename
        unique_filename = f"{uuid.uuid4()}_{f.filename}"
        save_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        f.save(save_path)

        # Use a relative URL for the saved image from the uploads folder
        relative_url = f"/uploads/{unique_filename}"

        photo_data.append({
            "id": str(uuid.uuid4()),
            "filename": f.filename,
            "datetime": dt_obj,
            "daysSinceEpoch": date_to_days(dt_obj),
            "lat": lat,
            "lon": lon,
            "imageUrl": relative_url
        })

    # Process prepared photos if provided (use them directly from the prepPhotos folder)
    if prep_photos:
        prep_folder = os.path.join(os.getcwd(), "prepPhotos")
        for filename in prep_photos:
            file_path = os.path.join(prep_folder, filename)
            if not os.path.exists(file_path):
                continue
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            dt_obj, lat, lon = parse_exif(file_bytes)
            # Directly use the prepPhotos route for displaying the image
            relative_url = f"/prepPhotos/{filename}"
            photo_data.append({
                "id": str(uuid.uuid4()),
                "filename": filename,
                "datetime": dt_obj,
                "daysSinceEpoch": date_to_days(dt_obj),
                "lat": lat,
                "lon": lon,
                "imageUrl": relative_url
            })

    # Prepare data for clustering
    X = np.array([
        [p["daysSinceEpoch"], p["lat"], p["lon"]]
        for p in photo_data
    ])

    eps_values = [10.0, 20.0, 30.0]  # example thresholds for DBSCAN
    levels = []

    for lvl, eps in enumerate(eps_values):
        if len(X) < 2:
            labels = np.array([-1] * len(X))
        else:
            dbscan = DBSCAN(eps=eps, min_samples=2)
            labels = dbscan.fit_predict(X)

        nodes = []
        cluster_map = {}
        for i, p in enumerate(photo_data):
            node_data = {
                "id": p["id"],
                "filename": p["filename"],
                "cluster": int(labels[i]),
                "dateTime": p["datetime"].isoformat() if p["datetime"] else None,
                "lat": p["lat"],
                "lon": p["lon"],
                "imageUrl": p["imageUrl"]
            }
            nodes.append(node_data)
            cluster_map.setdefault(labels[i], []).append(i)

        links = []
        for label, idx_list in cluster_map.items():
            if label == -1:
                continue  # skip outliers
            idx_list.sort()
            for j in range(len(idx_list) - 1):
                source_idx = idx_list[j]
                target_idx = idx_list[j + 1]
                links.append({
                    "source": photo_data[source_idx]["id"],
                    "target": photo_data[target_idx]["id"]
                })

        levels.append({
            "level": lvl,
            "nodes": nodes,
            "links": links
        })

    return jsonify({"levels": levels})



@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve the uploaded images from the 'uploads' folder."""
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route("/")
def hello():
    return "Backend for Photo Clustering."

@app.route("/prep-photos-list", methods=["GET"])
def list_prep_photos():
    folder_path = os.path.join(os.getcwd(), "prepPhotos")
    # Filter to only files (ignore subdirectories)
    files = [
        f for f in os.listdir(folder_path) 
        if os.path.isfile(os.path.join(folder_path, f))
    ]
    return jsonify(files)

# Serve the actual images if needed (so that <img> src can fetch them):
@app.route("/prepPhotos/<path:filename>", methods=["GET"])
def get_prep_photo(filename):
    folder_path = os.path.join(os.getcwd(), "prepPhotos")
    return send_from_directory(folder_path, filename)

@app.route('/api/photos-by-date-range', methods=['GET'])
def get_photos_by_date_range():
    """Get photos filtered by date range"""
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    
    # Convert string dates to datetime objects
    start = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
    end = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None
    
    # Get all processed photo data (assuming you store this somewhere)
    # This is a placeholder - you'll need to implement based on your data storage
    all_photos = get_all_processed_photos()  
    
    # Filter by date range
    filtered_photos = []
    for photo in all_photos:
        if not photo.get('dateTime'):
            continue
            
        photo_date = datetime.fromisoformat(photo['dateTime'].replace('Z', '+00:00'))
        if (not start or photo_date >= start) and (not end or photo_date <= end):
            filtered_photos.append(photo)
    
    return jsonify(filtered_photos)

@app.route('/api/user-preferences', methods=['GET', 'POST'])
def handle_user_preferences():
    """Get or update user preferences"""
    if request.method == 'GET':
        # Load user preferences from a file or database
        try:
            with open('user_preferences.json', 'r') as f:
                preferences = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # Default preferences if file doesn't exist or is invalid
            preferences = {
                'likedStories': [],
                'dislikedStories': [],
                'likedLocations': {},
                'likedDates': {}
            }
        return jsonify(preferences)
    
    elif request.method == 'POST':
        # Update user preferences
        preferences = request.json
        
        # Save to file (or database in a production app)
        with open('user_preferences.json', 'w') as f:
            json.dump(preferences, f)
            
        return jsonify({'success': True})

@app.route('/api/generate-stories', methods=['POST'])
def generate_stories():
    """Generate stories based on filters and preferences"""
    data = request.json
    start_date = data.get('startDate')
    end_date = data.get('endDate')
    preferences = data.get('preferences', {})
    
    # Get photos filtered by date range
    filtered_photos = []
    all_photos = get_all_processed_photos()  # You need to implement this
    
    for photo in all_photos:
        if not photo.get('dateTime'):
            continue
            
        photo_date = datetime.fromisoformat(photo['dateTime'].replace('Z', '+00:00'))
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None
        
        if (not start or photo_date >= start) and (not end or photo_date <= end):
            filtered_photos.append(photo)
    
    # Generate stories based on filtered photos and preferences
    # This is a placeholder - you'd implement your story generation logic here
    stories = generate_stories_from_photos(filtered_photos, preferences)
    
    return jsonify(stories)


# Helper function to get all processed photos
def get_all_processed_photos():
    """Get all processed photos from storage"""
    # This is a placeholder - implement based on how you store processed photos
    try:
        with open('processed_photos.json', 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

# Helper function to generate stories from photos
def generate_stories_from_photos(photos, preferences):
    """Generate stories based on photos and user preferences"""
    # Group photos by different criteria
    stories = []
    
    # Group by location
    location_groups = {}
    for photo in photos:
        loc_key = f"{photo.get('lat', 0):.2f},{photo.get('lon', 0):.2f}"
        if loc_key not in location_groups:
            location_groups[loc_key] = []
        location_groups[loc_key].append(photo)
    
    # Add location-based stories
    for loc_key, loc_photos in location_groups.items():
        if len(loc_photos) >= 3:
            stories.append({
                'id': f'location-{loc_key}-{datetime.now().timestamp()}',
                'title': f'Location {loc_key}',
                'nodes': loc_photos[:5],
                'type': 'location'
            })
    
    # Group by date
    date_groups = {}
    for photo in photos:
        if not photo.get('dateTime'):
            continue
        
        date_str = photo['dateTime'].split('T')[0]  # Extract just the date part
        if date_str not in date_groups:
            date_groups[date_str] = []
        date_groups[date_str].append(photo)
    
    # Add date-based stories
    for date_str, date_photos in date_groups.items():
        if len(date_photos) >= 3:
            # Format date for display
            try:
                date_obj = datetime.fromisoformat(date_str)
                formatted_date = date_obj.strftime('%B %d, %Y')
            except:
                formatted_date = date_str
                
            stories.append({
                'id': f'date-{date_str}-{datetime.now().timestamp()}',
                'title': f'On {formatted_date}',
                'nodes': date_photos[:5],
                'type': 'date'
            })
    
    # Sort stories based on user preferences
    if preferences:
        # Default priority for all stories
        for story in stories:
            story['priority'] = 0
        
        # Sort stories by priority (higher first)
        stories.sort(key=lambda x: x.get('priority', 0), reverse=True)
    
    return stories

# -------------------- Unit Tests --------------------

class TestPhotoProcessing(unittest.TestCase):
    # Dummy Ratio class for testing get_decimal_from_dms
    class DummyRatio:
        def __init__(self, num, den):
            self.num = num
            self.den = den

    def test_get_decimal_from_dms(self):
        dms = [
            TestPhotoProcessing.DummyRatio(30, 1),
            TestPhotoProcessing.DummyRatio(15, 1),
            TestPhotoProcessing.DummyRatio(50, 1)
        ]
        # Test for northern hemisphere
        decimal = get_decimal_from_dms(dms, "N")
        expected = 30 + 15/60 + 50/3600
        self.assertAlmostEqual(decimal, expected, places=5)
        # Test for southern hemisphere (should be negative)
        decimal = get_decimal_from_dms(dms, "S")
        self.assertAlmostEqual(decimal, -expected, places=5)

    def test_parse_exif_without_gps(self):
        # Create dummy bytes that do not contain valid EXIF info.
        dummy_bytes = b"Not a real image"
        dt_obj, lat, lon = parse_exif(dummy_bytes)
        self.assertIsNone(dt_obj)
        self.assertEqual(lat, 0.0)
        self.assertEqual(lon, 0.0)

    def test_real_images(self):
        """
        Load 3 real image files from the uploads folder, extract EXIF data,
        and print the results.
        """
        images = glob.glob(os.path.join(UPLOAD_FOLDER, "*.jpg"))
        if len(images) < 3:
            self.skipTest("Not enough images in the uploads folder for testing real images")
        for image_file in images[:3]:
            with open(image_file, 'rb') as f:
                file_bytes = f.read()
            dt_obj, lat, lon = parse_exif(file_bytes)
            print(f"Testing {os.path.basename(image_file)}:")
            print(f"  EXIF DateTime: {dt_obj}")
            print(f"  GPS: lat={lat}, lon={lon}")

# -------------------- Main --------------------
if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # Run unit tests if 'test' argument is provided
        unittest.main(argv=[sys.argv[0]])
    else:
        # Start the Flask server
        app.run(host="0.0.0.0", port=5000, debug=True)