FROM node:22 AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=frontend-build /app/dist /app/frontend/dist
COPY server.py .
COPY api/ api/

EXPOSE 8000
CMD ["python", "server.py"]
