# Deutsch Quest — веб-версия.
#   docker build -t deutsch-quest .
#   docker run -p 8000:8000 deutsch-quest
FROM python:3.12-slim

WORKDIR /app
COPY . /app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["python", "server.py", "--port", "8000", "--no-browser"]