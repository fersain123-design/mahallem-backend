import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

async def create_admin():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    admin = {
        'id': str(uuid.uuid4()),
        'email': 'fer.sain123@gmail.com',
        'name': 'Ferhat',
        'role': 'Admin',
        'password_hash': pwd_context.hash('Ferhat.1577'),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Varsa güncelle, yoksa ekle
    await db.admins.update_one(
        {'email': admin['email']},
        {'$set': admin},
        upsert=True
    )
    print('Admin kullanici olusturuldu!')
    print(f'Email: {admin["email"]}')
    print(f'Sifre: Ferhat.1577')

asyncio.run(create_admin())
