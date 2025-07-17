FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
ENV PORT=5002
EXPOSE 5002
CMD ["python", "channel_service.py"]
