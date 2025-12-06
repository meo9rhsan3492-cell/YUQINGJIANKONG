from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio
import random
import datetime

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Provide immediate feedback upon connection
        await websocket.send_text(json.dumps({
            "type": "log",
            "message": "Connected to Backend Server (Live)"
        }))

        # Handle incoming messages (e.g., adding keywords)
        while True:
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)
                if parsed.get("type") == "add_keyword":
                    await websocket.send_text(json.dumps({
                        "type": "log",
                        "message": f"Server received monitoring request for: {parsed.get('keyword')}"
                    }))
            except:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Background task to push data
# In a real app, this would be the crawler pushing data found from DB or Scraper
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(generate_data())

async def generate_data():
    """
    Simulates a backend crawler finding data.
    Replace this logic with real database polling or scraper hooks.
    """
    platforms = ['weibo', 'wechat', 'douyin', 'redbook', 'zhihu', 'toutiao']
    sentiments = ['positive', 'neutral', 'negative']
    risk_levels = ['low', 'medium', 'high', 'critical']

    while True:
        if manager.active_connections:
            # Generate a logical mock post
            platform = random.choice(platforms)
            sentiment = random.choice(sentiments)
            risk = random.choice(risk_levels) if sentiment == 'negative' else 'low'
            
            data_item = {
                "id": str(random.randint(10000, 99999)),
                "platform": platform,
                "content": f"Real-time pushed content from backend for {platform}...",
                "time": datetime.datetime.now().strftime("%H:%M:%S"),
                "sentiment": sentiment,
                "riskLevel": risk,
                "url": "#"
            }
            
            await manager.broadcast(json.dumps({
                "type": "data",
                "data": data_item
            }))
            
        await asyncio.sleep(random.uniform(2, 5))
