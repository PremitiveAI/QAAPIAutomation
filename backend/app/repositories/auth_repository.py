# app/repositories/auth_repository.py

from sqlalchemy.orm import Session
from app.models.users_model import Users

class AuthRepository:

    @staticmethod
    def find_user(db: Session, username: str = None, mobilenumber: str = None):
        return db.query(Users).filter(
            (Users.username == username) | (Users.mobilenumber == mobilenumber)
        ).first()

    @staticmethod
    def create_user(db: Session, username: str, mobilenumber: str, hashed_pwd: str):
        user = Users(username=username, mobilenumber=mobilenumber, password=hashed_pwd)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    