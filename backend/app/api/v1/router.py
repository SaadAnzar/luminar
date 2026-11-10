from fastapi import APIRouter
from app.api.v1 import auth, luminars, quiz, favorites, portfolio, profiles, social, assessments

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(luminars.router, prefix="/luminars", tags=["luminars"])
api_router.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
api_router.include_router(favorites.router, prefix="/favorites", tags=["favorites"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
api_router.include_router(social.router, prefix="/discover", tags=["discover"])
api_router.include_router(assessments.router, prefix="/assessments", tags=["assessments"])
