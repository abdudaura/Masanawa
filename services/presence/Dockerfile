FROM python:3.12-slim

WORKDIR /app
COPY services/presence/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/presence/ ./

ENV PYTHONUNBUFFERED=1
CMD ["python", "agent.py", "start"]
