import json
import logging
from fastapi import WebSocket, WebSocketDisconnect

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id in self.active_connections:
            logging.warning(f"User {user_id} reconnected, closing previous connection.")
            try:
                await self.active_connections[user_id].close(code=1000)
            except RuntimeError: # Connection might already be closed
                pass
        self.active_connections[user_id] = websocket
        logging.info(f"User {user_id} connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logging.info(f"User {user_id} disconnected. Total clients: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)
        else:
            logging.warning(f"Attempted to send message to disconnected user: {user_id}")

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

# --- ADDED: A separate manager for the open test endpoint ---
class TestConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logging.info(f"Test client '{client_id}' connected. Total test clients: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logging.info(f"Test client '{client_id}' disconnected. Total test clients: {len(self.active_connections)}")

    async def broadcast(self, message: str, sender_id: str = None):
        # Broadcast to all clients, optionally excluding the sender
        for client_id, connection in self.active_connections.items():
            if sender_id and client_id == sender_id:
                continue
            try:
                await connection.send_text(message)
            except RuntimeError as e:
                logging.warning(f"Could not send to test client {client_id}: {e}")

# Instantiate the test manager
test_manager = TestConnectionManager()