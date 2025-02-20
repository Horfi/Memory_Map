FROM python:3.11-slim

# Install system dependencies needed for scikit-learn, OpenCV, etc., plus curl for healthchecks
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    python3-opencv \
    libsm6 libxext6 libxrender-dev libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "src/server.py"]
