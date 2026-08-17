# Project Name

    QA Automation AI

    *A FastAPI-based application with AI-powered computer vision for fashion item detection, image processing, and vector-based similarity search using CLIP embeddings, and Qdrant vector database.*

# Features


## Prerequisites

    - Python 3.10 or 3.11
    - pip (Python package installer)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Create Virtual Environment

```bash
python -m venv venv
```

### 3. Activate Virtual Environment

**Windows:**

```bash
.\venv\Scripts\activate
```

**macOS/Linux:**

```bash
source venv/bin/activate
```

### 4. Upgrade pip

```bash
python -m pip install --upgrade pip
```

### 5. Install PyTorch

Install PyTorch CPU version:

```bash
pip install torch==2.9.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cpu
```

> **Note:** This installs the CPU-only version of PyTorch. If you need GPU support, visit [PyTorchs official website](https://pytorch.org/get-started/locally/) for the appropriate installation command.

### 6. Install Dependencies

```bash
pip install -r requirements.txt
```

## Running the Application

### Development Mode

Run the application with auto-reload enabled:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

For production, remove the `--reload` flag:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Accessing the Application

Once the server is running, you can access:

- **Application:** http://localhost:8000
- **API Documentation (Swagger UI):** http://localhost:8000/docs
- **Alternative API Documentation (ReDoc):** http://localhost:8000/redoc

## Project Structure

```
project/
│
├── app/
│   ├── main.py          # FastAPI application entry point
│   └── ...              # Other application modules
│
├── venv/                # Virtual environment (not tracked in git)
├── requirements.txt     # Python dependencies
└── README.md            # This file
```

## Development

### Adding New Dependencies

When adding new packages, make sure to update the requirements file:

```bash
pip freeze > requirements.txt
```

### Deactivating Virtual Environment

When you are done working on the project:

```bash
deactivate
```

## Troubleshooting

### Virtual Environment Issues

If you encounter issues with the virtual environment, try removing it and recreating:

```bash
# Remove the virtual environment
rm -rf venv  # macOS/Linux
rmdir /s venv  # Windows

# Recreate it
python -m venv venv
```

### Port Already in Use

If port 8000 is already in use, you can specify a different port:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```
