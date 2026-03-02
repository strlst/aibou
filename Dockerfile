FROM python:3.12-slim

WORKDIR /app

# some setup commands
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copy over all source files
COPY *.py ./
COPY templates/ templates/
COPY static/ static/
COPY routes/ routes/

# prevent print buffering
ENV PYTHONUNBUFFERED=1

# expose gunicorn port
EXPOSE 5000

# actually run gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "60", "app:app"]