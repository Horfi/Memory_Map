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
import cv2
from sklearn.cluster import DBSCAN
import unittest

app = Flask(__name__)
CORS(app)

# Absolute path to 'uploads' folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Load OpenCV face detector
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

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

def detect_faces_opencv(file_bytes):
    """
    Detect faces using OpenCV.
    Returns the number of detected faces.
    """
    img_array = np.frombuffer(file_bytes, dtype=np.uint8)
    # Suppress stderr to avoid warning messages from cv2.imdecode
    with open(os.devnull, 'w') as devnull, contextlib.redirect_stderr(devnull):
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        return 0

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    return len(faces)

@app.route("/process", methods=["POST"])
def process_images():
    """
    Process multiple images from user-uploaded files and/or prepared photos:
    1. Extract EXIF metadata (date/time and GPS)
    2. Detect faces
    3. Cluster based on date, location, and face count
    4. Return JSON with cluster levels, nodes, and links
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
        face_count = detect_faces_opencv(file_bytes)

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
            "faceCount": face_count,
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
            face_count = detect_faces_opencv(file_bytes)
            # Directly use the prepPhotos route for displaying the image
            relative_url = f"/prepPhotos/{filename}"
            photo_data.append({
                "id": str(uuid.uuid4()),
                "filename": filename,
                "datetime": dt_obj,
                "daysSinceEpoch": date_to_days(dt_obj),
                "lat": lat,
                "lon": lon,
                "faceCount": face_count,
                "imageUrl": relative_url
            })

    # Prepare data for clustering
    X = np.array([
        [p["daysSinceEpoch"], p["lat"], p["lon"], p["faceCount"]]
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
                "faceCount": p["faceCount"],
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
    return "Backend for Photo Clustering with OpenCV."

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

    def test_detect_faces_with_invalid_image(self):
        # Pass invalid image bytes to ensure face detection safely returns 0.
        result = detect_faces_opencv(b"invalid data")
        self.assertEqual(result, 0)

    def test_real_images(self):
        """
        Load 3 real image files from the uploads folder, extract EXIF data,
        count faces, and print the results.
        """
        images = glob.glob(os.path.join(UPLOAD_FOLDER, "*.jpg"))
        if len(images) < 3:
            self.skipTest("Not enough images in the uploads folder for testing real images")
        for image_file in images[:3]:
            with open(image_file, 'rb') as f:
                file_bytes = f.read()
            dt_obj, lat, lon = parse_exif(file_bytes)
            face_count = detect_faces_opencv(file_bytes)
            print(f"Testing {os.path.basename(image_file)}:")
            print(f"  EXIF DateTime: {dt_obj}")
            print(f"  GPS: lat={lat}, lon={lon}")
            print(f"  Face Count: {face_count}")

# -------------------- Main --------------------
if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # Run unit tests if 'test' argument is provided
        unittest.main(argv=[sys.argv[0]])
    else:
        # Start the Flask server
        app.run(host="0.0.0.0", port=5000, debug=True)
